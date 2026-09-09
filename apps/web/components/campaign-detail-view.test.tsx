import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { CampaignDetailView } from './campaign-detail-view';
import { apiFetch, ApiError } from '@/lib/api';
import { toast } from 'sonner';
import type { Campaign, CampaignStats, SubmissionPage } from '@/lib/types';
import { POLL_INTERVAL_MS } from '@/lib/polling';

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return { ...actual, apiFetch: vi.fn() };
});

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock('@/components/auth-gate', () => ({
  AuthGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/app-shell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div data-testid="app-shell">{children}</div>,
}));

const campaignStatusBarCalls: { campaign: Campaign }[] = [];
vi.mock('@/components/campaign-status-bar', () => ({
  CampaignStatusBar: (props: {
    campaignId: string;
    campaign: Campaign;
    onCampaignUpdated: (campaign: Campaign) => void;
  }) => {
    campaignStatusBarCalls.push({ campaign: props.campaign });
    return (
      <div data-testid="campaign-status-bar">
        {props.campaignId}
        <button onClick={() => props.onCampaignUpdated({ ...props.campaign, status: 'archived' })}>종료 모의</button>
      </div>
    );
  },
}));

const campaignStatsPanelCalls: { stats: CampaignStats | null }[] = [];
vi.mock('@/components/campaign-stats-panel', () => ({
  CampaignStatsPanel: (props: { stats: CampaignStats | null }) => {
    campaignStatsPanelCalls.push({ stats: props.stats });
    return <div data-testid="campaign-stats-panel" />;
  },
}));

const submissionTableCalls: { data: SubmissionPage | null; loading: boolean; page: number }[] = [];
vi.mock('@/components/submission-table', () => ({
  SubmissionTable: (props: {
    data: SubmissionPage | null;
    loading: boolean;
    page: number;
    onPageChange: (page: number) => void;
  }) => {
    submissionTableCalls.push({ data: props.data, loading: props.loading, page: props.page });
    return (
      <div data-testid="submission-table">
        <button onClick={() => props.onPageChange(props.page + 1)}>다음 모의</button>
      </div>
    );
  },
}));

const formListProps: { campaignId: string; refreshKey?: number; linksDisabled?: boolean }[] = [];
vi.mock('@/components/form-list', () => ({
  FormList: (props: { campaignId: string; refreshKey?: number; linksDisabled?: boolean }) => {
    formListProps.push(props);
    return <div data-testid="form-list" />;
  },
}));

vi.mock('@/components/create-form-dialog', () => ({
  CreateFormDialog: ({ onCreated, disabled }: { onCreated: () => void; disabled?: boolean }) => (
    <button onClick={onCreated} disabled={disabled}>
      폼 만들기
    </button>
  ),
}));

const campaign: Campaign = {
  id: 'c1',
  name: '가을 캠페인',
  description: null,
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
  channels: [],
};

function makeSubmissionPage(page: number): SubmissionPage {
  return { items: [], total: 0, page, limit: 20 };
}

/** 대기 중인 마이크로태스크·타이머를 흘려보낸다(가짜 타이머 환경에서 waitFor 대신 사용). */
async function flush() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}

function mockApi(overrides: { statsReject?: boolean } = {}) {
  vi.mocked(apiFetch).mockImplementation((path: string) => {
    if (path.includes('/forms?campaignId=')) return Promise.resolve([]);
    if (path.endsWith('/stats')) {
      return overrides.statsReject
        ? Promise.reject(new ApiError(500, '통계를 불러오지 못했습니다'))
        : Promise.resolve(stats);
    }
    if (path.includes('/api/admin/submissions')) {
      const pageMatch = /page=(\d+)/.exec(path);
      return Promise.resolve(makeSubmissionPage(pageMatch ? Number(pageMatch[1]) : 1));
    }
    return Promise.resolve(campaign);
  });
}

