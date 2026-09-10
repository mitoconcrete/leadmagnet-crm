'use client';

import { useRef, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { ApiError, apiFetch } from '@/lib/api';
import type { Template } from '@/lib/types';

const FILE_FORM_ID = 'template-file-form';
const PASTE_FORM_ID = 'template-paste-form';

/**
 * HTML 템플릿 등록 폼. "파일 업로드"와 "HTML 붙여넣기" 두 탭으로 같은
 * POST /api/admin/templates를 호출한다(ADR 0014). 성공하면 목록 재조회를 위해
 * onUploaded를 호출한다. 등록 직후 응답의 점검 경고(warnings, ADR 0018)를
 * 폼 아래에 보여준다.
 *
 * 레이아웃(ADR 0021 2026-09-10): 탭 토글은 상단 고정, 등록 버튼은 하단 고정
 * 푸터에 두고, 그 사이(이름·파일·textarea·점검 경고)만 자체 스크롤한다. 등록
 * 버튼은 폼 밖 푸터에 있지만 `form` 속성으로 현재 탭의 <form>과 연결되어
 * submit 동작은 그대로 유지된다.
 */
export function TemplateUploadForm({ onUploaded }: { onUploaded: () => void }) {
  const [activeTab, setActiveTab] = useState<'file' | 'paste'>('file');
  const [fileName, setFileName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [pasteName, setPasteName] = useState('');
  const [pasteHtml, setPasteHtml] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [warnings, setWarnings] = useState<string[] | null>(null);
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
    setWarnings(null);
    try {
      const created = await apiFetch<Template>('/api/admin/templates', { method: 'POST', body: formData });
      toast.success('템플릿을 등록했습니다');
      setWarnings(created.warnings ?? []);
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
    <div className="flex h-full min-h-0 flex-col">
      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as 'file' | 'paste')}
        className="flex min-h-0 flex-1 flex-col max-w-2xl"
      >
        <TabsList className="sticky top-0 z-10 shrink-0 bg-background pb-2">
          <TabsTrigger value="file">파일 업로드</TabsTrigger>
          <TabsTrigger value="paste">HTML 붙여넣기</TabsTrigger>
        </TabsList>

        <div data-testid="upload-scroll" className="min-h-0 flex-1 overflow-y-auto">
          <TabsContent value="file">
            <form id={FILE_FORM_ID} className="flex flex-col gap-4" onSubmit={handleFileSubmit}>
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
            </form>
          </TabsContent>

          <TabsContent value="paste">
            <form id={PASTE_FORM_ID} className="flex flex-col gap-4" onSubmit={handlePasteSubmit}>
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
                  className="h-64 max-h-64 resize-none font-mono text-xs"
                />
              </div>
            </form>
          </TabsContent>

          {warnings !== null && (
            <Alert className="relative mt-3 max-w-2xl">
              <AlertTitle>{warnings.length > 0 ? `점검 결과 ${warnings.length}건` : '점검 이상 없음'}</AlertTitle>
              <AlertDescription>
                {warnings.length > 0 ? (
                  <ul className="list-disc pl-5">
                    {warnings.map((warning, index) => (
                      <li key={index}>{warning}</li>
                    ))}
                  </ul>
                ) : (
                  '등록 규칙을 벗어난 요소를 찾지 못했습니다.'
                )}
              </AlertDescription>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute top-1.5 right-1.5"
                onClick={() => setWarnings(null)}
              >
                닫기
              </Button>
            </Alert>
          )}
        </div>
      </Tabs>

      <div data-testid="upload-footer" className="shrink-0 border-t bg-background pt-3">
        <Button type="submit" form={activeTab === 'file' ? FILE_FORM_ID : PASTE_FORM_ID} disabled={submitting}>
          {submitting ? '등록 중…' : '템플릿 등록'}
        </Button>
      </div>
    </div>
  );
}
