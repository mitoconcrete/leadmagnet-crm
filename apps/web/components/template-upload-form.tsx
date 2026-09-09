'use client';

import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError, apiFetch } from '@/lib/api';
import type { Template } from '@/lib/types';

/**
 * HTML 템플릿 업로드 폼. 성공하면 목록 재조회를 위해 onUploaded를 호출한다.
 */
export function TemplateUploadForm({ onUploaded }: { onUploaded: () => void }) {
  const [name, setName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!file) {
      toast.error('HTML 파일을 선택하세요');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    if (name) formData.append('name', name);

    setSubmitting(true);
    try {
      await apiFetch<Template>('/api/admin/templates', { method: 'POST', body: formData });
      toast.success('템플릿을 등록했습니다');
      setName('');
      setFile(null);
      onUploaded();
    } catch (error) {
      const message = error instanceof ApiError ? error.message : '템플릿 등록에 실패했습니다';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="flex flex-col gap-4 sm:flex-row sm:items-end" onSubmit={handleSubmit}>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="template-name">이름</Label>
        <Input id="template-name" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="template-file">HTML 파일</Label>
        <input
          id="template-file"
          type="file"
          accept=".html"
          className="text-sm file:mr-2 file:rounded-lg file:border-0 file:bg-muted file:px-2.5 file:py-1"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </div>
      <Button type="submit" disabled={submitting}>
        {submitting ? '등록 중…' : '템플릿 등록'}
      </Button>
    </form>
  );
}
