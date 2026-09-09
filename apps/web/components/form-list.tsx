'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
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
}: {
  campaignId: string;
  refreshKey?: number;
  linksDisabled?: boolean;
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
    <div className="flex flex-col gap-4">
      {forms.map((form) => (
        <div key={form.id} className="flex flex-col gap-3 rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{form.name}</p>
              <p className="text-xs text-muted-foreground">{form.slug}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">활성</span>
              <Switch checked={form.isActive} onCheckedChange={(checked) => handleToggle(form, checked)} />
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="truncate text-muted-foreground">{form.publicUrl}</span>
            <Button variant="outline" size="sm" onClick={() => handleCopy(form.publicUrl)}>
              복사
            </Button>
          </div>
          <LinkPanel formId={form.id} disabled={linksDisabled} />
        </div>
      ))}
    </div>
  );
}
