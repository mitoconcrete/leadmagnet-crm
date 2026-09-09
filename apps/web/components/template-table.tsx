'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ApiError, apiFetch } from '@/lib/api';
import { formatDateKST } from '@/lib/format';
import type { Template } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

/**
 * 등록된 HTML 템플릿 목록. refreshKey가 바뀌면 다시 조회한다.
 */
export function TemplateTable({ refreshKey = 0 }: { refreshKey?: number }) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    apiFetch<Template[]>('/api/admin/templates')
      .then((data) => {
        if (active) setTemplates(data);
      })
      .catch((error) => {
        if (!active) return;
        toast.error(error instanceof ApiError ? error.message : '템플릿 목록을 불러오지 못했습니다');
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

  if (templates.length === 0) {
    return <p className="text-sm text-muted-foreground">등록된 템플릿이 없습니다.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>이름</TableHead>
          <TableHead>파일명</TableHead>
          <TableHead>크기</TableHead>
          <TableHead>등록일</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {templates.map((template) => (
          <TableRow key={template.id}>
            <TableCell>{template.name}</TableCell>
            <TableCell>{template.originalFilename}</TableCell>
            <TableCell>{(template.sizeBytes / 1024).toFixed(1)}KB</TableCell>
            <TableCell>{formatDateKST(template.createdAt)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
