import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SubmissionTable } from './submission-table';
import { apiFetch } from '@/lib/api';
import type { SubmissionPage } from '@/lib/types';

vi.mock('@/lib/api', () => ({
  apiFetch: vi.fn(),
}));

function makePage(page: number): SubmissionPage {
  return {
    items: [
      {
        id: `s${page}`,
        formId: 'f1',
        formName: '기본 신청폼',
        campaignId: 'c1',
        channel: 'instagram',
        payload: { name: '홍길동', interest: ['A', 'B'] },
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    total: 25,
    page,
    limit: 20,
  };
}

describe('SubmissionTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('신청 명단을 조회해 시각(KST)·폼·채널·payload를 보여준다', async () => {
    vi.mocked(apiFetch).mockResolvedValue(makePage(1));

    render(<SubmissionTable campaignId="c1" />);

    expect(apiFetch).toHaveBeenCalledWith('/api/admin/submissions?campaignId=c1&page=1');

    await waitFor(() => expect(screen.getByText('기본 신청폼')).toBeInTheDocument());
    expect(screen.getByText('인스타그램')).toBeInTheDocument();
    expect(screen.getByText('2026-01-01 09:00')).toBeInTheDocument();
    expect(screen.getByText('홍길동', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('A, B', { exact: false })).toBeInTheDocument();
  });

  it('다음 버튼을 누르면 다음 페이지를 조회한다', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(makePage(1));
    vi.mocked(apiFetch).mockResolvedValueOnce(makePage(2));

    render(<SubmissionTable campaignId="c1" />);

    await waitFor(() => expect(screen.getByRole('button', { name: '다음' })).not.toBeDisabled());
    fireEvent.click(screen.getByRole('button', { name: '다음' }));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith('/api/admin/submissions?campaignId=c1&page=2');
    });
  });

  it('신청 내역이 없으면 안내 문구를 보여준다', async () => {
    vi.mocked(apiFetch).mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 });

    render(<SubmissionTable campaignId="c1" />);

    await waitFor(() => expect(screen.getByText('신청 내역이 없습니다.')).toBeInTheDocument());
  });
});
