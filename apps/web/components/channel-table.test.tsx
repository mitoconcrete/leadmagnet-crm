import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ChannelTable } from './channel-table';
import { apiFetch } from '@/lib/api';
import type { ChannelStat } from '@/lib/types';

vi.mock('@/lib/api', () => ({
  apiFetch: vi.fn(),
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
});
