import { formatRate } from '@/lib/format';
import { CHANNELS, CHANNEL_LABELS, type CampaignStats, type ChannelOrDirect } from '@/lib/types';
import { StatCards } from '@/components/stat-cards';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const CHANNEL_ORDER: ChannelOrDirect[] = ['direct', ...CHANNELS];

/**
 * 캠페인 상세 좌 열(ADR 0021): stat cards 4개 + 채널 breakdown 5행.
 * 데이터 조회는 상위(캠페인 상세)가 담당하고, 이 컴포넌트는 표시만 담당한다.
 * stats가 null이면(조회 실패) 안내 문구만 보여준다(무한 로딩 방지).
 */
export function CampaignStatsPanel({ stats }: { stats: CampaignStats | null }) {
  if (!stats) {
    return <p className="text-sm text-destructive">성과를 불러오지 못했습니다</p>;
  }

  const byChannel = new Map(stats.channels.map((s) => [s.channel, s]));

  return (
    <div className="flex min-h-0 flex-col gap-4 overflow-y-auto">
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
