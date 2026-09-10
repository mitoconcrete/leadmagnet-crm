'use client';

import { useState } from 'react';
import { AiPromptBox } from '@/components/ai-prompt-box';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { TemplateUploadForm } from '@/components/template-upload-form';

/**
 * "새 템플릿 등록" 다이얼로그(ADR 0021 2026-09-10 개정). 템플릿 페이지 좌측 좁은 열에
 * 있던 AI 안내·등록 폼을 넓은 모달로 분리해 목록을 전폭으로 쓸 수 있게 한다.
 *
 * 등록 성공(201)만 모달을 닫고 목록을 재조회한다(TemplateUploadForm.onUploaded는
 * 성공했을 때만 호출된다). 차단 거부(400)·점검 경고·입력 검증 오류는 모두 toast로만
 * 안내하고 모달은 열린 채로 유지한다 — toast는 화면 고정 위치라 모달 안에서도 보인다.
 */
export function TemplateRegisterDialog({ onRegistered }: { onRegistered: () => void }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>새 템플릿 등록</Button>} />
      <DialogContent className="flex h-[85vh] max-w-3xl flex-col sm:max-w-none">
        <DialogHeader>
          <DialogTitle>새 템플릿 등록</DialogTitle>
        </DialogHeader>
        <div data-testid="template-register-body" className="flex min-h-0 flex-1 flex-col gap-4">
          <div data-testid="template-register-ai-box" className="shrink-0">
            <AiPromptBox />
          </div>
          <div data-testid="template-register-upload-section" className="flex h-full min-h-0 flex-1 flex-col">
            <TemplateUploadForm
              onUploaded={() => {
                setOpen(false);
                onRegistered();
              }}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
