import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateAppointmentDto {
  @ApiProperty()
  @IsUUID()
  lead_id: string;

  @ApiProperty({
    description: 'ISO 8601 datetime ex: 2026-05-20T14:00:00-03:00',
  })
  @IsDateString()
  scheduled_at: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assigned_to_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(15)
  duration_minutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
