import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CampaignTable } from './campaign-table';
import type { CampaignRow } from '@/lib/types';

const rows: CampaignRow[] = [
  {
    campaignId: 'c1',
    name: '가을 캠페인',
    status: 'active',
    visits: 100,
    visitors: 80,
    submissions: 20,
    conversionRate: 0.25,
  },
];

describe('CampaignTable', () => {
  it('불러오는 중이면 안내 문구를 보여준다', () => {
    render(<CampaignTable rows={[]} loading={true} />);

    expect(screen.getByText('불러오는 중…')).toBeInTheDocument();
  });

  it('전달받은 rows로 이름·상태·전환율을 표시한다', () => {
    render(<CampaignTable rows={rows} loading={false} />);

    expect(screen.getByRole('link', { name: '가을 캠페인' })).toHaveAttribute('href', '/campaigns/c1');
    expect(screen.getByText('25.0%')).toBeInTheDocument();
  });

  it('캠페인이 없으면 안내 문구를 보여준다', () => {
    render(<CampaignTable rows={[]} loading={false} />);

    expect(screen.getByText('등록된 캠페인이 없습니다.')).toBeInTheDocument();
  });

  it('보관된 캠페인은 보관됨 배지를 보여준다', () => {
    render(<CampaignTable rows={[{ ...rows[0], status: 'archived' }]} loading={false} />);

    expect(screen.getByText('보관됨')).toBeInTheDocument();
  });
});
