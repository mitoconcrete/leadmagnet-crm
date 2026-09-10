'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ApiError, apiFetch } from '@/lib/api';
import { formatDateKST } from '@/lib/format';
import type { Template } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface DeleteConflictDetails {
  forms: number;
  visits: number;
  submissions: number;
}

/**
 * 등록된 HTML 템플릿 목록. refreshKey가 바뀌면 다시 조회한다.
 * 행마다 미리보기(iframe sandbox)·코드 보기(<pre> 텍스트, 렌더 금지)·삭제를 제공한다(ADR 0014).
 * 삭제가 409(참조 있음)면 확인 대화상자를 띄우고, 확인하면 force=true로 재요청한다.
 */
export function TemplateTable({ refreshKey = 0 }: { refreshKey?: number }) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);

  const [codeTemplate, setCodeTemplate] = useState<Template | null>(null);
  const [codeHtml, setCodeHtml] = useState<string | null>(null);

  const [conflictTemplate, setConflictTemplate] = useState<Template | null>(null);
  const [conflictDetails, setConflictDetails] = useState<DeleteConflictDetails | null>(null);

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
  }, [refreshKey, reloadKey]);

  function closeCode() {
    setCodeTemplate(null);
    setCodeHtml(null);
  }

  async function openCode(template: Template) {
    setCodeTemplate(template);
    setCodeHtml(null);
    try {
      const detail = await apiFetch<Template>(`/api/admin/templates/${template.id}`);
      setCodeHtml(detail.html ?? '');
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : '코드를 불러오지 못했습니다');
      closeCode();
    }
  }

  async function handleCopyCode() {
    if (codeHtml === null) return;
    try {
      await navigator.clipboard.writeText(codeHtml);
      toast.success('코드를 복사했습니다');
    } catch {
      toast.error('코드를 복사하지 못했습니다');
    }
  }

  function closeConflict() {
    setConflictTemplate(null);
    setConflictDetails(null);
  }

  async function handleDelete(template: Template) {
    try {
      await apiFetch<void>(`/api/admin/templates/${template.id}`, { method: 'DELETE' });
      toast.success('템플릿을 삭제했습니다');
      setReloadKey((key) => key + 1);
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        const details = (error.details as DeleteConflictDetails | undefined) ?? {
          forms: 0,
          visits: 0,
          submissions: 0,
        };
        setConflictTemplate(template);
        setConflictDetails(details);
        return;
      }
      toast.error(error instanceof ApiError ? error.message : '템플릿을 삭제하지 못했습니다');
    }
  }

  async function handleForceDelete() {
    if (!conflictTemplate) return;
    try {
      await apiFetch<void>(`/api/admin/templates/${conflictTemplate.id}?force=true`, { method: 'DELETE' });
      toast.success('템플릿을 삭제했습니다');
      setReloadKey((key) => key + 1);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : '템플릿을 삭제하지 못했습니다');
    } finally {
      closeConflict();
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">불러오는 중…</p>;
  }

  if (templates.length === 0) {
    return <p className="text-sm text-muted-foreground">등록된 템플릿이 없습니다.</p>;
  }

  const conflictMessage = conflictDetails
    ? `이 템플릿을 쓰는 폼 ${conflictDetails.forms}개, 방문 ${conflictDetails.visits}건, 신청 ${conflictDetails.submissions}건이 있습니다. 삭제하면 해당 폼의 공개 페이지가 닫히고(통계는 유지) 되돌릴 수 없습니다. 정말 삭제할까요?`
    : '';

  return (
    <>
      <div
        role="region"
        aria-label="템플릿 목록"
        className="min-h-0 flex-1 overflow-y-auto"
      >
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-background">
            <TableRow>
              <TableHead>이름</TableHead>
              <TableHead>파일명</TableHead>
              <TableHead className="text-right tabular-nums">크기</TableHead>
              <TableHead>등록일</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {templates.map((template) => (
              <TableRow key={template.id}>
                <TableCell>{template.name}</TableCell>
                <TableCell>{template.originalFilename}</TableCell>
                <TableCell className="text-right tabular-nums">{(template.sizeBytes / 1024).toFixed(1)}KB</TableCell>
                <TableCell>{formatDateKST(template.createdAt)}</TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setPreviewTemplate(template)}>
                      미리보기
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => openCode(template)}>
                      코드
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => handleDelete(template)}>
                      삭제
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={previewTemplate !== null} onOpenChange={(open) => !open && setPreviewTemplate(null)}>
        <DialogContent className="flex h-[85vh] w-[min(64rem,95vw)] max-w-none sm:max-w-none flex-col">
          <DialogHeader>
            <DialogTitle>{previewTemplate?.name}</DialogTitle>
          </DialogHeader>
          {previewTemplate && (
            <iframe
              title="템플릿 미리보기"
              sandbox="allow-scripts allow-forms"
              src={`/api/admin/templates/${previewTemplate.id}/preview`}
              className="h-full w-full min-h-0 flex-1 overflow-auto border-0"
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={codeTemplate !== null} onOpenChange={(open) => !open && closeCode()}>
        <DialogContent className="flex h-[85vh] w-[min(64rem,95vw)] max-w-none sm:max-w-none flex-col">
          <DialogHeader>
            <DialogTitle>{codeTemplate?.name} 코드</DialogTitle>
          </DialogHeader>
          {codeHtml === null ? (
            <p className="text-sm text-muted-foreground">불러오는 중…</p>
          ) : (
            <>
              <pre className="min-h-0 flex-1 overflow-auto rounded-lg bg-muted p-3 text-xs whitespace-pre-wrap">
                {codeHtml}
              </pre>
              <Button variant="outline" size="sm" className="self-start" onClick={handleCopyCode}>
                복사
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={conflictTemplate !== null} onOpenChange={(open) => !open && closeConflict()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>템플릿을 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>{conflictMessage}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleForceDelete}>
              정말 삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
