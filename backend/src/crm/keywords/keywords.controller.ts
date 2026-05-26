import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus,
  Param, ParseUUIDPipe, Patch, Post, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../iam/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../iam/auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermission } from '../../common/decorators/permission.decorator';
import { Permission } from '../../iam/permissions/enums/permission.enum';
import { UserRole } from '../../iam/users/enums/user-role.enum';
import { KeywordsService } from './keywords.service';
import { BulkCreateKeywordsDto, CreateKeywordCategoryDto, CreateKeywordDto, UpdateKeywordDto } from './dto/create-keyword.dto';
import { ResponseDto } from '../../common/dto/response.dto';

const ALL_ROLES = [
  UserRole.SUPER_ADMIN, UserRole.DIRECTOR, UserRole.MANAGER,
  UserRole.SALES, UserRole.TECHNICAL, UserRole.WRITER,
];

@ApiTags('keywords')
@RequirePermission(Permission.KEYWORDS_ACCESS)
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('keywords')
export class KeywordsController {
  constructor(private readonly svc: KeywordsService) {}

  @Get('clients/:clientId')
  @Roles(...ALL_ROLES)
  async list(@Param('clientId', ParseUUIDPipe) clientId: string) {
    return new ResponseDto(await this.svc.findByClient(clientId));
  }

  @Post('clients/:clientId')
  @HttpCode(HttpStatus.CREATED)
  @Roles(...ALL_ROLES)
  async create(
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Body() dto: CreateKeywordDto,
  ) {
    return new ResponseDto(await this.svc.create(clientId, dto), 'Palavra-chave criada');
  }

  @Post('clients/:clientId/bulk')
  @HttpCode(HttpStatus.CREATED)
  @Roles(...ALL_ROLES)
  async bulkCreate(
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Body() dto: BulkCreateKeywordsDto,
  ) {
    return new ResponseDto(await this.svc.bulkCreate(clientId, dto), 'Palavras-chave criadas');
  }

  @Patch(':id')
  @Roles(...ALL_ROLES)
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateKeywordDto) {
    return new ResponseDto(await this.svc.update(id, dto));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.SUPER_ADMIN, UserRole.DIRECTOR, UserRole.MANAGER, UserRole.SALES)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.svc.remove(id);
  }

  @Get('clients/:clientId/categories')
  @Roles(...ALL_ROLES)
  async listCategories(@Param('clientId', ParseUUIDPipe) clientId: string) {
    return new ResponseDto(await this.svc.findCategories(clientId));
  }

  @Post('clients/:clientId/categories')
  @HttpCode(HttpStatus.CREATED)
  @Roles(...ALL_ROLES)
  async createCategory(
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Body() dto: CreateKeywordCategoryDto,
  ) {
    return new ResponseDto(await this.svc.createCategory(clientId, dto), 'Categoria criada');
  }

  @Delete('categories/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.SUPER_ADMIN, UserRole.DIRECTOR, UserRole.MANAGER)
  async removeCategory(@Param('id', ParseUUIDPipe) id: string) {
    await this.svc.removeCategory(id);
  }
}
