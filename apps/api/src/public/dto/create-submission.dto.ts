import { IsObject, IsString } from 'class-validator';

export class CreateSubmissionDto {
  @IsString()
  visitToken!: string;

  @IsObject()
  fields!: Record<string, unknown>;
}
