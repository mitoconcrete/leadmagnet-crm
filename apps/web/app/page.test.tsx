import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import DashboardPage from './page';
import type { CampaignRow, ChannelStat } from '@/lib/types';

vi.mock('@/components/auth-gate', () => ({
  AuthGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/app-shell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div data-testid="app-shell">{children}</div>,
}));

const campaignTableProps: { rows: CampaignRow[]; loading: boolean }[] = [];
vi.mock('@/components/campaign-table', () => ({
  CampaignTable: (props: { rows: CampaignRow[]; loading: boolean }) => {
    campaignTableProps.push(props);
    return <div data-testid="campaign-table" />;
  },
}));

const channelTableProps: { stats: ChannelStat[]; loading: boolean }[] = [];
vi.mock('@/components/channel-table', () => ({
  ChannelTable: (props: { stats: ChannelStat[]; loading: boolean }) => {
    channelTableProps.push(props);
    return <div data-testid="channel-table" />;
  },
}));

vi.mock('@/components/create-campaign-dialog', () => ({
  CreateCampaignDialog: ({ onCreated }: { onCreated: () => void }) => (
    <button onClick={onCreated}>캠페인 만들기</button>
  ),
}));

const lastUpdatedProps: { lastUpdatedAt: Date | null; error: unknown; isRefreshing: boolean }[] = [];
vi.mock('@/components/last-updated', () => ({
  LastUpdated: (props: { lastUpdatedAt: Date | null; error: unknown; isRefreshing: boolean; onRefresh: () => void }) => {
    lastUpdatedProps.push(props);
    return <button onClick={props.onRefresh}>지금 갱신</button>;
  },
}));

const refresh = vi.fn();
const campaigns: CampaignRow[] = [
  { campaignId: 'c1', name: '가을 캠페인', status: 'active', visits: 1, visitors: 1, submissions: 1, conversionRate: 1 },
];
const channels: ChannelStat[] = [{ channel: 'instagram', visits: 1, visitors: 1, submissions: 1, conversionRate: 1 }];

let pollingResult: {
  data: { campaigns: CampaignRow[]; channels: ChannelStat[] } | null;
  error: unknown;
  lastUpdatedAt: Date | null;
  isRefreshing: boolean;
  refresh: () => void;
};

vi.mock('@/hooks/use-polling', () => ({
  usePolling: () => pollingResult,
}));

describe('DashboardPage', () => {
  beforeEach(() => {
    campaignTableProps.length = 0;
    channelTableProps.length = 0;
    lastUpdatedProps.length = 0;
    refresh.mockClear();
    pollingResult = {
      data: { campaigns, channels },
      error: null,
      lastUpdatedAt: new Date('2026-01-01T00:00:00.000Z'),
      isRefreshing: false,
      refresh,
    };
  });

  it('AuthGate와 AppShell로 감싸 캠페인·채널 표와 생성 버튼, 마지막 갱신을 보여준다', () => {
    render(<DashboardPage />);

    expect(screen.getByTestId('app-shell')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '캠페인 성과' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '채널 성과' })).toBeInTheDocument();
    expect(screen.getByTestId('campaign-table')).toBeInTheDocument();
    expect(screen.getByTestId('channel-table')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '캠페인 만들기' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '지금 갱신' })).toBeInTheDocument();
  });

  it('usePolling 결과의 rows/stats를 CampaignTable·ChannelTable에 전달한다', () => {
    render(<DashboardPage />);

    expect(campaignTableProps.at(-1)).toEqual({ rows: campaigns, loading: false });
    expect(channelTableProps.at(-1)).toEqual({ stats: channels, loading: false });
  });

  it('data가 아직 없고 오류도 없으면 두 표에 loading=true를 전달한다', () => {
    pollingResult = { data: null, error: null, lastUpdatedAt: null, isRefreshing: false, refresh };
    render(<DashboardPage />);

    expect(campaignTableProps.at(-1)?.loading).toBe(true);
    expect(channelTableProps.at(-1)?.loading).toBe(true);
  });

  it('캠페인 생성 후 refresh를 호출한다', () => {
    render(<DashboardPage />);

    fireEvent.click(screen.getByRole('button', { name: '캠페인 만들기' }));

    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('지금 갱신 버튼을 클릭하면 refresh를 호출한다', () => {
    render(<DashboardPage />);

    fireEvent.click(screen.getByRole('button', { name: '지금 갱신' }));

    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
