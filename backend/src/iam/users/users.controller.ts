import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from './enums/user-role.enum';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { QueryUsersDto } from './dto/query-users.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ResponseDto } from '../../common/dto/response.dto';
import { User } from './entities/user.entity';
import { PermissionsService } from '../permissions/permissions.service';
import { UpdateUserPermissionsDto } from '../permissions/dto/update-user-permissions.dto';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly permissionsService: PermissionsService,
  ) {}

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.DIRECTOR)
  async findAll(@Query() query: QueryUsersDto) {
    return this.usersService.findAll(query);
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.DIRECTOR)
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const data = await this.usersService.findOne(id);
    return new ResponseDto(data);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.SUPER_ADMIN, UserRole.DIRECTOR)
  async create(@Body() dto: CreateUserDto) {
    const data = await this.usersService.create(dto);
    return new ResponseDto(data, 'Usuário criado com sucesso');
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.DIRECTOR)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() requester: User,
  ) {
    const data = await this.usersService.update(
      id,
      dto,
      requester.id,
      requester.role,
    );
    return new ResponseDto(data, 'Usuário atualizado com sucesso');
  }

  @Post(':id/reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.SUPER_ADMIN)
  async resetPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResetPasswordDto,
  ) {
    await this.usersService.resetPassword(id, dto.new_password);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.SUPER_ADMIN, UserRole.DIRECTOR)
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() requester: User,
  ) {
    await this.usersService.remove(id, requester.id);
  }

  @Get(':id/permissions')
  @Roles(UserRole.SUPER_ADMIN, UserRole.DIRECTOR)
  async getPermissions(@Param('id', ParseUUIDPipe) id: string) {
    const user = await this.usersService.findOne(id);
    const data = await this.permissionsService.getUserPermissionsResponse(
      id,
      user.role,
    );
    return new ResponseDto(data);
  }

  @Put(':id/permissions')
  @Roles(UserRole.SUPER_ADMIN, UserRole.DIRECTOR)
  async setPermissions(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserPermissionsDto,
    @CurrentUser() requester: User,
  ) {
    const user = await this.usersService.findOne(id);
    if (
      user.role === UserRole.SUPER_ADMIN &&
      requester.role !== UserRole.SUPER_ADMIN
    ) {
      throw new ForbiddenException(
        'Não é possível editar permissões de Super Admin',
      );
    }
    await this.permissionsService.setUserPermissions(
      id,
      user.role,
      dto.permissions,
    );
    return new ResponseDto(null, 'Permissões atualizadas com sucesso');
  }
}
