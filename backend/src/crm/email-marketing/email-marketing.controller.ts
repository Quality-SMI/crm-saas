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
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../iam/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../iam/auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../iam/users/enums/user-role.enum';
import { ResponseDto } from '../../common/dto/response.dto';
import { EmailMarketingService } from './email-marketing.service';
import { EmailSendingService } from './email-sending.service';
import {
  CreateCampaignBodyDto,
  UpdateCampaignBodyDto,
  CreateTemplateBodyDto,
  UpdateTemplateBodyDto,
  SendCampaignBodyDto,
} from './dto/email-marketing.dto';

const MARKETING_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.DIRECTOR,
  UserRole.MANAGER,
];

@ApiTags('email-marketing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('email-marketing')
export class EmailMarketingController {
  constructor(
    private readonly emailMarketingService: EmailMarketingService,
    private readonly emailSendingService: EmailSendingService,
  ) {}

  // ─── Campaigns ───────────────────────────────────────────────────────────────

  @Get('campaigns')
  @Roles(...MARKETING_ROLES)
  async listCampaigns(@CurrentUser() user: any) {
    const data = await this.emailMarketingService.listCampaigns(user.id);
    return new ResponseDto(data);
  }

  @Post('campaigns')
  @HttpCode(HttpStatus.CREATED)
  @Roles(...MARKETING_ROLES)
  async createCampaign(
    @Body() dto: CreateCampaignBodyDto,
    @CurrentUser() user: any,
  ) {
    const data = await this.emailMarketingService.createCampaign(dto, user.id);
    return new ResponseDto(data, 'Campanha criada com sucesso');
  }

  @Get('campaigns/:id')
  @Roles(...MARKETING_ROLES)
  async getCampaign(@Param('id', ParseUUIDPipe) id: string) {
    const data = await this.emailMarketingService.getCampaign(id);
    return new ResponseDto(data);
  }

  @Patch('campaigns/:id')
  @Roles(...MARKETING_ROLES)
  async updateCampaign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCampaignBodyDto,
  ) {
    const data = await this.emailMarketingService.updateCampaign(id, dto);
    return new ResponseDto(data, 'Campanha atualizada com sucesso');
  }

  @Delete('campaigns/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(...MARKETING_ROLES)
  async deleteCampaign(@Param('id', ParseUUIDPipe) id: string) {
    await this.emailMarketingService.deleteCampaign(id);
  }

  @Post('campaigns/:id/send')
  @HttpCode(HttpStatus.ACCEPTED)
  @Roles(...MARKETING_ROLES)
  async sendCampaign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SendCampaignBodyDto,
  ) {
    this.emailSendingService.sendCampaign(id, body).catch(() => {});
    return new ResponseDto({ message: 'Envio iniciado' });
  }

  @Get('campaigns/:id/recipients')
  @Roles(...MARKETING_ROLES)
  async getCampaignRecipients(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const data = await this.emailMarketingService.getCampaignRecipients(id, {
      limit: limit ? Number(limit) : 50,
      offset: offset ? Number(offset) : 0,
    });
    return new ResponseDto(data);
  }

  @Get('campaigns/:id/stats')
  @Roles(...MARKETING_ROLES)
  async getCampaignStats(@Param('id', ParseUUIDPipe) id: string) {
    const data = await this.emailMarketingService.getCampaignStats(id);
    return new ResponseDto(data);
  }

  // ─── Audience ─────────────────────────────────────────────────────────────────

  @Get('audience/preview')
  @Roles(...MARKETING_ROLES)
  async previewAudience(
    @Query('audience_type') audienceType: string = 'all_clients',
    @Query('filters') filtersRaw?: string,
  ) {
    let filters: Record<string, unknown> = {};
    if (filtersRaw) {
      try {
        filters = JSON.parse(filtersRaw);
      } catch {
        filters = {};
      }
    }
    const audience = await this.emailMarketingService.previewAudience(audienceType, filters);
    return new ResponseDto(audience);
  }

  // ─── Templates ────────────────────────────────────────────────────────────────

  @Get('templates')
  @Roles(...MARKETING_ROLES)
  async listTemplates() {
    const data = await this.emailMarketingService.listTemplates();
    return new ResponseDto(data);
  }

  @Post('templates')
  @HttpCode(HttpStatus.CREATED)
  @Roles(...MARKETING_ROLES)
  async createTemplate(
    @Body() dto: CreateTemplateBodyDto,
    @CurrentUser() user: any,
  ) {
    const data = await this.emailMarketingService.createTemplate(dto, user.id);
    return new ResponseDto(data, 'Template criado com sucesso');
  }

  @Patch('templates/:id')
  @Roles(...MARKETING_ROLES)
  async updateTemplate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTemplateBodyDto,
  ) {
    const data = await this.emailMarketingService.updateTemplate(id, dto);
    return new ResponseDto(data, 'Template atualizado com sucesso');
  }

  @Delete('templates/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(...MARKETING_ROLES)
  async deleteTemplate(@Param('id', ParseUUIDPipe) id: string) {
    await this.emailMarketingService.deleteTemplate(id);
  }

  // ─── Unsubscribes ─────────────────────────────────────────────────────────────

  @Get('unsubscribes')
  @Roles(...MARKETING_ROLES)
  async listUnsubscribes() {
    const data = await this.emailMarketingService.listUnsubscribes();
    return new ResponseDto(data);
  }

  @Delete('unsubscribes/:email')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(...MARKETING_ROLES)
  async removeUnsubscribe(@Param('email') email: string) {
    await this.emailMarketingService.removeUnsubscribe(decodeURIComponent(email));
  }
}
