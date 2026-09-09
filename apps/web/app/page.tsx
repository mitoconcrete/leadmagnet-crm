'use client';

import { useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { AuthGate } from '@/components/auth-gate';
import { CampaignTable } from '@/components/campaign-table';
import { ChannelTable } from '@/components/channel-table';
import { CreateCampaignDialog } from '@/components/create-campaign-dialog';

export default function DashboardPage() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <AuthGate>
      <AppShell>
        <div className="flex flex-col gap-8">
          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">캠페인 성과</h2>
              <CreateCampaignDialog onCreated={() => setRefreshKey((key) => key + 1)} />
            </div>
            <CampaignTable refreshKey={refreshKey} />
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">채널 성과</h2>
            <ChannelTable refreshKey={refreshKey} />
          </section>
        </div>
      </AppShell>
    </AuthGate>
  );
}
