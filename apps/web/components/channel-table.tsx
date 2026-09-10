import { formatRate } from '@/lib/format';
import {
  CHANNELS,
  CHANNEL_LABELS,
  VISIT_STAT_LABEL,
  VISIT_STAT_TITLE,
  VISITOR_STAT_LABEL,
  VISITOR_STAT_TITLE,
  type ChannelOrDirect,
  type ChannelStat,
} from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const CHANNEL_ORDER: ChannelOrDirect[] = ['direct', ...CHANNELS];

/** direct 행은 visits·visitors·submissions가 모두 0이면 렌더하지 않는다(ADR 0005 결과 절). */
function isHiddenDirect(channel: ChannelOrDirect, stat: ChannelStat | undefined): boolean {
  if (channel !== 'direct') return false;
  return !stat || (stat.visits === 0 && stat.visitors === 0 && stat.submissions === 0);
}

/**
 * 채널별 성과 표. instagram, x, youtube, threads 4행은 항상 순서대로 보여주고,
 * direct 행은 값이 하나라도 0이 아닐 때만 맨 위에 보여준다(ADR 0005 결과 절).
 * 데이터 조회는 상위(대시보드)에서 usePolling으로 처리하고, 이 컴포넌트는 표시만 담당한다.
 */
export function ChannelTable({ stats, loading }: { stats: ChannelStat[]; loading: boolean }) {
  if (loading) {
    return <p className="text-sm text-muted-foreground">불러오는 중…</p>;
  }

  const byChannel = new Map(stats.map((s) => [s.channel, s]));

  return (
    <Table>
      <TableHeader className="sticky top-0 z-10 bg-inherit">
        <TableRow>
          <TableHead>채널</TableHead>
          <TableHead className="text-right tabular-nums" title={VISIT_STAT_TITLE}>
            {VISIT_STAT_LABEL}
          </TableHead>
          <TableHead className="text-right tabular-nums" title={VISITOR_STAT_TITLE}>
            {VISITOR_STAT_LABEL}
          </TableHead>
          <TableHead className="text-right tabular-nums">신청</TableHead>
          <TableHead className="text-right tabular-nums">전환율</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {CHANNEL_ORDER.filter((channel) => !isHiddenDirect(channel, byChannel.get(channel))).map((channel) => {
          const stat = byChannel.get(channel);
          return (
            <TableRow key={channel}>
              <TableCell>{CHANNEL_LABELS[channel]}</TableCell>
              <TableCell className="text-right tabular-nums">{stat?.visits ?? 0}</TableCell>
              <TableCell className="text-right tabular-nums">{stat?.visitors ?? 0}</TableCell>
              <TableCell className="text-right tabular-nums">{stat?.submissions ?? 0}</TableCell>
              <TableCell className="text-right tabular-nums">{formatRate(stat?.conversionRate ?? 0)}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
