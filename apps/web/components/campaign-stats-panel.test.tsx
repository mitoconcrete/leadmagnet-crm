import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CampaignStatsPanel } from './campaign-stats-panel';
import type { CampaignStats } from '@/lib/types';

const stats: CampaignStats = {
  campaignId: 'c1',
  visits: 100,
  visitors: 80,
  submissions: 20,
  conversionRate: 0.25,
  channels: [{ channel: 'instagram', visits: 40, visitors: 30, submissions: 10, conversionRate: 0.3333 }],
};

describe('CampaignStatsPanel', () => {
  it('전달받은 stats로 통계 카드·채널 breakdown(5행)을 보여준다', () => {
    render(<CampaignStatsPanel stats={stats} />);

    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getAllByText('25.0%').length).toBeGreaterThan(0);

    const rows = screen.getAllByRole('row').slice(1);
    expect(rows).toHaveLength(5);
    expect(screen.getByText('33.3%')).toBeInTheDocument();
  });

  it('stats가 없으면(조회 실패) 안내 문구를 보여준다', () => {
    render(<CampaignStatsPanel stats={null} />);

    expect(screen.getByText('성과를 불러오지 못했습니다')).toBeInTheDocument();
    expect(screen.queryByRole('row')).not.toBeInTheDocument();
  });

  it('채널 breakdown 표 헤더가 sticky다(ADR 0021 2026-09-10)', () => {
    render(<CampaignStatsPanel stats={stats} />);

    const thead = document.querySelector('thead');
    expect(thead).toHaveClass('sticky');
  });
});
