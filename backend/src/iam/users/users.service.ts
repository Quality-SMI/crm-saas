import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, IsNull, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { UserRole } from './enums/user-role.enum';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { QueryUsersDto } from './dto/query-users.dto';
import { PaginatedResponseDto } from '../../common/dto/response.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async findAll(query: QueryUsersDto): Promise<PaginatedResponseDto<User>> {
    const where: Record<string, unknown>[] = [];
    const base = { deleted_at: IsNull(), client_id: IsNull() };

    if (query.search) {
      where.push(
        { ...base, name: ILike(`%${query.search}%`) },
        { ...base, email: ILike(`%${query.search}%`) },
      );
    } else {
      where.push(base);
    }

    if (query.role) {
      where.forEach((w) => (w['role'] = query.role));
    }

    const [data, total] = await this.userRepo.findAndCount({
      where: where,
      order: { name: 'ASC' },
      skip: query.skip,
      take: query.limit,
    });

    return new PaginatedResponseDto(data, total, query.page, query.limit);
  }

  async findAssignees(): Promise<{ id: string; name: string }[]> {
    return this.userRepo.find({
      where: { deleted_at: IsNull(), client_id: IsNull() },
      order: { name: 'ASC' },
      select: ['id', 'name'],
    });
  }

  async findOne(id: string): Promise<User> {
    const user = await this.userRepo.findOne({
      where: { id, deleted_at: IsNull() },
    });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    return user;
  }

  async create(dto: CreateUserDto): Promise<User> {
    const exists = await this.userRepo.findOne({
      where: { email: dto.email.toLowerCase() },
    });
    if (exists) throw new ConflictException('Email já cadastrado');

    const password_hash = await bcrypt.hash(dto.password, 12);
    const user = this.userRepo.create({
      ...dto,
      email: dto.email.toLowerCase(),
      password_hash,
    });
    return this.userRepo.save(user);
  }

  async update(
    id: string,
    dto: UpdateUserDto,
    requesterId: string,
    requesterRole: UserRole,
  ): Promise<User> {
    const user = await this.findOne(id);

    // Only SUPER_ADMIN can change their own role or another SUPER_ADMIN's data
    if (dto.role && user.role === UserRole.SUPER_ADMIN && requesterId !== id) {
      throw new ForbiddenException('Não é possível alterar outro SUPER_ADMIN');
    }

    await this.userRepo.update(id, dto);
    return this.findOne(id);
  }

  async resetPassword(id: string, newPassword: string): Promise<void> {
    await this.findOne(id);
    const password_hash = await bcrypt.hash(newPassword, 12);
    await this.userRepo.update(id, {
      password_hash,
      failed_login_attempts: 0,
      locked_until: null,
    });
  }

  async remove(id: string, requesterId: string): Promise<void> {
    const user = await this.findOne(id);
    if (user.id === requesterId) {
      throw new ForbiddenException('Você não pode excluir sua própria conta');
    }
    await this.userRepo.softDelete(id);
  }
}
