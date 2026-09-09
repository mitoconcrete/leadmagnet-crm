'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { formatDateKST } from '@/lib/format';
import { CHANNEL_LABELS, type SubmissionPage } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { usePolling } from '@/hooks/use-polling';

/**
 * 캠페인의 신청 명단을 페이지네이션과 함께 보여준다. usePolling으로 30초마다 현재 페이지를 다시 조회한다(ADR 0016).
 */
export function SubmissionTable({ campaignId }: { campaignId: string }) {
  const [page, setPage] = useState(1);

  const fetchSubmissions = useCallback(
    () => apiFetch<SubmissionPage>(`/api/admin/submissions?campaignId=${campaignId}&page=${page}`),
    [campaignId, page],
  );
  const { data, error, refresh } = usePolling(fetchSubmissions);

  // 페이지가 바뀌면(마운트 직후 제외) 폴링 주기와 별개로 즉시 다시 조회한다.
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const loading = !data && !error;

  if (loading) {
    return <p className="text-sm text-muted-foreground">불러오는 중…</p>;
  }

  const items = data?.items ?? [];

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">신청 내역이 없습니다.</p>;
  }

  const total = data?.total ?? 0;
  const limit = data?.limit ?? 20;
  const currentPage = data?.page ?? page;
  const totalPages = Math.max(1, Math.ceil(total / limit));

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
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {currentPage} / {totalPages}페이지 (총 {total}건)
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
