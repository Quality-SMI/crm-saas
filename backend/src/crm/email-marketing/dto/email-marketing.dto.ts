import { IsString, IsOptional, IsObject, IsArray, IsInt, Min } from 'class-validator';

export class CreateCampaignBodyDto {
  @IsString()
  name!: string;

  @IsString()
  subject!: string;

  @IsOptional()
  @IsString()
  preview_text?: string;

  @IsString()
  html_body!: string;

  @IsOptional()
  @IsString()
  from_name?: string;

  @IsString()
  from_email!: string;

  @IsOptional()
  @IsString()
  reply_to?: string;

  @IsOptional()
  @IsString()
  audience_type?: string;

  @IsOptional()
  @IsObject()
  audience_filters?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  template_id?: string;

  @IsOptional()
  @IsString()
  scheduled_at?: string;

  @IsOptional()
  @IsArray()
  attachments?: { name: string; content: string; type: string }[];
}

export class UpdateCampaignBodyDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  preview_text?: string;

  @IsOptional()
  @IsString()
  html_body?: string;

  @IsOptional()
  @IsString()
  from_name?: string;

  @IsOptional()
  @IsString()
  from_email?: string;

  @IsOptional()
  @IsString()
  reply_to?: string;

  @IsOptional()
  @IsString()
  audience_type?: string;

  @IsOptional()
  @IsObject()
  audience_filters?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  template_id?: string;

  @IsOptional()
  @IsString()
  scheduled_at?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsArray()
  attachments?: { name: string; content: string; type: string }[];
}

export class CreateTemplateBodyDto {
  @IsString()
  name!: string;

  @IsString()
  subject!: string;

  @IsOptional()
  @IsString()
  preview_text?: string;

  @IsString()
  html_body!: string;

  @IsOptional()
  @IsString()
  category?: string;
}

export class UpdateTemplateBodyDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  preview_text?: string;

  @IsOptional()
  @IsString()
  html_body?: string;

  @IsOptional()
  @IsString()
  category?: string;
}

export class SendCampaignBodyDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  offset?: number;
}

export class SendSeoBlastBodyDto {
  @IsString()
  name!: string;

  @IsString()
  subject!: string;

  @IsOptional()
  @IsString()
  from_name?: string;

  @IsString()
  from_email!: string;

  @IsOptional()
  @IsString()
  reply_to?: string;

  @IsOptional()
  @IsString()
  audience_type?: string;

  @IsOptional()
  @IsString()
  template_id?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  offset?: number;
}
