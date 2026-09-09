'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { AppShell } from '@/components/app-shell';
import { AuthGate } from '@/components/auth-gate';
import { CampaignHeader } from '@/components/campaign-header';
import { CreateFormDialog } from '@/components/create-form-dialog';
import { FormList } from '@/components/form-list';
import { LastUpdated } from '@/components/last-updated';
import { SubmissionTable } from '@/components/submission-table';
import { usePolling } from '@/hooks/use-polling';
import { ApiError, apiFetch } from '@/lib/api';
import type { Campaign, CampaignStats, SubmissionPage } from '@/lib/types';

const LOAD_ERROR_MESSAGE = '캠페인 정보를 불러오지 못했습니다';

interface CampaignDetailData {
  stats: CampaignStats;
  submissions: SubmissionPage;
}

/**
 * 캠페인 상세 화면: 헤더(정보·통계), 폼 목록(+생성 다이얼로그), 신청 명단.
 * 캠페인 정보(이름·상태)는 마운트 시 한 번 조회하고, 성과(stats·채널 breakdown·신청 명단)는
 * 하나의 usePolling(Promise.all)으로 묶어 30초마다 함께 갱신한다(ADR 0016).
 * 캠페인이 종료(archived)되면 폼 생성 버튼을 비활성화한다(ADR 0019).
 */
export function CampaignDetailView({ campaignId }: { campaignId: string }) {
  const [formRefreshKey, setFormRefreshKey] = useState(0);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [campaignError, setCampaignError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    let active = true;
    setCampaignError(null);

    apiFetch<Campaign>(`/api/admin/campaigns/${campaignId}`)
      .then((data) => {
        if (active) setCampaign(data);
      })
      .catch((err) => {
        if (!active) return;
        const message = err instanceof ApiError ? err.message : LOAD_ERROR_MESSAGE;
        toast.error(message);
        setCampaignError(message);
      });
    return () => {
      active = false;
    };
  }, [campaignId]);

  const fetchDetailData = useCallback(async (): Promise<CampaignDetailData> => {
    const [stats, submissions] = await Promise.all([
      apiFetch<CampaignStats>(`/api/admin/campaigns/${campaignId}/stats`),
      apiFetch<SubmissionPage>(`/api/admin/submissions?campaignId=${campaignId}&page=${page}`),
    ]);
    return { stats, submissions };
  }, [campaignId, page]);

  const { data, error, lastUpdatedAt, isRefreshing, refresh } = usePolling(fetchDetailData);

  // 신청 명단 페이지가 바뀌면(마운트 직후 제외) 폴링 주기와 별개로 즉시 다시 조회한다.
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  function handleCampaignUpdated(updated: Campaign) {
    setCampaign(updated);
    setFormRefreshKey((key) => key + 1);
  }

  if (campaignError) {
    return (
      <AuthGate>
        <AppShell>
          <p className="text-sm text-destructive">{campaignError}</p>
        </AppShell>
      </AuthGate>
    );
  }

  if (!campaign) {
    return (
      <AuthGate>
        <AppShell>
          <p className="text-sm text-muted-foreground">불러오는 중…</p>
        </AppShell>
      </AuthGate>
    );
  }

  const isArchived = campaign.status === 'archived';
  const submissionsLoading = !data && !error;

  return (
    <AuthGate>
      <AppShell>
        <div className="flex flex-col gap-8">
          <div className="flex items-center justify-end">
            <LastUpdated lastUpdatedAt={lastUpdatedAt} error={error} isRefreshing={isRefreshing} onRefresh={refresh} />
          </div>

          <CampaignHeader
            campaignId={campaignId}
            campaign={campaign}
            stats={data?.stats ?? null}
            onCampaignUpdated={handleCampaignUpdated}
          />

          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">폼</h2>
              <div className="flex items-center gap-2">
                {isArchived && (
                  <span className="text-xs text-muted-foreground">종료된 캠페인에는 새 폼을 만들 수 없습니다</span>
                )}
                <CreateFormDialog
                  campaignId={campaignId}
                  disabled={isArchived}
                  onCreated={() => setFormRefreshKey((key) => key + 1)}
                />
              </div>
            </div>
            <FormList campaignId={campaignId} refreshKey={formRefreshKey} linksDisabled={isArchived} />
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">신청 명단</h2>
            <SubmissionTable
              data={data?.submissions ?? null}
              loading={submissionsLoading}
              page={page}
              onPageChange={setPage}
            />
          </section>
        </div>
      </AppShell>
    </AuthGate>
  );
}
