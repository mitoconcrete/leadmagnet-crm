import Link from 'next/link';
import { formatRate } from '@/lib/format';
import type { CampaignRow } from '@/lib/types';
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
      className="max-h-[60vh] overflow-y-auto max-md:max-h-[50vh]"
    >
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-background">
          <TableRow>
            <TableHead>이름</TableHead>
            <TableHead>상태</TableHead>
            <TableHead>방문</TableHead>
            <TableHead>방문자</TableHead>
            <TableHead>신청</TableHead>
            <TableHead>전환율</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.campaignId}>
              <TableCell>
                <Link href={`/campaigns/${row.campaignId}`} className="font-medium text-primary hover:underline">
                  {row.name}
                </Link>
              </TableCell>
              <TableCell>
                <Badge variant={row.status === 'active' ? 'default' : 'secondary'}>
                  {row.status === 'active' ? '진행중' : '보관됨'}
                </Badge>
              </TableCell>
              <TableCell>{row.visits}</TableCell>
              <TableCell>{row.visitors}</TableCell>
              <TableCell>{row.submissions}</TableCell>
              <TableCell>{formatRate(row.conversionRate)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
