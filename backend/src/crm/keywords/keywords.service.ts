import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { ClientKeyword } from './entities/client-keyword.entity';
import { KeywordCategory } from './entities/keyword-category.entity';
import { BulkCreateKeywordsDto, CreateKeywordCategoryDto, CreateKeywordDto, UpdateKeywordDto } from './dto/create-keyword.dto';

@Injectable()
export class KeywordsService {
  constructor(
    @InjectRepository(ClientKeyword)
    private readonly kwRepo: Repository<ClientKeyword>,
    @InjectRepository(KeywordCategory)
    private readonly catRepo: Repository<KeywordCategory>,
  ) {}

  findByClient(clientId: string): Promise<ClientKeyword[]> {
    return this.kwRepo.find({
      where: { client_id: clientId, deleted_at: IsNull() },
      relations: { category: true },
      order: { created_at: 'ASC' },
    });
  }

  async create(clientId: string, dto: CreateKeywordDto): Promise<ClientKeyword> {
    const slug = dto.slug ?? this.generateSlug(dto.keyword);
    const kw = this.kwRepo.create({ ...dto, slug, client_id: clientId });
    return this.kwRepo.save(kw);
  }

  async bulkCreate(clientId: string, dto: BulkCreateKeywordsDto): Promise<ClientKeyword[]> {
    const entries = dto.keywords
      .map((k) => k.trim())
      .filter(Boolean)
      .map((keyword) =>
        this.kwRepo.create({
          keyword,
          slug: this.generateSlug(keyword),
          category_id: dto.category_id ?? null,
          client_id: clientId,
        }),
      );
    return this.kwRepo.save(entries);
  }

  async update(id: string, dto: UpdateKeywordDto): Promise<ClientKeyword> {
    const kw = await this.kwRepo.findOne({ where: { id, deleted_at: IsNull() } });
    if (!kw) throw new NotFoundException('Palavra-chave não encontrada');
    Object.assign(kw, dto);
    return this.kwRepo.save(kw);
  }

  async remove(id: string): Promise<void> {
    const kw = await this.kwRepo.findOne({ where: { id, deleted_at: IsNull() } });
    if (!kw) throw new NotFoundException('Palavra-chave não encontrada');
    await this.kwRepo.softDelete(id);
  }

  findCategories(clientId: string): Promise<KeywordCategory[]> {
    return this.catRepo.find({
      where: { client_id: clientId, deleted_at: IsNull() },
      order: { name: 'ASC' },
    });
  }

  async createCategory(clientId: string, dto: CreateKeywordCategoryDto): Promise<KeywordCategory> {
    const cat = this.catRepo.create({ ...dto, client_id: clientId });
    return this.catRepo.save(cat);
  }

  async removeCategory(id: string): Promise<void> {
    await this.catRepo.softDelete(id);
  }

  private generateSlug(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/\s+/g, '-')
      .replace(/[^\w-]+/g, '')
      .replace(/--+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60);
  }
}
