import { IsBoolean, IsOptional, IsString, IsUUID } from 'class-validator';

export class UpdateFormDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  successMessage?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsUUID()
  templateId?: string;
}
