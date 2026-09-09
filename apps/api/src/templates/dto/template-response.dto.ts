import { ApiProperty } from '@nestjs/swagger';
import { HtmlTemplate } from '../../entities/html-template.entity';

export class TemplateListItemDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() originalFilename!: string;
  @ApiProperty() sizeBytes!: number;
  @ApiProperty() createdAt!: Date;
}

export class TemplateDetailDto extends TemplateListItemDto {
  @ApiProperty() html!: string;
}

export function toListItem(t: HtmlTemplate): TemplateListItemDto {
  return { id: t.id, name: t.name, originalFilename: t.originalFilename, sizeBytes: t.sizeBytes, createdAt: t.createdAt };
}

export function toDetail(t: HtmlTemplate): TemplateDetailDto {
  return { ...toListItem(t), html: t.html };
}
