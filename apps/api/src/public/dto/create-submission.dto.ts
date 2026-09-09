import { IsObject, IsUUID } from 'class-validator';

export class CreateSubmissionDto {
  @IsUUID()
  visitToken!: string;

  @IsObject()
  fields!: Record<string, unknown>;
}
