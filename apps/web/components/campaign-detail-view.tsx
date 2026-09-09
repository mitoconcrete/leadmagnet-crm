'use client';

import { useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { AuthGate } from '@/components/auth-gate';
import { CampaignHeader } from '@/components/campaign-header';
import { CreateFormDialog } from '@/components/create-form-dialog';
import { FormList } from '@/components/form-list';
import { SubmissionTable } from '@/components/submission-table';

/**
 * 캠페인 상세 화면: 헤더(정보·통계), 폼 목록(+생성 다이얼로그), 신청 명단.
 */
export function CampaignDetailView({ campaignId }: { campaignId: string }) {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <AuthGate>
      <AppShell>
        <div className="flex flex-col gap-8">
          <CampaignHeader campaignId={campaignId} />

          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">폼</h2>
              <CreateFormDialog campaignId={campaignId} onCreated={() => setRefreshKey((key) => key + 1)} />
            </div>
            <FormList campaignId={campaignId} refreshKey={refreshKey} />
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">신청 명단</h2>
            <SubmissionTable campaignId={campaignId} />
          </section>
        </div>
      </AppShell>
    </AuthGate>
  );
}
