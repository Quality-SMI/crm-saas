import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../iam/auth/guards/jwt-auth.guard';
import { LookupService } from './lookup.service';

@ApiTags('lookup')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('lookup')
export class LookupController {
  constructor(private readonly lookupService: LookupService) {}

  @Get('segments')
  findSegments() {
    return this.lookupService.findSegments();
  }

  @Get('service-types')
  findServiceTypes() {
    return this.lookupService.findServiceTypes();
  }

  @Get('service-subtypes')
  findServiceSubtypes(@Query('service_type_id') serviceTypeId?: string) {
    return this.lookupService.findServiceSubtypes(serviceTypeId);
  }

  @Get('hosting-types')
  findHostingTypes() {
    return this.lookupService.findHostingTypes();
  }

  @Get('market-segments')
  findMarketSegments() {
    return this.lookupService.findMarketSegments();
  }

  @Get('business-models')
  findBusinessModels() {
    return this.lookupService.findBusinessModels();
  }

  @Get('company-sizes')
  findCompanySizes() {
    return this.lookupService.findCompanySizes();
  }

  @Get('tags')
  findTags(@Query('search') search?: string) {
    return this.lookupService.findTags(search);
  }
}
