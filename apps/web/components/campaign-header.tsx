'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { ApiError, apiFetch } from '@/lib/api';
import { formatRate } from '@/lib/format';
import {
  CHANNELS,
  CHANNEL_LABELS,
  type Campaign,
  type CampaignStats,
  type ChannelOrDirect,
  type Form,
} from '@/lib/types';
import { StatCards } from '@/components/stat-cards';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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

const CHANNEL_ORDER: ChannelOrDirect[] = ['direct', ...CHANNELS];
const STATUS_CHANGE_ERROR_MESSAGE = '캠페인 상태를 변경하지 못했습니다';

type FormCountState = { status: 'loading' } | { status: 'loaded'; count: number } | { status: 'error' };

/**
 * 캠페인 정보와 stats(전체 + 채널 breakdown 5행)를 보여준다. 데이터 조회는 상위(캠페인 상세)가 담당하고,
 * 이 컴포넌트는 표시와 종료/재개 액션(ADR 0019)만 담당한다.
 * stats가 null이면(조회 실패) 배지·버튼은 그대로 두고 통계 자리에는 안내 문구를 보여준다(무한 로딩 방지).
 */
export function CampaignHeader({
  campaignId,
  campaign,
  stats,
  onCampaignUpdated,
}: {
  campaignId: string;
  campaign: Campaign;
  stats: CampaignStats | null;
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

  const byChannel = new Map((stats?.channels ?? []).map((s) => [s.channel, s]));

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
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold">{campaign.name}</h1>
        <Badge variant={campaign.status === 'active' ? 'default' : 'secondary'}>
          {campaign.status === 'active' ? '진행중' : '보관됨'}
        </Badge>
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
      {campaign.description && <p className="text-sm text-muted-foreground">{campaign.description}</p>}

      {stats ? (
        <>
          <StatCards
            visits={stats.visits}
            visitors={stats.visitors}
            submissions={stats.submissions}
            conversionRate={stats.conversionRate}
          />

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>채널</TableHead>
                <TableHead>방문</TableHead>
                <TableHead>방문자</TableHead>
                <TableHead>신청</TableHead>
                <TableHead>전환율</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {CHANNEL_ORDER.map((channel) => {
                const stat = byChannel.get(channel);
                return (
                  <TableRow key={channel}>
                    <TableCell>{CHANNEL_LABELS[channel]}</TableCell>
                    <TableCell>{stat?.visits ?? 0}</TableCell>
                    <TableCell>{stat?.visitors ?? 0}</TableCell>
                    <TableCell>{stat?.submissions ?? 0}</TableCell>
                    <TableCell>{formatRate(stat?.conversionRate ?? 0)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </>
      ) : (
        <p className="text-sm text-destructive">성과를 불러오지 못했습니다</p>
      )}

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
