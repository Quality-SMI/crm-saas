import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
  IsArray,
  IsBoolean,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ClientStatus } from '../enums/client-status.enum';
import { BillingType } from '../enums/billing-type.enum';

export class ClientServiceDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiProperty()
  @IsUUID()
  service_type_id: string;

  @ApiPropertyOptional({ enum: ['ACTIVE', 'PAUSED', 'CANCELLED'] })
  @IsOptional()
  @IsString()
  status?: 'ACTIVE' | 'PAUSED' | 'CANCELLED';

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(1)
  contract_months?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  management_fee?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  media_budget?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  monthly_value?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  one_time_value?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  renewal_count?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  started_at?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}

export class EmailDto {
  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  label?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  is_primary?: boolean;
}

export class PhoneDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  label?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  is_primary?: boolean;
}

export class CreateClientDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  company_name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  legal_name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cnpj?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  domain: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contact_name?: string;

  @ApiPropertyOptional({ enum: ClientStatus })
  @IsOptional()
  @IsEnum(ClientStatus)
  status?: ClientStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  segment_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  market_segment_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  business_model_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  company_size_id?: string;

  @ApiPropertyOptional({ type: [String], description: 'Array de tag IDs (UUID)' })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  tag_ids?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  seller_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  technical_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  writer_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  service_type_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  service_subtype_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  contract_keywords_qty?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  contracted_at?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  monthly_value?: number;

  @ApiPropertyOptional({ enum: BillingType })
  @IsOptional()
  @IsEnum(BillingType)
  billing_type?: BillingType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  first_payment_date?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(1)
  due_day?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(1)
  installments_qty?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  hosting_type_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  zip_code?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  street?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  street_number?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  neighborhood?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2)
  state?: string;

  @ApiPropertyOptional({ type: [String], description: 'Palavras-chave contratadas pelo cliente' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  contracted_keywords?: string[];

  @ApiPropertyOptional({ description: 'URL do webhook para rebuild do site do cliente' })
  @IsOptional()
  @IsString()
  webhook_deploy?: string;

  @ApiPropertyOptional({ description: 'ID do projeto no Microsoft Clarity' })
  @IsOptional()
  @IsString()
  clarity_project_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ type: [EmailDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EmailDto)
  emails?: EmailDto[];

  @ApiPropertyOptional({ type: [PhoneDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PhoneDto)
  phones?: PhoneDto[];

  @ApiPropertyOptional({ type: [ClientServiceDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ClientServiceDto)
  services?: ClientServiceDto[];
}
