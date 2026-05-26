import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export enum MentionTypeDto {
  DIRECT = 'DIRECT',
  INDIRECT = 'INDIRECT',
  CITATION = 'CITATION',
  RECOMMENDATION = 'RECOMMENDATION',
}

export enum SentimentDto {
  POSITIVE = 'POSITIVE',
  NEUTRAL = 'NEUTRAL',
  NEGATIVE = 'NEGATIVE',
}

export class CreateMentionDto {
  @ApiProperty()
  @IsUUID()
  platform_id: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  query_id?: string;

  @ApiPropertyOptional({ enum: MentionTypeDto })
  @IsOptional()
  @IsEnum(MentionTypeDto)
  mention_type?: MentionTypeDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  response_excerpt?: string;

  @ApiPropertyOptional({ enum: SentimentDto })
  @IsOptional()
  @IsEnum(SentimentDto)
  sentiment?: SentimentDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(-1)
  @Max(1)
  sentiment_score?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(1)
  ranking_position?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  visibility_impact?: number;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  urls_cited?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  checked_at?: string;
}
