import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { ClientStatus } from '../enums/client-status.enum';

export class QueryClientsDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: ClientStatus })
  @IsOptional()
  @IsEnum(ClientStatus)
  status?: ClientStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  seller_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  segment_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  service_type_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  company_size_id?: string;
}
