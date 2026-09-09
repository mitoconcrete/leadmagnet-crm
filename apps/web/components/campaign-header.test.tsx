import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { CampaignHeader } from './campaign-header';
import { apiFetch, ApiError } from '@/lib/api';
import { toast } from 'sonner';
import type { Campaign, CampaignStats } from '@/lib/types';

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return { ...actual, apiFetch: vi.fn() };
});

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

const campaign: Campaign = {
  id: 'c1',
  name: '가을 캠페인',
  description: '가을 프로모션 리드 수집',
  status: 'active',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const stats: CampaignStats = {
  campaignId: 'c1',
  visits: 100,
  visitors: 80,
  submissions: 20,
  conversionRate: 0.25,
  channels: [{ channel: 'instagram', visits: 40, visitors: 30, submissions: 10, conversionRate: 0.3333 }],
};

describe('CampaignHeader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiFetch).mockImplementation((path: string) => {
      if (path.endsWith('/stats')) return Promise.resolve(stats);
      return Promise.resolve(campaign);
    });
  });

  it('캠페인 정보·통계 카드·채널 breakdown(5행)을 보여준다', async () => {
    render(<CampaignHeader campaignId="c1" />);

    await waitFor(() => expect(screen.getByText('가을 캠페인')).toBeInTheDocument());
    expect(screen.getByText('가을 프로모션 리드 수집')).toBeInTheDocument();
    expect(screen.getByText('진행중')).toBeInTheDocument();

    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getAllByText('25.0%').length).toBeGreaterThan(0);

    const rows = screen.getAllByRole('row').slice(1);
    expect(rows).toHaveLength(5);
    expect(screen.getByText('33.3%')).toBeInTheDocument();
  });

  it('조회에 실패하면 오류 토스트를 띄우고 오류 문구를 보여준다(무한 로딩에 빠지지 않는다)', async () => {
    vi.mocked(apiFetch).mockReset();
    vi.mocked(apiFetch).mockRejectedValue(new ApiError(500, '캠페인 정보를 불러오지 못했습니다'));

    render(<CampaignHeader campaignId="c1" />);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('캠페인 정보를 불러오지 못했습니다');
    });
    expect(screen.getByText('캠페인 정보를 불러오지 못했습니다')).toBeInTheDocument();
    expect(screen.queryByText('불러오는 중…')).not.toBeInTheDocument();
  });
});
