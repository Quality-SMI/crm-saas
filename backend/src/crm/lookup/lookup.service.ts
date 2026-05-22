import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { Segment } from './entities/segment.entity';
import { ServiceType } from './entities/service-type.entity';
import { ServiceSubtype } from './entities/service-subtype.entity';
import { HostingType } from './entities/hosting-type.entity';
import { MarketSegment } from './entities/market-segment.entity';
import { BusinessModel } from './entities/business-model.entity';
import { CompanySize } from './entities/company-size.entity';
import { Tag } from './entities/tag.entity';

@Injectable()
export class LookupService {
  constructor(
    @InjectRepository(Segment)
    private readonly segmentRepo: Repository<Segment>,
    @InjectRepository(ServiceType)
    private readonly serviceTypeRepo: Repository<ServiceType>,
    @InjectRepository(ServiceSubtype)
    private readonly serviceSubtypeRepo: Repository<ServiceSubtype>,
    @InjectRepository(HostingType)
    private readonly hostingTypeRepo: Repository<HostingType>,
    @InjectRepository(MarketSegment)
    private readonly marketSegmentRepo: Repository<MarketSegment>,
    @InjectRepository(BusinessModel)
    private readonly businessModelRepo: Repository<BusinessModel>,
    @InjectRepository(CompanySize)
    private readonly companySizeRepo: Repository<CompanySize>,
    @InjectRepository(Tag)
    private readonly tagRepo: Repository<Tag>,
  ) {}

  findSegments() {
    return this.segmentRepo.find({ order: { name: 'ASC' } });
  }

  findServiceTypes() {
    return this.serviceTypeRepo.find({ order: { name: 'ASC' } });
  }

  findServiceSubtypes(serviceTypeId?: string) {
    return this.serviceSubtypeRepo.find({
      where: serviceTypeId ? { service_type_id: serviceTypeId } : {},
      order: { name: 'ASC' },
    });
  }

  findHostingTypes() {
    return this.hostingTypeRepo.find({ order: { name: 'ASC' } });
  }

  findMarketSegments() {
    return this.marketSegmentRepo.find({ order: { name: 'ASC' } });
  }

  findBusinessModels() {
    return this.businessModelRepo.find({ order: { name: 'ASC' } });
  }

  findCompanySizes() {
    return this.companySizeRepo.find({ order: { name: 'ASC' } });
  }

  findTags(search?: string) {
    return this.tagRepo.find({
      where: search ? { name: ILike(`%${search}%`) } : {},
      order: { name: 'ASC' },
      take: 50,
    });
  }

  async findOrCreateTag(name: string): Promise<Tag> {
    const normalized = name.trim().toLowerCase();
    let tag = await this.tagRepo.findOne({ where: { name: ILike(normalized) } });
    if (!tag) {
      tag = await this.tagRepo.save(this.tagRepo.create({ name: normalized }));
    }
    return tag;
  }
}
