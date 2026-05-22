import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus,
  Param, ParseUUIDPipe, Post, Put, Query, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../iam/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../iam/auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../iam/users/enums/user-role.enum';
import { GeoService } from './geo.service';
import { GeoRunnerService } from './geo-runner.service';
import { CreateQueryDto, UpdateQueryDto } from './dto/create-query.dto';
import { CreateMentionDto } from './dto/create-mention.dto';
import { CreateCompetitorDto, UpdateCompetitorDto } from './dto/create-competitor.dto';
import { CreateVisibilityScoreDto } from './dto/create-visibility-score.dto';
import { ResponseDto } from '../../common/dto/response.dto';

const GEO_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.DIRECTOR,
  UserRole.MANAGER,
  UserRole.TECHNICAL,
  UserRole.WRITER,
];

@ApiTags('geo')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('geo')
export class GeoController {
  constructor(
    private readonly geo: GeoService,
    private readonly runner: GeoRunnerService,
  ) {}

  // ─── Runner (automação LLM) ───────────────────────────────────────────────

  @Post('run-all')
  @Roles(UserRole.SUPER_ADMIN, UserRole.DIRECTOR)
  @HttpCode(HttpStatus.OK)
  async runAll() {
    const result = await this.runner.runAll();
    return new ResponseDto(result, 'GEO run iniciado para todos os clientes');
  }

  @Post('clients/:clientId/run')
  @Roles(...GEO_ROLES)
  @HttpCode(HttpStatus.OK)
  async runClient(@Param('clientId', ParseUUIDPipe) clientId: string) {
    const result = await this.runner.runForClient(clientId);
    return new ResponseDto(result, 'GEO run concluído');
  }

  // ─── Platforms ────────────────────────────────────────────────────────────

  @Get('platforms')
  @Roles(...GEO_ROLES)
  async listPlatforms() {
    return new ResponseDto(await this.geo.listPlatforms());
  }

  // ─── Overview ─────────────────────────────────────────────────────────────

  @Get('clients/:clientId/overview')
  @Roles(...GEO_ROLES)
  async getOverview(@Param('clientId', ParseUUIDPipe) clientId: string) {
    return new ResponseDto(await this.geo.getOverview(clientId));
  }

  // ─── Queries / Prompts ────────────────────────────────────────────────────

  @Get('clients/:clientId/queries')
  @Roles(...GEO_ROLES)
  async listQueries(@Param('clientId', ParseUUIDPipe) clientId: string) {
    return new ResponseDto(await this.geo.listQueries(clientId));
  }

  @Post('clients/:clientId/queries')
  @Roles(...GEO_ROLES)
  @HttpCode(HttpStatus.CREATED)
  async createQuery(
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Body() dto: CreateQueryDto,
    @CurrentUser('id') userId: string,
  ) {
    return new ResponseDto(await this.geo.createQuery(clientId, dto, userId));
  }

  @Put('clients/:clientId/queries/:id')
  @Roles(...GEO_ROLES)
  async updateQuery(
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateQueryDto,
  ) {
    return new ResponseDto(await this.geo.updateQuery(clientId, id, dto));
  }

  @Delete('clients/:clientId/queries/:id')
  @Roles(...GEO_ROLES)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteQuery(
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.geo.deleteQuery(clientId, id);
  }

  // ─── Mentions ─────────────────────────────────────────────────────────────

  @Get('clients/:clientId/mentions')
  @Roles(...GEO_ROLES)
  @ApiQuery({ name: 'platform_id', required: false })
  @ApiQuery({ name: 'sentiment', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  async listMentions(
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Query('platform_id') platform_id?: string,
    @Query('sentiment') sentiment?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const data = await this.geo.listMentions(clientId, {
      platform_id,
      sentiment,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
    return new ResponseDto(data);
  }

  @Post('clients/:clientId/mentions')
  @Roles(...GEO_ROLES)
  @HttpCode(HttpStatus.CREATED)
  async createMention(
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Body() dto: CreateMentionDto,
    @CurrentUser('id') userId: string,
  ) {
    return new ResponseDto(await this.geo.createMention(clientId, dto, userId));
  }

  @Delete('clients/:clientId/mentions/:id')
  @Roles(...GEO_ROLES)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteMention(
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.geo.deleteMention(clientId, id);
  }

  // ─── Sources ──────────────────────────────────────────────────────────────

  @Get('clients/:clientId/sources')
  @Roles(...GEO_ROLES)
  async listSources(@Param('clientId', ParseUUIDPipe) clientId: string) {
    return new ResponseDto(await this.geo.listSources(clientId));
  }

  // ─── Competitors ──────────────────────────────────────────────────────────

  @Get('clients/:clientId/competitors')
  @Roles(...GEO_ROLES)
  async listCompetitors(@Param('clientId', ParseUUIDPipe) clientId: string) {
    return new ResponseDto(await this.geo.listCompetitors(clientId));
  }

  @Post('clients/:clientId/competitors')
  @Roles(...GEO_ROLES)
  @HttpCode(HttpStatus.CREATED)
  async createCompetitor(
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Body() dto: CreateCompetitorDto,
  ) {
    return new ResponseDto(await this.geo.createCompetitor(clientId, dto));
  }

  @Put('clients/:clientId/competitors/:id')
  @Roles(...GEO_ROLES)
  async updateCompetitor(
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCompetitorDto,
  ) {
    return new ResponseDto(await this.geo.updateCompetitor(clientId, id, dto));
  }

  @Delete('clients/:clientId/competitors/:id')
  @Roles(...GEO_ROLES)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteCompetitor(
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.geo.deleteCompetitor(clientId, id);
  }

  // ─── Scores / Timeline ────────────────────────────────────────────────────

  @Get('clients/:clientId/scores')
  @Roles(...GEO_ROLES)
  async listScores(@Param('clientId', ParseUUIDPipe) clientId: string) {
    return new ResponseDto(await this.geo.listScores(clientId));
  }

  @Post('clients/:clientId/scores')
  @Roles(UserRole.SUPER_ADMIN, UserRole.DIRECTOR, UserRole.MANAGER, UserRole.TECHNICAL)
  @HttpCode(HttpStatus.CREATED)
  async upsertScore(
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Body() dto: CreateVisibilityScoreDto,
  ) {
    return new ResponseDto(await this.geo.upsertScore(clientId, dto));
  }

  @Get('clients/:clientId/timeline')
  @Roles(...GEO_ROLES)
  async getTimeline(@Param('clientId', ParseUUIDPipe) clientId: string) {
    return new ResponseDto(await this.geo.getTimeline(clientId));
  }
}
