import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { CampaignStatusBar } from './campaign-status-bar';
import { apiFetch, ApiError } from '@/lib/api';
import { toast } from 'sonner';
import type { Campaign } from '@/lib/types';

const replaceMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock, push: vi.fn() }),
}));

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

const archivedCampaign: Campaign = { ...campaign, status: 'archived' };

/** 대기 중인 마이크로태스크를 흘려보낸다. */
async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('CampaignStatusBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('삭제 버튼을 클릭하면 확인 대화상자를 보여준다', () => {
    render(<CampaignStatusBar campaignId="c1" campaign={campaign} onCampaignUpdated={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: '삭제' }));

    expect(
      screen.getByText(
        '캠페인과 소속 폼·배포 링크가 삭제됩니다. 방문·신청 기록이 있으면 삭제할 수 없습니다. 정말 삭제할까요?',
      ),
    ).toBeInTheDocument();
  });

  it('삭제를 확인하면 DELETE 요청 후 204면 캠페인을 삭제했습니다 토스트와 함께 대시보드로 이동한다', async () => {
    vi.mocked(apiFetch).mockResolvedValue(undefined);

    render(<CampaignStatusBar campaignId="c1" campaign={campaign} onCampaignUpdated={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: '삭제' }));
    fireEvent.click(screen.getByRole('button', { name: '삭제 확정' }));
    await flush();

    expect(apiFetch).toHaveBeenCalledWith('/api/admin/campaigns/c1', { method: 'DELETE' });
    expect(toast.success).toHaveBeenCalledWith('캠페인을 삭제했습니다');
    expect(replaceMock).toHaveBeenCalledWith('/');
  });

  it('삭제가 409면 서버 메시지와 details(폼·방문·신청 수)를 대화상자 안에 보여주고 종료(보관)하기 버튼을 노출한다', async () => {
    vi.mocked(apiFetch).mockRejectedValue(
      new ApiError(409, '이벤트가 있는 캠페인은 삭제할 수 없습니다. 종료(보관)하세요', {
        forms: 2,
        visits: 10,
        submissions: 3,
      }),
    );

    render(<CampaignStatusBar campaignId="c1" campaign={campaign} onCampaignUpdated={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: '삭제' }));
    fireEvent.click(screen.getByRole('button', { name: '삭제 확정' }));
    await flush();

    expect(screen.getByText('이벤트가 있는 캠페인은 삭제할 수 없습니다. 종료(보관)하세요')).toBeInTheDocument();
    expect(screen.getByText('폼 2개, 방문 10건, 신청 3건')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '종료(보관)하기' })).toBeInTheDocument();
    // 409면 대화상자를 닫지 않는다.
    expect(replaceMock).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('삭제 중 409 외의 오류는 오류 토스트만 띄운다', async () => {
    vi.mocked(apiFetch).mockRejectedValue(new ApiError(500, '서버 오류'));

    render(<CampaignStatusBar campaignId="c1" campaign={campaign} onCampaignUpdated={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: '삭제' }));
    fireEvent.click(screen.getByRole('button', { name: '삭제 확정' }));
    await flush();

    expect(toast.error).toHaveBeenCalledWith('서버 오류');
    expect(
      screen.getByText(
        '캠페인과 소속 폼·배포 링크가 삭제됩니다. 방문·신청 기록이 있으면 삭제할 수 없습니다. 정말 삭제할까요?',
      ),
    ).toBeInTheDocument();
  });

  it('409 대화상자에서 종료(보관)하기를 누르면 삭제 대화상자를 닫고 종료 확인 흐름을 연다', async () => {
    vi.mocked(apiFetch).mockImplementation((path: string, init?: { method?: string }) => {
      if (init?.method === 'DELETE') {
        return Promise.reject(
          new ApiError(409, '이벤트가 있는 캠페인은 삭제할 수 없습니다. 종료(보관)하세요', {
            forms: 1,
            visits: 5,
            submissions: 1,
          }),
        );
      }
      if (path.includes('/forms?campaignId=')) return Promise.resolve([{}]);
      return Promise.reject(new Error('unexpected call'));
    });

    render(<CampaignStatusBar campaignId="c1" campaign={campaign} onCampaignUpdated={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: '삭제' }));
    fireEvent.click(screen.getByRole('button', { name: '삭제 확정' }));
    await flush();

    fireEvent.click(screen.getByRole('button', { name: '종료(보관)하기' }));
    await flush();

    expect(
      screen.queryByText('이벤트가 있는 캠페인은 삭제할 수 없습니다. 종료(보관)하세요'),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText('소속 폼 1개가 닫히고 공개 링크가 404가 됩니다. 집계와 명단은 유지됩니다. 종료할까요?'),
    ).toBeInTheDocument();
  });

  it('이름·설명·상태 배지를 보여준다', () => {
    render(<CampaignStatusBar campaignId="c1" campaign={campaign} onCampaignUpdated={vi.fn()} />);

    expect(screen.getByText('가을 캠페인')).toBeInTheDocument();
    expect(screen.getByText('가을 프로모션 리드 수집')).toBeInTheDocument();
    expect(screen.getByText('진행중')).toBeInTheDocument();
  });

  it('보관된 캠페인이면 다시 진행 버튼을 보여준다', () => {
    render(<CampaignStatusBar campaignId="c1" campaign={archivedCampaign} onCampaignUpdated={vi.fn()} />);

    expect(screen.getByText('보관됨')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '다시 진행' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '캠페인 종료' })).not.toBeInTheDocument();
  });

  it('캠페인 종료 버튼을 클릭하면 대화상자를 열고 폼 수를 조회해 보여준다', async () => {
    vi.mocked(apiFetch).mockResolvedValue([{}, {}]);

    render(<CampaignStatusBar campaignId="c1" campaign={campaign} onCampaignUpdated={vi.fn()} />);

    expect(apiFetch).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: '캠페인 종료' }));
    expect(apiFetch).toHaveBeenCalledWith('/api/admin/forms?campaignId=c1');
    await flush();

    expect(
      screen.getByText('소속 폼 2개가 닫히고 공개 링크가 404가 됩니다. 집계와 명단은 유지됩니다. 종료할까요?'),
    ).toBeInTheDocument();
  });

  it('폼 수 조회에 실패하면 0개로 안내하지 않고 실패 문구를 보여준다', async () => {
    vi.mocked(apiFetch).mockRejectedValue(new ApiError(500, '조회 실패'));

    render(<CampaignStatusBar campaignId="c1" campaign={campaign} onCampaignUpdated={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: '캠페인 종료' }));
    await flush();

    expect(screen.getByText('폼 수를 확인하지 못했습니다', { exact: false })).toBeInTheDocument();
    expect(screen.queryByText('소속 폼 0개', { exact: false })).not.toBeInTheDocument();
  });

  it('종료를 확인하면 PATCH로 종료 처리하고 onCampaignUpdated를 호출한 뒤 대화상자를 닫는다', async () => {
    vi.mocked(apiFetch).mockImplementation((path: string, init?: { method?: string; json?: unknown }) => {
      if (path.includes('/forms?campaignId=')) return Promise.resolve([{}, {}]);
      if (init?.method === 'PATCH') return Promise.resolve(archivedCampaign);
      return Promise.reject(new Error('unexpected call'));
    });

    const onCampaignUpdated = vi.fn();
    render(<CampaignStatusBar campaignId="c1" campaign={campaign} onCampaignUpdated={onCampaignUpdated} />);

    fireEvent.click(screen.getByRole('button', { name: '캠페인 종료' }));
    await flush();

    fireEvent.click(screen.getByRole('button', { name: '종료' }));
    await flush();

    expect(apiFetch).toHaveBeenCalledWith('/api/admin/campaigns/c1', {
      method: 'PATCH',
      json: { status: 'archived' },
    });
    expect(onCampaignUpdated).toHaveBeenCalledWith(archivedCampaign);
    expect(toast.success).toHaveBeenCalledWith('캠페인을 종료했습니다');
    expect(
      screen.queryByText('소속 폼 2개가 닫히고 공개 링크가 404가 됩니다. 집계와 명단은 유지됩니다. 종료할까요?'),
    ).not.toBeInTheDocument();
  });

  it('종료 처리가 실패하면 오류 토스트만 띄우고 대화상자는 닫지 않는다', async () => {
    vi.mocked(apiFetch).mockImplementation((path: string, init?: { method?: string; json?: unknown }) => {
      if (path.includes('/forms?campaignId=')) return Promise.resolve([{}, {}]);
      if (init?.method === 'PATCH') return Promise.reject(new ApiError(500, '종료에 실패했습니다'));
      return Promise.reject(new Error('unexpected call'));
    });

    const onCampaignUpdated = vi.fn();
    render(<CampaignStatusBar campaignId="c1" campaign={campaign} onCampaignUpdated={onCampaignUpdated} />);

    fireEvent.click(screen.getByRole('button', { name: '캠페인 종료' }));
    await flush();

    fireEvent.click(screen.getByRole('button', { name: '종료' }));
    await flush();

    expect(toast.error).toHaveBeenCalledWith('종료에 실패했습니다');
    expect(onCampaignUpdated).not.toHaveBeenCalled();
    expect(
      screen.getByText('소속 폼 2개가 닫히고 공개 링크가 404가 됩니다. 집계와 명단은 유지됩니다. 종료할까요?'),
    ).toBeInTheDocument();
  });

  it('보관된 캠페인에서는 확인 없이 다시 진행 버튼으로 즉시 재개하고 안내 토스트를 띄운다', async () => {
    vi.mocked(apiFetch).mockImplementation((path: string, init?: { method?: string; json?: unknown }) => {
      if (init?.method === 'PATCH') return Promise.resolve(campaign);
      return Promise.reject(new Error('unexpected call'));
    });

    const onCampaignUpdated = vi.fn();
    render(<CampaignStatusBar campaignId="c1" campaign={archivedCampaign} onCampaignUpdated={onCampaignUpdated} />);

    fireEvent.click(screen.getByRole('button', { name: '다시 진행' }));
    await flush();

    expect(apiFetch).toHaveBeenCalledWith('/api/admin/campaigns/c1', {
      method: 'PATCH',
      json: { status: 'active' },
    });
    expect(toast.success).toHaveBeenCalledWith('폼은 자동으로 열리지 않습니다. 폼별 활성 토글로 여세요');
    expect(onCampaignUpdated).toHaveBeenCalledWith(campaign);
  });
});