describe('CampaignDetailView', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z')); // KST 09:00:00
    vi.clearAllMocks();
    campaignStatusBarCalls.length = 0;
    campaignStatsPanelCalls.length = 0;
    submissionTableCalls.length = 0;
    formListProps.length = 0;
    mockApi();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('전달받은 campaignId로 헤더·폼 목록·신청 명단을 보여주고 마지막 갱신을 표시한다', async () => {
    render(<CampaignDetailView campaignId="c1" />);
    await flush();

    expect(screen.getByTestId('app-shell')).toBeInTheDocument();
    expect(screen.getByTestId('campaign-status-bar')).toHaveTextContent('c1');
    expect(screen.getByTestId('campaign-stats-panel')).toBeInTheDocument();
    expect(screen.getByTestId('form-list')).toBeInTheDocument();
    expect(screen.getByTestId('submission-table')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '폼 만들기' })).toBeInTheDocument();
    expect(screen.getByText('마지막 갱신 09:00:00')).toBeInTheDocument();

    expect(campaignStatsPanelCalls.at(-1)?.stats).toEqual(stats);
    expect(submissionTableCalls.at(-1)?.data).toEqual(makeSubmissionPage(1));
  });

  it('데스크톱 우선 레이아웃(ADR 0021): 3열 그리드로 성과·폼·명단을 나눠 갖는다', async () => {
    render(<CampaignDetailView campaignId="c1" />);
    await flush();

    const columns = screen.getByTestId('campaign-columns');
    expect(columns.className).toContain('min-h-0');
    expect(columns.className).toContain('lg:grid-cols-3');
  });

  it('캠페인 정보 조회에 실패하면 오류 문구를 보여주고 무한 로딩에 빠지지 않는다', async () => {
    vi.mocked(apiFetch).mockRejectedValue(new ApiError(500, '캠페인 정보를 불러오지 못했습니다'));

    render(<CampaignDetailView campaignId="c1" />);
    await flush();

    expect(toast.error).toHaveBeenCalledWith('캠페인 정보를 불러오지 못했습니다');
    expect(screen.getByText('캠페인 정보를 불러오지 못했습니다')).toBeInTheDocument();
    expect(screen.queryByTestId('campaign-status-bar')).not.toBeInTheDocument();
  });

  it('stats 조회만 실패해도 캠페인 정보는 정상 표시되고, stats는 null로 전달된다(무한 로딩 없음)', async () => {
    mockApi({ statsReject: true });

    render(<CampaignDetailView campaignId="c1" />);
    await flush();

    expect(screen.getByTestId('campaign-status-bar')).toBeInTheDocument();
    expect(campaignStatsPanelCalls.at(-1)?.stats).toBeNull();
    expect(screen.getByText('갱신 실패')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '지금 갱신' })).toBeInTheDocument();
  });

  it('지금 갱신 버튼을 클릭하면 stats·submissions를 다시 조회하지만 캠페인 정보는 다시 조회하지 않는다', async () => {
    render(<CampaignDetailView campaignId="c1" />);
    await flush();

    vi.mocked(apiFetch).mockClear();

    fireEvent.click(screen.getByRole('button', { name: '지금 갱신' }));
    await flush();

    const calledPaths = vi.mocked(apiFetch).mock.calls.map(([path]) => path as string);
    expect(calledPaths.some((p) => p.endsWith('/stats'))).toBe(true);
    expect(calledPaths.some((p) => p.includes('/api/admin/submissions'))).toBe(true);
    expect(calledPaths.some((p) => p === '/api/admin/campaigns/c1')).toBe(false);
  });

  it('30초마다 stats·submissions를 다시 조회한다', async () => {
    render(<CampaignDetailView campaignId="c1" />);
    await flush();

    vi.mocked(apiFetch).mockClear();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    });

    const calledPaths = vi.mocked(apiFetch).mock.calls.map(([path]) => path as string);
    expect(calledPaths.some((p) => p.endsWith('/stats'))).toBe(true);
    expect(calledPaths.some((p) => p.includes('/api/admin/submissions'))).toBe(true);
  });

  it('신청 명단 페이지가 바뀌면 폴링 주기와 별개로 즉시 다시 조회한다', async () => {
    render(<CampaignDetailView campaignId="c1" />);
    await flush();

    vi.mocked(apiFetch).mockClear();

    fireEvent.click(screen.getByRole('button', { name: '다음 모의' }));
    await flush();

    const calledPaths = vi.mocked(apiFetch).mock.calls.map(([path]) => path as string);
    expect(calledPaths.some((p) => p.includes('page=2'))).toBe(true);
    expect(submissionTableCalls.at(-1)?.page).toBe(2);
  });

  it('캠페인 상태가 바뀌면(종료) 폼 만들기 버튼이 비활성화되고 폼 목록을 다시 조회한다', async () => {
    render(<CampaignDetailView campaignId="c1" />);
    await flush();

    expect(screen.getByRole('button', { name: '폼 만들기' })).not.toBeDisabled();
    expect(screen.queryByText('종료된 캠페인에는 새 폼을 만들 수 없습니다')).not.toBeInTheDocument();
    const formListKeyBefore = formListProps.at(-1)?.refreshKey;

    fireEvent.click(screen.getByRole('button', { name: '종료 모의' }));
    await flush();

    expect(screen.getByRole('button', { name: '폼 만들기' })).toBeDisabled();
    expect(screen.getByText('종료된 캠페인에는 새 폼을 만들 수 없습니다')).toBeInTheDocument();
    expect(formListProps.at(-1)?.linksDisabled).toBe(true);
    expect(formListProps.at(-1)?.refreshKey).not.toBe(formListKeyBefore);
  });

  it('폼 생성 후 FormList의 refreshKey가 바뀐다', async () => {
    render(<CampaignDetailView campaignId="c1" />);
    await flush();

    const before = formListProps.at(-1)?.refreshKey;
    fireEvent.click(screen.getByRole('button', { name: '폼 만들기' }));
    const after = formListProps.at(-1)?.refreshKey;

    expect(after).not.toBe(before);
  });
});
