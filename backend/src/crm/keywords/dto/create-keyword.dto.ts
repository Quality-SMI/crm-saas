import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateKeywordDto {
  @ApiPropertyOptional() @IsString() keyword: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) slug?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() category_id?: string;
}

export class BulkCreateKeywordsDto {
  @ApiPropertyOptional({ type: [String] })
  @IsString({ each: true })
  keywords: string[];

  @ApiPropertyOptional() @IsOptional() @IsUUID() category_id?: string;
}

export class UpdateKeywordDto {
  @ApiPropertyOptional() @IsOptional() @IsString() keyword?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) slug?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() category_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() is_active?: boolean;
}

export class CreateKeywordCategoryDto {
  @ApiPropertyOptional() @IsString() name: string;
}
