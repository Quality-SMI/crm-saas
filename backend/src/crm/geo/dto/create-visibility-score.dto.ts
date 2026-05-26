import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class CreateVisibilityScoreDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  platform_id?: string;

  @ApiProperty()
  @IsDateString()
  score_date: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  visibility_score?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  geo_score?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  mention_count?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(1)
  avg_ranking?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(-1)
  @Max(1)
  avg_sentiment?: number;
}
