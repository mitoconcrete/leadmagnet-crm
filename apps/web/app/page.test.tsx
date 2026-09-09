import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import DashboardPage from './page';

vi.mock('@/components/auth-gate', () => ({
  AuthGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/app-shell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div data-testid="app-shell">{children}</div>,
}));

const campaignTableProps: { refreshKey?: number }[] = [];

vi.mock('@/components/campaign-table', () => ({
  CampaignTable: (props: { refreshKey?: number }) => {
    campaignTableProps.push(props);
    return <div data-testid="campaign-table" />;
  },
}));

vi.mock('@/components/channel-table', () => ({
  ChannelTable: () => <div data-testid="channel-table" />,
}));

vi.mock('@/components/create-campaign-dialog', () => ({
  CreateCampaignDialog: ({ onCreated }: { onCreated: () => void }) => (
    <button onClick={onCreated}>캠페인 만들기</button>
  ),
}));

describe('DashboardPage', () => {
  beforeEach(() => {
    campaignTableProps.length = 0;
  });

  it('AuthGate와 AppShell로 감싸 캠페인·채널 표와 생성 버튼을 보여준다', () => {
    render(<DashboardPage />);

    expect(screen.getByTestId('app-shell')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '캠페인 성과' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '채널 성과' })).toBeInTheDocument();
    expect(screen.getByTestId('campaign-table')).toBeInTheDocument();
    expect(screen.getByTestId('channel-table')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '캠페인 만들기' })).toBeInTheDocument();
  });

  it('캠페인 생성 후 CampaignTable의 refreshKey가 바뀐다', () => {
    render(<DashboardPage />);

    const before = campaignTableProps.at(-1)?.refreshKey;
    fireEvent.click(screen.getByRole('button', { name: '캠페인 만들기' }));
    const after = campaignTableProps.at(-1)?.refreshKey;

    expect(after).not.toBe(before);
  });
});
