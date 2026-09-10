'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { ApiError, apiFetch } from '@/lib/api';
import type { Form } from '@/lib/types';
import { LinkPanel } from '@/components/link-panel';

/**
 * 캠페인에 속한 폼 목록. 폼마다 활성 토글, 공개 URL 복사, 배포 링크 패널을 보여준다.
 * linksDisabled가 true면(캠페인 종료) 배포 링크 생성 버튼을 비활성화한다(ADR 0019).
 */
export function FormList({
  campaignId,
  refreshKey = 0,
  linksDisabled = false,
  campaignArchived = false,
}: {
  campaignId: string;
  refreshKey?: number;
  linksDisabled?: boolean;
  campaignArchived?: boolean;
}) {
  const [forms, setForms] = useState<Form[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    apiFetch<Form[]>(`/api/admin/forms?campaignId=${campaignId}`)
      .then((data) => {
        if (active) setForms(data);
      })
      .catch((error) => {
        if (!active) return;
        toast.error(error instanceof ApiError ? error.message : '폼 목록을 불러오지 못했습니다');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [campaignId, refreshKey]);

  async function handleToggle(form: Form, isActive: boolean) {
    setForms((prev) => prev.map((f) => (f.id === form.id ? { ...f, isActive } : f)));
    try {
      await apiFetch<Form>(`/api/admin/forms/${form.id}`, { method: 'PATCH', json: { isActive } });
    } catch {
      toast.error('활성 상태를 변경하지 못했습니다');
      setForms((prev) => prev.map((f) => (f.id === form.id ? { ...f, isActive: !isActive } : f)));
    }
  }

  async function handleCopy(url: string) {
    await navigator.clipboard.writeText(url);
    toast.success('링크를 복사했습니다');
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">불러오는 중…</p>;
  }

  if (forms.length === 0) {
    return <p className="text-sm text-muted-foreground">등록된 폼이 없습니다.</p>;
  }

  return (
    <div
      role="region"
      aria-label="폼 목록"
      className="min-h-0 flex-1 overflow-y-auto"
    >
      <div className="flex flex-col gap-4">
        {forms.map((form) => (
          <FormRow
            key={form.id}
            form={form}
            linksDisabled={linksDisabled}
            campaignArchived={campaignArchived}
            onToggle={(isActive) => handleToggle(form, isActive)}
            onCopy={() => handleCopy(form.publicUrl)}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * 폼 한 행. 배포 링크 패널은 기본 접혀 있고, 펼치기 전에는 LinkPanel을 마운트하지 않는다
 * (열기 전까지 링크 목록을 조회하지 않는다).
 */
function FormRow({
  form,
  linksDisabled,
  campaignArchived,
  onToggle,
  onCopy,
}: {
  form: Form;
  linksDisabled: boolean;
  campaignArchived: boolean;
  onToggle: (isActive: boolean) => void;
  onCopy: () => void;
}) {
  const [linksOpen, setLinksOpen] = useState(false);
  const templateDeleted = form.templateDeleted ?? false;
  const activationBlocked = templateDeleted || campaignArchived;

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div>
            <p className="font-medium">{form.name}</p>
            <p className="text-xs text-muted-foreground">{form.slug}</p>
          </div>
          {templateDeleted && <Badge variant="destructive">템플릿 삭제됨</Badge>}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">활성</span>
          <Switch
            checked={form.isActive}
            disabled={activationBlocked}
            aria-label={
              templateDeleted
                ? '템플릿이 삭제되어 활성화할 수 없습니다'
                : campaignArchived
                  ? '종료된 캠페인의 폼은 활성화할 수 없습니다'
                  : undefined
            }
            onCheckedChange={onToggle}
          />
        </div>
      </div>
      <div className="flex items-center gap-2 text-sm">
        <span className="truncate text-muted-foreground">{form.publicUrl}</span>
        <Button variant="outline" size="sm" disabled={templateDeleted} onClick={onCopy}>
          복사
        </Button>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="self-start"
        aria-expanded={linksOpen}
        onClick={() => setLinksOpen((open) => !open)}
      >
        배포 링크
      </Button>
      {linksOpen && <LinkPanel formId={form.id} disabled={linksDisabled || templateDeleted} />}
    </div>
  );
}
