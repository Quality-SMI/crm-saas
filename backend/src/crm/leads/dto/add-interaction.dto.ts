import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InteractionType } from '../enums/interaction-type.enum';

export class AddInteractionDto {
  @ApiPropertyOptional({ enum: InteractionType })
  @IsOptional()
  @IsEnum(InteractionType)
  type?: InteractionType;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  description: string;
}
