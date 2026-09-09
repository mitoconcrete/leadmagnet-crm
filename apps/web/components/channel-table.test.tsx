import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ChannelTable } from './channel-table';
import { apiFetch, ApiError } from '@/lib/api';
import { toast } from 'sonner';
import type { ChannelStat } from '@/lib/types';

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return { ...actual, apiFetch: vi.fn() };
});

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

const stats: ChannelStat[] = [
  { channel: 'instagram', visits: 40, visitors: 30, submissions: 10, conversionRate: 0.3333 },
];

describe('ChannelTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('채널 성과 API를 조회해 항상 5행(direct 포함)을 순서대로 보여준다', async () => {
    vi.mocked(apiFetch).mockResolvedValue(stats);

    render(<ChannelTable />);

    expect(apiFetch).toHaveBeenCalledWith('/api/admin/analytics/channels');

    await waitFor(() => {
      expect(screen.getAllByRole('row')).toHaveLength(6); // 헤더 1 + 채널 5
    });

    const rows = screen.getAllByRole('row').slice(1);
    const labels = rows.map((row) => row.querySelector('td')?.textContent);
    expect(labels).toEqual(['직접 유입', '인스타그램', 'X', '유튜브', '스레드']);
    expect(screen.getByText('33.3%')).toBeInTheDocument();
  });

  it('데이터가 없는 채널은 0으로 표시한다', async () => {
    vi.mocked(apiFetch).mockResolvedValue([]);

    render(<ChannelTable />);

    await waitFor(() => expect(screen.getAllByRole('row')).toHaveLength(6));
    expect(screen.getAllByText('0.0%')).toHaveLength(5);
  });

  it('조회에 실패하면 오류 토스트를 띄우고 5행을 0으로 보여준다', async () => {
    vi.mocked(apiFetch).mockRejectedValue(new ApiError(500, '채널 성과를 불러오지 못했습니다'));

    render(<ChannelTable />);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('채널 성과를 불러오지 못했습니다');
    });
    expect(screen.getAllByRole('row')).toHaveLength(6);
    expect(screen.getAllByText('0.0%')).toHaveLength(5);
  });
});
