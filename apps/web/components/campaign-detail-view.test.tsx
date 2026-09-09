import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { CampaignDetailView } from './campaign-detail-view';

vi.mock('@/components/auth-gate', () => ({
  AuthGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/app-shell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div data-testid="app-shell">{children}</div>,
}));

vi.mock('@/components/campaign-header', () => ({
  CampaignHeader: ({ campaignId }: { campaignId: string }) => <div data-testid="campaign-header">{campaignId}</div>,
}));

const formListProps: { campaignId: string; refreshKey?: number }[] = [];

vi.mock('@/components/form-list', () => ({
  FormList: (props: { campaignId: string; refreshKey?: number }) => {
    formListProps.push(props);
    return <div data-testid="form-list" />;
  },
}));

vi.mock('@/components/create-form-dialog', () => ({
  CreateFormDialog: ({ onCreated }: { onCreated: () => void }) => <button onClick={onCreated}>폼 만들기</button>,
}));

vi.mock('@/components/submission-table', () => ({
  SubmissionTable: ({ campaignId }: { campaignId: string }) => (
    <div data-testid="submission-table">{campaignId}</div>
  ),
}));

describe('CampaignDetailView', () => {
  beforeEach(() => {
    formListProps.length = 0;
  });

  it('전달받은 campaignId로 헤더·폼 목록·신청 명단을 보여준다', () => {
    render(<CampaignDetailView campaignId="c1" />);

    expect(screen.getByTestId('app-shell')).toBeInTheDocument();
    expect(screen.getByTestId('campaign-header')).toHaveTextContent('c1');
    expect(screen.getByTestId('form-list')).toBeInTheDocument();
    expect(screen.getByTestId('submission-table')).toHaveTextContent('c1');
    expect(screen.getByRole('button', { name: '폼 만들기' })).toBeInTheDocument();
  });

  it('폼 생성 후 FormList의 refreshKey가 바뀐다', () => {
    render(<CampaignDetailView campaignId="c1" />);

    const before = formListProps.at(-1)?.refreshKey;
    fireEvent.click(screen.getByRole('button', { name: '폼 만들기' }));
    const after = formListProps.at(-1)?.refreshKey;

    expect(after).not.toBe(before);
  });
});
