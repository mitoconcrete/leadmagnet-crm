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
        {/* 데스크톱 우선(ADR 0021): 바깥은 h-full 그리드로 상단 바·본문 두 행만 나누고, 스크롤은 각 섹션 안에서만 일어난다. */}
        <div className="grid h-full min-h-0 grid-rows-[auto_1fr] gap-4 p-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold">대시보드</h1>
            <div className="flex items-center gap-3">
              <LastUpdated lastUpdatedAt={lastUpdatedAt} error={error} isRefreshing={isRefreshing} onRefresh={refresh} />
              <CreateCampaignDialog onCreated={refresh} />
            </div>
          </div>

          <div data-testid="dashboard-columns" className="grid min-h-0 grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
            <section className="flex min-h-0 flex-col gap-3">
              <h2 className="text-lg font-semibold">캠페인 성과</h2>
              <CampaignTable rows={data?.campaigns ?? []} loading={loading} />
            </section>

            <section className="flex min-h-0 flex-col gap-3">
              <h2 className="text-lg font-semibold">채널 성과</h2>
              <ChannelTable stats={data?.channels ?? []} loading={loading} />
            </section>
          </div>
        </div>
      </AppShell>
    </AuthGate>
  );
}
