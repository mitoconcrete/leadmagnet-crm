'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ApiError, apiFetch } from '@/lib/api';
import { formatDateKST } from '@/lib/format';
import { CHANNEL_LABELS, type SubmissionPage } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

/**
 * 캠페인의 신청 명단을 페이지네이션과 함께 보여준다.
 */
export function SubmissionTable({ campaignId }: { campaignId: string }) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<SubmissionPage | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    apiFetch<SubmissionPage>(`/api/admin/submissions?campaignId=${campaignId}&page=${page}`)
      .then((res) => {
        if (active) setData(res);
      })
      .catch((error) => {
        if (!active) return;
        toast.error(error instanceof ApiError ? error.message : '신청 명단을 불러오지 못했습니다');
        // 무한 로딩에 빠지지 않도록 빈 목록으로 대체해 "신청 내역이 없습니다." 상태를 보여준다.
        setData({ items: [], total: 0, page, limit: 20 });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [campaignId, page]);

  if (loading || !data) {
    return <p className="text-sm text-muted-foreground">불러오는 중…</p>;
  }

  if (data.items.length === 0) {
    return <p className="text-sm text-muted-foreground">신청 내역이 없습니다.</p>;
  }

  const totalPages = Math.max(1, Math.ceil(data.total / data.limit));

  return (
    <div className="flex flex-col gap-3">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>시각</TableHead>
            <TableHead>폼</TableHead>
            <TableHead>채널</TableHead>
            <TableHead>내용</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.items.map((item) => (
            <TableRow key={item.id}>
              <TableCell>{formatDateKST(item.createdAt)}</TableCell>
              <TableCell>{item.formName}</TableCell>
              <TableCell>{CHANNEL_LABELS[item.channel]}</TableCell>
              <TableCell>
                <ul className="flex flex-col gap-0.5">
                  {Object.entries(item.payload).map(([key, value]) => (
                    <li key={key}>
                      <span className="text-muted-foreground">{key}:</span>{' '}
                      {Array.isArray(value) ? value.join(', ') : value}
                    </li>
                  ))}
                </ul>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {data.page} / {totalPages}페이지 (총 {data.total}건)
        </span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            이전
          </Button>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            다음
          </Button>
        </div>
      </div>
    </div>
  );
}
