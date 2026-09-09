'use client';

import { useRef, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { ApiError, apiFetch } from '@/lib/api';
import type { Template } from '@/lib/types';

/**
 * HTML 템플릿 등록 폼. "파일 업로드"와 "HTML 붙여넣기" 두 탭으로 같은
 * POST /api/admin/templates를 호출한다(ADR 0014). 성공하면 목록 재조회를 위해
 * onUploaded를 호출한다.
 */
export function TemplateUploadForm({ onUploaded }: { onUploaded: () => void }) {
  const [fileName, setFileName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [pasteName, setPasteName] = useState('');
  const [pasteHtml, setPasteHtml] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;
    if (selected && !selected.name.toLowerCase().endsWith('.html')) {
      toast.error('HTML 파일만 선택할 수 있습니다');
      setFile(null);
      event.target.value = '';
      return;
    }
    setFile(selected);
  }

  async function register(formData: FormData, resetFields: () => void) {
    setSubmitting(true);
    try {
      await apiFetch<Template>('/api/admin/templates', { method: 'POST', body: formData });
      toast.success('템플릿을 등록했습니다');
      resetFields();
      onUploaded();
    } catch (error) {
      const message = error instanceof ApiError ? error.message : '템플릿 등록에 실패했습니다';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleFileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!file) {
      toast.error('HTML 파일을 선택하세요');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    if (fileName) formData.append('name', fileName);

    await register(formData, () => {
      setFileName('');
      setFile(null);
    });
  }

  async function handlePasteSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!pasteName.trim()) {
      toast.error('이름을 입력하세요');
      return;
    }
    if (!pasteHtml.trim()) {
      toast.error('HTML을 붙여넣으세요');
      return;
    }

    const formData = new FormData();
    formData.append('html', pasteHtml);
    formData.append('name', pasteName);

    await register(formData, () => {
      setPasteName('');
      setPasteHtml('');
    });
  }

  return (
    <Tabs defaultValue="file" className="max-w-2xl">
      <TabsList>
        <TabsTrigger value="file">파일 업로드</TabsTrigger>
        <TabsTrigger value="paste">HTML 붙여넣기</TabsTrigger>
      </TabsList>

      <TabsContent value="file">
        <form className="flex flex-col gap-4 sm:flex-row sm:items-end" onSubmit={handleFileSubmit}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="template-name">이름</Label>
            <Input id="template-name" value={fileName} onChange={(e) => setFileName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm leading-none font-medium">HTML 파일</span>
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                id="template-file"
                type="file"
                accept=".html"
                aria-label="HTML 파일"
                className="sr-only"
                onChange={handleFileChange}
              />
              <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                파일 선택
              </Button>
              <span className="text-sm text-muted-foreground">{file ? file.name : '선택된 파일 없음'}</span>
            </div>
          </div>
          <Button type="submit" disabled={submitting}>
            {submitting ? '등록 중…' : '템플릿 등록'}
          </Button>
        </form>
      </TabsContent>

      <TabsContent value="paste">
        <form className="flex flex-col gap-4" onSubmit={handlePasteSubmit}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="template-paste-name">이름</Label>
            <Input id="template-paste-name" value={pasteName} onChange={(e) => setPasteName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="template-paste-html">HTML</Label>
            <Textarea
              id="template-paste-html"
              value={pasteHtml}
              onChange={(e) => setPasteHtml(e.target.value)}
              placeholder="AI가 생성한 HTML 전체를 붙여넣으세요"
              rows={10}
            />
          </div>
          <Button type="submit" disabled={submitting} className="self-start">
            {submitting ? '등록 중…' : '템플릿 등록'}
          </Button>
        </form>
      </TabsContent>
    </Tabs>
  );
}
