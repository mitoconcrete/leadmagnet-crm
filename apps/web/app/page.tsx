'use client';

import { AppShell } from '@/components/app-shell';
import { AuthGate } from '@/components/auth-gate';
import { CampaignTable } from '@/components/campaign-table';
import { ChannelTable } from '@/components/channel-table';
import { CreateCampaignDialog } from '@/components/create-campaign-dialog';
import { LastUpdated } from '@/components/last-updated';
import { usePolling } from '@/hooks/use-polling';
import { apiFetch } from '@/lib/api';
import type { CampaignRow, ChannelStat } from '@/lib/types';

interface DashboardData {
  campaigns: CampaignRow[];
  channels: ChannelStat[];
}

/** 캠페인·채널 성과를 한 번에 조회한다(usePolling 하나로 통합, ADR 0016). */
async function fetchDashboardData(): Promise<DashboardData> {
  const [campaigns, channels] = await Promise.all([
    apiFetch<CampaignRow[]>('/api/admin/analytics/campaigns'),
    apiFetch<ChannelStat[]>('/api/admin/analytics/channels'),
  ]);
  return { campaigns, channels };
}

export default function DashboardPage() {
  const { data, error, lastUpdatedAt, isRefreshing, refresh } = usePolling(fetchDashboardData);
  const loading = !data && !error;

  return (
    <AuthGate>
      <AppShell>
        <div className="flex flex-col gap-8">
          <div className="flex items-center justify-end">
            <LastUpdated lastUpdatedAt={lastUpdatedAt} error={error} isRefreshing={isRefreshing} onRefresh={refresh} />
          </div>

          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">캠페인 성과</h2>
              <CreateCampaignDialog onCreated={refresh} />
            </div>
            <CampaignTable rows={data?.campaigns ?? []} loading={loading} />
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">채널 성과</h2>
            <ChannelTable stats={data?.channels ?? []} loading={loading} />
          </section>
        </div>
      </AppShell>
    </AuthGate>
  );
}
