'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { ApiError, apiFetch } from '@/lib/api';
import { formatRate } from '@/lib/format';
import type { CampaignRow } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

/**
 * 캠페인별 성과 표. refreshKey가 바뀌면 다시 조회한다.
 */
export function CampaignTable({ refreshKey = 0 }: { refreshKey?: number }) {
  const [rows, setRows] = useState<CampaignRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    apiFetch<CampaignRow[]>('/api/admin/analytics/campaigns')
      .then((data) => {
        if (active) setRows(data);
      })
      .catch((error) => {
        if (!active) return;
        toast.error(error instanceof ApiError ? error.message : '캠페인 성과를 불러오지 못했습니다');
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

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">등록된 캠페인이 없습니다.</p>;
  }

  return (
    <Table>
      <TableHeader>
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
  );
}
