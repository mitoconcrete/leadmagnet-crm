import { formatRate } from '@/lib/format';
import {
  CHANNELS,
  CHANNEL_LABELS,
  VISIT_STAT_LABEL,
  VISIT_STAT_TITLE,
  VISITOR_STAT_LABEL,
  VISITOR_STAT_TITLE,
  type CampaignStats,
  type ChannelOrDirect,
  type ChannelStat,
} from '@/lib/types';
import { StatCards } from '@/components/stat-cards';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const CHANNEL_ORDER: ChannelOrDirect[] = ['direct', ...CHANNELS];

/** direct 행은 visits·visitors·submissions가 모두 0이면 렌더하지 않는다(ADR 0005 결과 절). */
function isHiddenDirect(channel: ChannelOrDirect, stat: ChannelStat | undefined): boolean {
  if (channel !== 'direct') return false;
  return !stat || (stat.visits === 0 && stat.visitors === 0 && stat.submissions === 0);
}

/**
 * 캠페인 상세 좌 열(ADR 0021): stat cards 4개 + 채널 breakdown(direct는 0이면 숨김, ADR 0005).
 * 데이터 조회는 상위(캠페인 상세)가 담당하고, 이 컴포넌트는 표시만 담당한다.
 * stats가 null이면(조회 실패) 안내 문구만 보여준다(무한 로딩 방지).
 */
export function CampaignStatsPanel({ stats }: { stats: CampaignStats | null }) {
  if (!stats) {
    return <p className="text-sm text-destructive">성과를 불러오지 못했습니다</p>;
  }

  const byChannel = new Map(stats.channels.map((s) => [s.channel, s]));

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
      <StatCards
        visits={stats.visits}
        visitors={stats.visitors}
        submissions={stats.submissions}
        conversionRate={stats.conversionRate}
      />

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
    </div>
  );
}
