import { formatDateKST } from '@/lib/format';
import { CHANNEL_LABELS, type SubmissionPage } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

/**
 * 캠페인의 신청 명단을 페이지네이션과 함께 보여준다. 데이터 조회·자동 갱신은 상위(캠페인 상세)가 담당한다.
 */
export function SubmissionTable({
  data,
  loading,
  page,
  onPageChange,
}: {
  data: SubmissionPage | null;
  loading: boolean;
  page: number;
  onPageChange: (page: number) => void;
}) {
  if (loading) {
    return <p className="text-sm text-muted-foreground">불러오는 중…</p>;
  }

  const items = data?.items ?? [];

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">신청 내역이 없습니다.</p>;
  }

  const total = data?.total ?? 0;
  const limit = data?.limit ?? 20;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="flex flex-col gap-3">
      <div
        role="region"
        aria-label="신청 명단"
        className="max-h-[60vh] overflow-y-auto max-md:max-h-[50vh]"
      >
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-background">
            <TableRow>
              <TableHead>시각</TableHead>
              <TableHead>폼</TableHead>
              <TableHead>채널</TableHead>
              <TableHead>내용</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{formatDateKST(item.createdAt)}</TableCell>
                <TableCell>{item.formName}</TableCell>
                <TableCell>{CHANNEL_LABELS[item.channel]}</TableCell>
                <TableCell>
                  <ul className="flex flex-col gap-0.5">
                    {Object.entries(item.payload).map(([key, value]) => (
                      <li key={key}>
                        <span className="text-muted-foreground">{key}:</span>{' '}
                        {typeof value === 'string'
                          ? value
                          : Array.isArray(value)
                            ? value.join(', ')
                            : JSON.stringify(value)}
                      </li>
                    ))}
                  </ul>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {page} / {totalPages}페이지 (총 {total}건)
        </span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
            이전
          </Button>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
            다음
          </Button>
        </div>
      </div>
    </div>
  );
}
