'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { ApiError, apiFetch } from '@/lib/api';
import type { Campaign, Form } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const STATUS_CHANGE_ERROR_MESSAGE = '캠페인 상태를 변경하지 못했습니다';

type FormCountState = { status: 'loading' } | { status: 'loaded'; count: number } | { status: 'error' };

/**
 * 캠페인 상세 화면의 상단 바(ADR 0021): 이름·설명·상태 배지·종료/재개 액션(ADR 0019).
 * 성과(stat cards·채널 breakdown)는 CampaignStatsPanel이 담당한다.
 */
export function CampaignStatusBar({
  campaignId,
  campaign,
  onCampaignUpdated,
}: {
  campaignId: string;
  campaign: Campaign;
  onCampaignUpdated: (campaign: Campaign) => void;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [formCount, setFormCount] = useState<FormCountState>({ status: 'loading' });
  const [changingStatus, setChangingStatus] = useState(false);

  async function openConfirm() {
    setConfirmOpen(true);
    setFormCount({ status: 'loading' });
    try {
      const forms = await apiFetch<Form[]>(`/api/admin/forms?campaignId=${campaignId}`);
      setFormCount({ status: 'loaded', count: forms.length });
    } catch {
      setFormCount({ status: 'error' });
    }
  }

  async function handleArchive() {
    setChangingStatus(true);
    try {
      const updated = await apiFetch<Campaign>(`/api/admin/campaigns/${campaignId}`, {
        method: 'PATCH',
        json: { status: 'archived' },
      });
      toast.success('캠페인을 종료했습니다');
      onCampaignUpdated(updated);
      setConfirmOpen(false);
    } catch (err) {
      // 실패하면 대화상자는 열어 둔 채 오류만 알린다(재시도 가능하도록).
      toast.error(err instanceof ApiError ? err.message : STATUS_CHANGE_ERROR_MESSAGE);
    } finally {
      setChangingStatus(false);
    }
  }

  async function handleResume() {
    setChangingStatus(true);
    try {
      const updated = await apiFetch<Campaign>(`/api/admin/campaigns/${campaignId}`, {
        method: 'PATCH',
        json: { status: 'active' },
      });
      toast.success('폼은 자동으로 열리지 않습니다. 폼별 활성 토글로 여세요');
      onCampaignUpdated(updated);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : STATUS_CHANGE_ERROR_MESSAGE);
    } finally {
      setChangingStatus(false);
    }
  }

  function confirmDescription() {
    if (formCount.status === 'error') {
      return '폼 수를 확인하지 못했습니다. 종료하면 소속 폼이 모두 닫히고 공개 링크가 404가 됩니다. 집계와 명단은 유지됩니다. 종료할까요?';
    }
    if (formCount.status === 'loading') {
      return '폼 수를 확인하는 중입니다…';
    }
    return `소속 폼 ${formCount.count}개가 닫히고 공개 링크가 404가 됩니다. 집계와 명단은 유지됩니다. 종료할까요?`;
  }

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">{campaign.name}</h1>
        <Badge variant={campaign.status === 'active' ? 'default' : 'secondary'}>
          {campaign.status === 'active' ? '진행중' : '보관됨'}
        </Badge>
        {campaign.description && <p className="text-sm text-muted-foreground">{campaign.description}</p>}
        {campaign.status === 'active' ? (
          <Button variant="destructive" size="sm" disabled={changingStatus} onClick={openConfirm}>
            캠페인 종료
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled={changingStatus} onClick={handleResume}>
            다시 진행
          </Button>
        )}
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>캠페인을 종료할까요?</AlertDialogTitle>
            <AlertDialogDescription>{confirmDescription()}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={changingStatus} onClick={handleArchive}>
              종료
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
