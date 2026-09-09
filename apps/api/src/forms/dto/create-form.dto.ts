import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateFormDto {
  @IsUUID()
  campaignId!: string;

  @IsUUID()
  templateId!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  successMessage?: string;
}
