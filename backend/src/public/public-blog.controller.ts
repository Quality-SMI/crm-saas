import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ApiKeysService } from '../crm/api-keys/api-keys.service';
import { BlogService } from '../crm/blog/blog.service';

@ApiTags('public')
@Controller('public/blog')
export class PublicBlogController {
  constructor(
    private readonly apiKeysSvc: ApiKeysService,
    private readonly blogSvc: BlogService,
  ) {}

  private async resolveClient(apiKey: string): Promise<string> {
    const record = await this.apiKeysSvc.findByKey(apiKey);
    if (!record) throw new NotFoundException('API Key inválida ou inativa');
    return record.client_id;
  }

  @Get()
  @ApiOperation({
    summary: 'Lista artigos publicados — autenticação via ?apiKey=',
  })
  @ApiQuery({ name: 'apiKey', required: true })
  async listArticles(@Query('apiKey') apiKey: string) {
    const clientId = await this.resolveClient(apiKey);
    return this.blogSvc.findPublishedArticles(clientId);
  }

  @Get('categories')
  @ApiQuery({ name: 'apiKey', required: true })
  async listCategories(@Query('apiKey') apiKey: string) {
    const clientId = await this.resolveClient(apiKey);
    return this.blogSvc.findPublishedCategories(clientId);
  }

  @Get('tags')
  @ApiQuery({ name: 'apiKey', required: true })
  async listTags(@Query('apiKey') apiKey: string) {
    const clientId = await this.resolveClient(apiKey);
    return this.blogSvc.findPublishedTags(clientId);
  }

  @Get(':slug')
  @ApiQuery({ name: 'apiKey', required: true })
  async getArticle(
    @Query('apiKey') apiKey: string,
    @Param('slug') slug: string,
  ) {
    const clientId = await this.resolveClient(apiKey);
    const article = await this.blogSvc.findPublishedArticleBySlug(
      clientId,
      slug,
    );
    if (!article) throw new NotFoundException('Artigo não encontrado');
    return article;
  }
}
