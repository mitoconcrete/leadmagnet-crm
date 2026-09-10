export type Channel = 'instagram' | 'x' | 'youtube' | 'threads';

export type ChannelOrDirect = Channel | 'direct';

export const CHANNELS: Channel[] = ['instagram', 'x', 'youtube', 'threads'];

export const CHANNEL_LABELS: Record<ChannelOrDirect, string> = {
  instagram: '인스타그램',
  x: 'X',
  youtube: '유튜브',
  threads: '스레드',
  direct: '직접 유입',
};

/**
 * 조회수·방문자 수 표시 라벨과 헤더 툴팁(ADR 0005 결과 절, 2026-09-10).
 * API 필드명(visits, visitors)은 그대로 유지하고 화면 워딩만 바꾼다.
 * "방문" → "조회수", "방문자" → "방문자 수". 모든 표·성과 카드가 이 상수를 함께 쓴다.
 */
export const VISIT_STAT_LABEL = '조회수';
export const VISIT_STAT_TITLE = '링크가 열린 횟수(새로고침 포함)';
export const VISITOR_STAT_LABEL = '방문자 수';
export const VISITOR_STAT_TITLE = '서로 다른 브라우저(쿠키) 수';

export type CampaignStatus = 'active' | 'archived';

export interface Campaign {
  id: string;
  name: string;
  description: string | null;
  status: CampaignStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignDetail extends Campaign {
  forms: Form[];
}

export interface ChannelStat {
  channel: ChannelOrDirect;
  visits: number;
  visitors: number;
  submissions: number;
  conversionRate: number;
}

export interface CampaignStats {
  campaignId: string;
  visits: number;
  visitors: number;
  submissions: number;
  conversionRate: number;
  channels: ChannelStat[];
}

export interface CampaignRow {
  campaignId: string;
  name: string;
  status: CampaignStatus;
  /** 소속 폼 전체 수(ADR 0019). 백엔드가 안 주면 0으로 취급한다. */
  forms?: number;
  /** 소속 폼 중 활성 상태인 수(ADR 0019). 백엔드가 안 주면 0으로 취급한다. */
  activeForms?: number;
  visits: number;
  visitors: number;
  submissions: number;
  conversionRate: number;
}

export interface Form {
  id: string;
  campaignId: string;
  templateId: string;
  name: string;
  slug: string;
  successMessage: string;
  isActive: boolean;
  publicUrl: string;
  createdAt: string;
  updatedAt: string;
  links?: Link[];
  /** 폼이 참조하는 템플릿이 소프트 삭제됐는지(백엔드 필드 없으면 false로 취급). */
  templateDeleted?: boolean;
}

export interface Link {
  id: string;
  formId: string;
  channel: Channel;
  code: string;
  url: string;
  createdAt: string;
}

export interface Template {
  id: string;
  name: string;
  originalFilename: string;
  sizeBytes: number;
  createdAt: string;
  html?: string;
  /** 등록 점검 경고(ADR 0018). 백엔드가 안 주면 빈 배열로 취급한다. */
  warnings?: string[];
}

export interface Submission {
  id: string;
  formId: string;
  formName: string;
  campaignId: string;
  channel: ChannelOrDirect;
  payload: Record<string, string | string[]>;
  createdAt: string;
}

export interface SubmissionPage {
  items: Submission[];
  total: number;
  page: number;
  limit: number;
}
