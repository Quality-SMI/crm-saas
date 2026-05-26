import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { Client } from '../clients/entities/client.entity';
import { BlogArticle, ArticleStatus } from './entities/blog-article.entity';
import { BlogAuthor } from './entities/blog-author.entity';
import { BlogCategory } from './entities/blog-category.entity';
import { BlogTag } from './entities/blog-tag.entity';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { CreateAuthorDto } from './dto/create-author.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CreateTagDto } from './dto/create-tag.dto';

@Injectable()
export class BlogService {
  constructor(
    @InjectRepository(BlogArticle)
    private readonly articleRepo: Repository<BlogArticle>,
    @InjectRepository(BlogAuthor)
    private readonly authorRepo: Repository<BlogAuthor>,
    @InjectRepository(BlogCategory)
    private readonly categoryRepo: Repository<BlogCategory>,
    @InjectRepository(BlogTag)
    private readonly tagRepo: Repository<BlogTag>,
    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,
  ) {}

  // ─── Articles ────────────────────────────────────────────────────────────────

  findArticlesByClient(clientId: string): Promise<BlogArticle[]> {
    return this.articleRepo.find({
      where: { client_id: clientId, deleted_at: IsNull() },
      select: {
        id: true,
        client_id: true,
        author_id: true,
        category_id: true,
        title: true,
        slug: true,
        description: true,
        image: true,
        status: true,
        date_published: true,
        created_by: true,
        created_at: true,
        updated_at: true,
      },
      relations: { author: true, category: true, tags: true },
      order: { created_at: 'DESC' },
    });
  }

  async findArticleById(clientId: string, id: string): Promise<BlogArticle> {
    const article = await this.articleRepo.findOne({
      where: { id, client_id: clientId, deleted_at: IsNull() },
      relations: { author: true, category: true, tags: true },
    });
    if (!article) throw new NotFoundException('Artigo não encontrado');
    return article;
  }

  async createArticle(
    clientId: string,
    dto: CreateArticleDto,
    createdBy?: string,
  ): Promise<BlogArticle> {
    const tags = dto.tag_ids?.length
      ? await this.tagRepo.findBy({ id: In(dto.tag_ids) })
      : [];

    const article = this.articleRepo.create({
      client_id: clientId,
      title: dto.title,
      slug: dto.slug,
      description: dto.description ?? null,
      image: dto.image ?? null,
      content: dto.content ?? null,
      raw_content: dto.raw_content ?? null,
      status: dto.status ?? ArticleStatus.DRAFT,
      author_id: dto.author_id ?? null,
      category_id: dto.category_id ?? null,
      created_by: createdBy ?? null,
      tags,
    });

    if (article.status === ArticleStatus.PUBLISHED && !article.date_published) {
      article.date_published = new Date();
    }

    const saved = await this.articleRepo.save(article);

    if (saved.status === ArticleStatus.PUBLISHED) {
      await this.triggerDeploy(clientId);
    }

    return saved;
  }

  async updateArticle(
    clientId: string,
    id: string,
    dto: UpdateArticleDto,
  ): Promise<BlogArticle> {
    const article = await this.articleRepo.findOne({
      where: { id, client_id: clientId, deleted_at: IsNull() },
      relations: { tags: true },
    });
    if (!article) throw new NotFoundException('Artigo não encontrado');

    const previousStatus = article.status;

    if (dto.tag_ids !== undefined) {
      article.tags = dto.tag_ids.length
        ? await this.tagRepo.findBy({ id: In(dto.tag_ids) })
        : [];
    }

    const { tag_ids: _tagIds, ...rest } = dto;
    Object.assign(article, rest);

    if (article.status === ArticleStatus.PUBLISHED && !article.date_published) {
      article.date_published = new Date();
    }

    const saved = await this.articleRepo.save(article);

    const justPublished =
      previousStatus !== ArticleStatus.PUBLISHED &&
      saved.status === ArticleStatus.PUBLISHED;

    if (justPublished) {
      await this.triggerDeploy(clientId);
    }

    return saved;
  }

