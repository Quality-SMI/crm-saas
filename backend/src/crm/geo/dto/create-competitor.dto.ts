import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateCompetitorDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  competitor_name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  competitor_domain?: string;
}

export class UpdateCompetitorDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  competitor_name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  competitor_domain?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
