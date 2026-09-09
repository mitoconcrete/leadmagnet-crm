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

/**
 * ADR 0018 "점검은 안내, 격리는 방어": 등록 시점에만 계산해 응답에 실어 보내는 경고.
 * DB에 저장하지 않으므로 목록·상세 응답에는 없다.
 */
export class TemplateCreatedDto extends TemplateListItemDto {
  @ApiProperty({
    type: [String],
    description:
      '등록 시점 점검 경고(ADR 0018). 등록을 막지 않는다. name 없는 입력, 외부 script, form의 action/method/onsubmit, ' +
      '제출 버튼 없음, 페이지 이동 시도, 관리자 API 호출, 개인정보 수집 동의 체크박스 없음을 안내한다.',
  })
  warnings!: string[];
}

export function toListItem(t: HtmlTemplate): TemplateListItemDto {
  return { id: t.id, name: t.name, originalFilename: t.originalFilename, sizeBytes: t.sizeBytes, createdAt: t.createdAt };
}

export function toDetail(t: HtmlTemplate): TemplateDetailDto {
  return { ...toListItem(t), html: t.html };
}

export function toCreated(t: HtmlTemplate, warnings: string[]): TemplateCreatedDto {
  return { ...toListItem(t), warnings };
}
