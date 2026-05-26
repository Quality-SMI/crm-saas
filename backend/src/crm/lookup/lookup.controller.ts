import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../iam/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../iam/auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../iam/users/enums/user-role.enum';
import { LookupService } from './lookup.service';

// Dados de referência (segmentos, tipos de serviço etc.) — disponíveis para todos os
// usuários internos autenticados; CLIENT_PORTAL não tem acesso ao backoffice.
const ALL_INTERNAL = [
  UserRole.SUPER_ADMIN, UserRole.DIRECTOR, UserRole.MANAGER,
  UserRole.FINANCIAL, UserRole.TECHNICAL, UserRole.WRITER, UserRole.SALES,
];

@ApiTags('lookup')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ALL_INTERNAL)
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
