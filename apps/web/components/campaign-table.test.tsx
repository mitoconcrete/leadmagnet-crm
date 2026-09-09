import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { CampaignTable } from './campaign-table';
import { apiFetch } from '@/lib/api';
import type { CampaignRow } from '@/lib/types';

vi.mock('@/lib/api', () => ({
  apiFetch: vi.fn(),
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
});
