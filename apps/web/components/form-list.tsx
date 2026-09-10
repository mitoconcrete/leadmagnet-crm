'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ApiError, apiFetch } from '@/lib/api';
import type { Form } from '@/lib/types';
import { LinkPanel } from '@/components/link-panel';

/**
 * 캠페인에 속한 폼 목록. 폼마다 활성 토글과 배포 링크 패널(4채널, 항상 펼침)을 보여준다.
 * 배포 링크 패널은 접기 없이 처음부터 펼쳐져 있다(ADR 0021, 2026-09-10 개정): 운영자가 링크를
 * 바로 복사하는 것이 이 화면의 주목적이라 한 번 더 클릭하게 하지 않는다.
 * 코드 없는 공개 URL 복사는 제공하지 않는다(ADR 0005): 채널 링크만 공유 수단이다.
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
          />
        ))}
      </div>
    </div>
  );
}

/**
 * 폼 한 행. 이름·배지 + 활성 스위치(우측) → "배포 링크" 라벨 → 채널 4행(LinkPanel, 항상 펼침).
 */
function FormRow({
  form,
  linksDisabled,
  campaignArchived,
  onToggle,
}: {
  form: Form;
  linksDisabled: boolean;
  campaignArchived: boolean;
  onToggle: (isActive: boolean) => void;
}) {
  const templateDeleted = form.templateDeleted ?? false;
  const activationBlocked = templateDeleted || campaignArchived;

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
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
      <span className="text-sm text-muted-foreground">배포 링크</span>
      <LinkPanel formId={form.id} disabled={linksDisabled || templateDeleted} />
    </div>
  );
}
