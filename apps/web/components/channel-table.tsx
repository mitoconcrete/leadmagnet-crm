'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { formatRate } from '@/lib/format';
import { CHANNELS, CHANNEL_LABELS, type ChannelOrDirect, type ChannelStat } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const CHANNEL_ORDER: ChannelOrDirect[] = ['direct', ...CHANNELS];

/**
 * 채널별 성과 표. 항상 direct, instagram, x, youtube, threads 5행을 순서대로 보여준다.
 */
export function ChannelTable({ refreshKey = 0 }: { refreshKey?: number }) {
  const [stats, setStats] = useState<ChannelStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    apiFetch<ChannelStat[]>('/api/admin/analytics/channels')
      .then((data) => {
        if (active) setStats(data);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [refreshKey]);

  if (loading) {
    return <p className="text-sm text-muted-foreground">불러오는 중…</p>;
  }

  const byChannel = new Map(stats.map((s) => [s.channel, s]));

  return (
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
  );
}
