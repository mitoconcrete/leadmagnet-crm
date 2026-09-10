import Link from 'next/link';
import { formatRate } from '@/lib/format';
import {
  VISIT_STAT_LABEL,
  VISIT_STAT_TITLE,
  VISITOR_STAT_LABEL,
  VISITOR_STAT_TITLE,
  type CampaignRow,
} from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

/**
 * 캠페인별 성과 표. 데이터 조회는 상위(대시보드)에서 usePolling으로 처리하고, 이 컴포넌트는 표시만 담당한다.
 */
export function CampaignTable({ rows, loading }: { rows: CampaignRow[]; loading: boolean }) {
  if (loading) {
    return <p className="text-sm text-muted-foreground">불러오는 중…</p>;
  }

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">등록된 캠페인이 없습니다.</p>;
  }

  return (
    <div
      role="region"
      aria-label="캠페인 성과 목록"
      className="min-h-0 flex-1 overflow-y-auto"
    >
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-background">
          <TableRow>
            <TableHead>이름</TableHead>
            <TableHead>상태</TableHead>
            <TableHead className="text-right tabular-nums">폼(활성/전체)</TableHead>
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
          {rows.map((row) => {
            const forms = row.forms ?? 0;
            const activeForms = row.activeForms ?? 0;
            const noActiveForm = row.status === 'active' && activeForms === 0;
            return (
              <TableRow key={row.campaignId}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Link href={`/campaigns/${row.campaignId}`} className="font-medium text-primary hover:underline">
                      {row.name}
                    </Link>
                    {noActiveForm && (
                      <Badge variant="outline" title="템플릿 삭제 등으로 폼이 모두 비활성 상태입니다">
                        활성 폼 없음
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={row.status === 'active' ? 'default' : 'secondary'}>
                    {row.status === 'active' ? '진행중' : '보관됨'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums">{`${activeForms}/${forms}`}</TableCell>
                <TableCell className="text-right tabular-nums">{row.visits}</TableCell>
                <TableCell className="text-right tabular-nums">{row.visitors}</TableCell>
                <TableCell className="text-right tabular-nums">{row.submissions}</TableCell>
                <TableCell className="text-right tabular-nums">{formatRate(row.conversionRate)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
