import { IsNotEmpty, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';

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
  @MaxLength(80)
  @Matches(/^[a-z0-9가-힣][a-z0-9가-힣-]{0,78}$/, {
    message: 'slug는 소문자·숫자·한글·하이픈만, 80자 이하',
  })
  slug?: string;

  @IsOptional()
  @IsString()
  successMessage?: string;
}