  async removeArticle(clientId: string, id: string): Promise<void> {
    const article = await this.articleRepo.findOne({
      where: { id, client_id: clientId, deleted_at: IsNull() },
    });
    if (!article) throw new NotFoundException('Artigo não encontrado');

    const wasPublished = article.status === ArticleStatus.PUBLISHED;

    await this.articleRepo.softDelete(id);

    if (wasPublished) {
      await this.triggerDeploy(clientId);
    }
  }

  // ─── Authors ─────────────────────────────────────────────────────────────────

  findAuthorsByClient(clientId: string): Promise<BlogAuthor[]> {
    return this.authorRepo.find({
      where: { client_id: clientId, deleted_at: IsNull() },
      order: { name: 'ASC' },
    });
  }

  async createAuthor(
    clientId: string,
    dto: CreateAuthorDto,
  ): Promise<BlogAuthor> {
    const author = this.authorRepo.create({ ...dto, client_id: clientId });
    return this.authorRepo.save(author);
  }

  async removeAuthor(id: string): Promise<void> {
    const author = await this.authorRepo.findOne({
      where: { id, deleted_at: IsNull() },
    });
    if (!author) throw new NotFoundException('Autor não encontrado');
    await this.authorRepo.softDelete(id);
  }

  // ─── Categories ──────────────────────────────────────────────────────────────

  findCategoriesByClient(clientId: string): Promise<BlogCategory[]> {
    return this.categoryRepo.find({
      where: { client_id: clientId, deleted_at: IsNull() },
      order: { name: 'ASC' },
    });
  }

  async createCategory(
    clientId: string,
    dto: CreateCategoryDto,
  ): Promise<BlogCategory> {
    const category = this.categoryRepo.create({ ...dto, client_id: clientId });
    return this.categoryRepo.save(category);
  }

  async removeCategory(id: string): Promise<void> {
    await this.categoryRepo.softDelete(id);
  }

  // ─── Tags ────────────────────────────────────────────────────────────────────

  findTagsByClient(clientId: string): Promise<BlogTag[]> {
    return this.tagRepo.find({
      where: { client_id: clientId, deleted_at: IsNull() },
      order: { name: 'ASC' },
    });
  }

  async createTag(clientId: string, dto: CreateTagDto): Promise<BlogTag> {
    const tag = this.tagRepo.create({ ...dto, client_id: clientId });
    return this.tagRepo.save(tag);
  }

  async removeTag(id: string): Promise<void> {
    await this.tagRepo.softDelete(id);
  }

  // ─── Webhook ─────────────────────────────────────────────────────────────────

  // ─── Public API (consumed by client sites via API Key) ────────────────────────

  findPublishedArticles(clientId: string): Promise<BlogArticle[]> {
    return this.articleRepo.find({
      where: {
        client_id: clientId,
        status: ArticleStatus.PUBLISHED,
        deleted_at: IsNull(),
      },
      select: {
        id: true,
        client_id: true,
        title: true,
        slug: true,
        description: true,
        image: true,
        date_published: true,
        created_at: true,
      },
      relations: { author: true, category: true, tags: true },
      order: { date_published: 'DESC' },
    });
  }

  findPublishedArticleBySlug(
    clientId: string,
    slug: string,
  ): Promise<BlogArticle | null> {
    return this.articleRepo.findOne({
      where: {
        client_id: clientId,
        slug,
        status: ArticleStatus.PUBLISHED,
        deleted_at: IsNull(),
      },
      relations: { author: true, category: true, tags: true },
    });
  }

  findPublishedCategories(clientId: string): Promise<BlogCategory[]> {
    return this.categoryRepo.find({
      where: { client_id: clientId, deleted_at: IsNull() },
      order: { name: 'ASC' },
    });
  }

  findPublishedTags(clientId: string): Promise<BlogTag[]> {
    return this.tagRepo.find({
      where: { client_id: clientId, deleted_at: IsNull() },
      order: { name: 'ASC' },
    });
  }

  private async triggerDeploy(clientId: string): Promise<void> {
    const client = await this.clientRepo.findOne({ where: { id: clientId } });
    if (!client?.webhook_deploy) return;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      await fetch(client.webhook_deploy, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${process.env.WEBHOOK_VPS_DEPLOY ?? ''}`,
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);
    } catch (_) {
      // silencia erro — rebuild é best effort
    }
  }
}
