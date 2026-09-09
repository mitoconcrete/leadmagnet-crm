import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { CampaignTable } from './campaign-table';
import { apiFetch, ApiError } from '@/lib/api';
import { toast } from 'sonner';
import type { CampaignRow } from '@/lib/types';

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return { ...actual, apiFetch: vi.fn() };
});

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

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
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('캠페인 성과 API를 조회해 이름·상태·전환율을 표시한다', async () => {
    vi.mocked(apiFetch).mockResolvedValue(rows);

    render(<CampaignTable />);

    expect(apiFetch).toHaveBeenCalledWith('/api/admin/analytics/campaigns');

    await waitFor(() => {
      expect(screen.getByRole('link', { name: '가을 캠페인' })).toHaveAttribute('href', '/campaigns/c1');
    });
    expect(screen.getByText('25.0%')).toBeInTheDocument();
  });

  it('캠페인이 없으면 안내 문구를 보여준다', async () => {
    vi.mocked(apiFetch).mockResolvedValue([]);

    render(<CampaignTable />);

    await waitFor(() => {
      expect(screen.getByText('등록된 캠페인이 없습니다.')).toBeInTheDocument();
    });
  });

  it('보관된 캠페인은 보관됨 배지를 보여준다', async () => {
    vi.mocked(apiFetch).mockResolvedValue([{ ...rows[0], status: 'archived' }]);

    render(<CampaignTable />);

    await waitFor(() => expect(screen.getByText('보관됨')).toBeInTheDocument());
  });

  it('조회에 실패하면 오류 토스트를 띄우고 빈 상태를 보여준다', async () => {
    vi.mocked(apiFetch).mockRejectedValue(new ApiError(500, '캠페인 성과를 불러오지 못했습니다'));

    render(<CampaignTable />);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('캠페인 성과를 불러오지 못했습니다');
    });
    expect(screen.getByText('등록된 캠페인이 없습니다.')).toBeInTheDocument();
  });

  it('언마운트 후 응답이 와도 상태를 갱신하지 않는다', async () => {
    let resolveFn: (value: CampaignRow[]) => void = () => {};
    vi.mocked(apiFetch).mockReturnValue(
      new Promise((resolve) => {
        resolveFn = resolve;
      }),
    );

    const { unmount } = render(<CampaignTable />);
    unmount();
    resolveFn(rows);

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(toast.error).not.toHaveBeenCalled();
  });
});
