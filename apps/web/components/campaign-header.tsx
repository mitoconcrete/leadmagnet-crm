'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ApiError, apiFetch } from '@/lib/api';
import { formatRate } from '@/lib/format';
import { CHANNELS, CHANNEL_LABELS, type Campaign, type CampaignStats, type ChannelOrDirect } from '@/lib/types';
import { StatCards } from '@/components/stat-cards';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const CHANNEL_ORDER: ChannelOrDirect[] = ['direct', ...CHANNELS];
const LOAD_ERROR_MESSAGE = '캠페인 정보를 불러오지 못했습니다';

/**
 * 캠페인 정보와 stats(전체 + 채널 breakdown 5행)를 보여준다.
 */
export function CampaignHeader({ campaignId }: { campaignId: string }) {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [stats, setStats] = useState<CampaignStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setError(null);

    function handleError(err: unknown) {
      if (!active) return;
      const message = err instanceof ApiError ? err.message : LOAD_ERROR_MESSAGE;
      toast.error(message);
      setError(message);
    }

    apiFetch<Campaign>(`/api/admin/campaigns/${campaignId}`)
      .then((data) => {
        if (active) setCampaign(data);
      })
      .catch(handleError);
    apiFetch<CampaignStats>(`/api/admin/campaigns/${campaignId}/stats`)
      .then((data) => {
        if (active) setStats(data);
      })
      .catch(handleError);
    return () => {
      active = false;
    };
  }, [campaignId]);

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }

  if (!campaign || !stats) {
    return <p className="text-sm text-muted-foreground">불러오는 중…</p>;
  }

  const byChannel = new Map(stats.channels.map((s) => [s.channel, s]));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold">{campaign.name}</h1>
        <Badge variant={campaign.status === 'active' ? 'default' : 'secondary'}>
          {campaign.status === 'active' ? '진행중' : '보관됨'}
        </Badge>
      </div>
      {campaign.description && <p className="text-sm text-muted-foreground">{campaign.description}</p>}

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
    </div>
  );
}
