import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { CampaignHeader } from './campaign-header';
import { apiFetch, ApiError } from '@/lib/api';
import { toast } from 'sonner';
import type { Campaign, CampaignStats } from '@/lib/types';
import { POLL_INTERVAL_MS } from '@/lib/polling';

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

/** 대기 중인 마이크로태스크·타이머를 흘려보낸다(가짜 타이머 환경에서 waitFor 대신 사용). */
async function flush() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}

describe('CampaignHeader', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z')); // KST 09:00:00
    vi.clearAllMocks();
    vi.mocked(apiFetch).mockImplementation((path: string) => {
      if (path.endsWith('/stats')) return Promise.resolve(stats);
      return Promise.resolve(campaign);
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('캠페인 정보·통계 카드·채널 breakdown(5행)·마지막 갱신 시각을 보여준다', async () => {
    render(<CampaignHeader campaignId="c1" />);
    await flush();

    expect(screen.getByText('가을 캠페인')).toBeInTheDocument();
    expect(screen.getByText('가을 프로모션 리드 수집')).toBeInTheDocument();
    expect(screen.getByText('진행중')).toBeInTheDocument();

    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getAllByText('25.0%').length).toBeGreaterThan(0);

    const rows = screen.getAllByRole('row').slice(1);
    expect(rows).toHaveLength(5);
    expect(screen.getByText('33.3%')).toBeInTheDocument();

    expect(screen.getByText('마지막 갱신 09:00:00')).toBeInTheDocument();
  });

  it('조회에 실패하면 오류 토스트를 띄우고 오류 문구를 보여준다(무한 로딩에 빠지지 않는다)', async () => {
    vi.mocked(apiFetch).mockReset();
    vi.mocked(apiFetch).mockRejectedValue(new ApiError(500, '캠페인 정보를 불러오지 못했습니다'));

    render(<CampaignHeader campaignId="c1" />);
    await flush();

    expect(toast.error).toHaveBeenCalledWith('캠페인 정보를 불러오지 못했습니다');
    expect(screen.getByText('캠페인 정보를 불러오지 못했습니다')).toBeInTheDocument();
    expect(screen.queryByText('불러오는 중…')).not.toBeInTheDocument();
  });

  it('30초마다 통계를 다시 조회한다', async () => {
    render(<CampaignHeader campaignId="c1" />);
    await flush();

    const statsCallsBefore = vi.mocked(apiFetch).mock.calls.filter(([path]) => (path as string).endsWith('/stats'));
    expect(statsCallsBefore).toHaveLength(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    });

    const statsCallsAfter = vi.mocked(apiFetch).mock.calls.filter(([path]) => (path as string).endsWith('/stats'));
    expect(statsCallsAfter).toHaveLength(2);
  });

  it('지금 갱신 버튼을 클릭하면 통계를 다시 조회한다', async () => {
    render(<CampaignHeader campaignId="c1" />);
    await flush();

    fireEvent.click(screen.getByRole('button', { name: '지금 갱신' }));
    await flush();

    const statsCalls = vi.mocked(apiFetch).mock.calls.filter(([path]) => (path as string).endsWith('/stats'));
    expect(statsCalls).toHaveLength(2);
  });

  it('통계 조회만 실패하면 이전 통계를 유지하고 갱신 실패 문구를 보여준다', async () => {
    render(<CampaignHeader campaignId="c1" />);
    await flush();

    vi.mocked(apiFetch).mockImplementation((path: string) => {
      if (path.endsWith('/stats')) return Promise.reject(new ApiError(500, '통계를 불러오지 못했습니다'));
      return Promise.resolve(campaign);
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    });

    expect(screen.getByText('100')).toBeInTheDocument(); // 이전 통계 유지
    expect(screen.getByText('갱신 실패(마지막 성공 09:00:00)')).toBeInTheDocument();
  });
});
