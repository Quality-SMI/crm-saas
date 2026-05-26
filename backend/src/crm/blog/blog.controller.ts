import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../iam/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../iam/auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermission } from '../../common/decorators/permission.decorator';
import { Permission } from '../../iam/permissions/enums/permission.enum';
import { UserRole } from '../../iam/users/enums/user-role.enum';
import { BlogService } from './blog.service';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { CreateAuthorDto } from './dto/create-author.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CreateTagDto } from './dto/create-tag.dto';
import { ResponseDto } from '../../common/dto/response.dto';

const ALL_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.DIRECTOR,
  UserRole.MANAGER,
  UserRole.SALES,
  UserRole.TECHNICAL,
  UserRole.WRITER,
];

const MANAGER_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.DIRECTOR,
  UserRole.MANAGER,
];

@ApiTags('blog')
@RequirePermission(Permission.BLOG_ACCESS)
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('blog')
export class BlogController {
  constructor(private readonly svc: BlogService) {}

  // ─── Articles ───────────────────────────────────────────────────────────────

  @Get('clients/:clientId')
  @Roles(...ALL_ROLES)
  async listArticles(@Param('clientId', ParseUUIDPipe) clientId: string) {
    return new ResponseDto(await this.svc.findArticlesByClient(clientId));
  }

  @Get('clients/:clientId/articles/:id')
  @Roles(...ALL_ROLES)
  async findArticle(
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return new ResponseDto(await this.svc.findArticleById(clientId, id));
  }

  @Post('clients/:clientId')
  @HttpCode(HttpStatus.CREATED)
  @Roles(...MANAGER_ROLES)
  async createArticle(
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Body() dto: CreateArticleDto,
    @Request() req: { user?: { id?: string } },
  ) {
    return new ResponseDto(
      await this.svc.createArticle(clientId, dto, req.user?.id),
      'Artigo criado',
    );
  }

  @Patch('clients/:clientId/articles/:id')
  @Roles(...MANAGER_ROLES)
  async updateArticle(
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateArticleDto,
  ) {
    return new ResponseDto(await this.svc.updateArticle(clientId, id, dto));
  }

  @Delete('clients/:clientId/articles/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(...MANAGER_ROLES)
  async removeArticle(
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.svc.removeArticle(clientId, id);
  }

  // ─── Authors ────────────────────────────────────────────────────────────────

  @Get('clients/:clientId/authors')
  @Roles(...ALL_ROLES)
  async listAuthors(@Param('clientId', ParseUUIDPipe) clientId: string) {
    return new ResponseDto(await this.svc.findAuthorsByClient(clientId));
  }

  @Post('clients/:clientId/authors')
  @HttpCode(HttpStatus.CREATED)
  @Roles(...ALL_ROLES)
  async createAuthor(
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Body() dto: CreateAuthorDto,
  ) {
    return new ResponseDto(await this.svc.createAuthor(clientId, dto), 'Autor criado');
  }

  @Delete('authors/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(...MANAGER_ROLES)
  async removeAuthor(@Param('id', ParseUUIDPipe) id: string) {
    await this.svc.removeAuthor(id);
  }

  // ─── Categories ─────────────────────────────────────────────────────────────

  @Get('clients/:clientId/categories')
  @Roles(...ALL_ROLES)
  async listCategories(@Param('clientId', ParseUUIDPipe) clientId: string) {
    return new ResponseDto(await this.svc.findCategoriesByClient(clientId));
  }

  @Post('clients/:clientId/categories')
  @HttpCode(HttpStatus.CREATED)
  @Roles(...ALL_ROLES)
  async createCategory(
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Body() dto: CreateCategoryDto,
  ) {
    return new ResponseDto(
      await this.svc.createCategory(clientId, dto),
      'Categoria criada',
    );
  }

  @Delete('categories/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(...MANAGER_ROLES)
  async removeCategory(@Param('id', ParseUUIDPipe) id: string) {
    await this.svc.removeCategory(id);
  }

  // ─── Tags ───────────────────────────────────────────────────────────────────

  @Get('clients/:clientId/tags')
  @Roles(...ALL_ROLES)
  async listTags(@Param('clientId', ParseUUIDPipe) clientId: string) {
    return new ResponseDto(await this.svc.findTagsByClient(clientId));
  }

  @Post('clients/:clientId/tags')
  @HttpCode(HttpStatus.CREATED)
  @Roles(...ALL_ROLES)
  async createTag(
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Body() dto: CreateTagDto,
  ) {
    return new ResponseDto(await this.svc.createTag(clientId, dto), 'Tag criada');
  }

  @Delete('tags/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(...MANAGER_ROLES)
  async removeTag(@Param('id', ParseUUIDPipe) id: string) {
    await this.svc.removeTag(id);
  }
}
