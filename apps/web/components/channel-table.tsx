import { formatRate } from '@/lib/format';
import { CHANNELS, CHANNEL_LABELS, type ChannelOrDirect, type ChannelStat } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const CHANNEL_ORDER: ChannelOrDirect[] = ['direct', ...CHANNELS];

/**
 * 채널별 성과 표. 항상 direct, instagram, x, youtube, threads 5행을 순서대로 보여준다.
 * 데이터 조회는 상위(대시보드)에서 usePolling으로 처리하고, 이 컴포넌트는 표시만 담당한다.
 */
export function ChannelTable({ stats, loading }: { stats: ChannelStat[]; loading: boolean }) {
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
