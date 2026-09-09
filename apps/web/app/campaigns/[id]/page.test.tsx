import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import CampaignDetailPage from './page';

vi.mock('@/components/campaign-detail-view', () => ({
  CampaignDetailView: ({ campaignId }: { campaignId: string }) => (
    <div data-testid="campaign-detail-view">{campaignId}</div>
  ),
}));

describe('CampaignDetailPage', () => {
  it('경로 파라미터를 풀어 CampaignDetailView에 campaignId로 전달한다', async () => {
    const element = await CampaignDetailPage({ params: Promise.resolve({ id: 'c1' }) });
    render(element);

    expect(screen.getByTestId('campaign-detail-view')).toHaveTextContent('c1');
  });
});
