'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { TemplateUploadForm } from '@/components/template-upload-form';

/**
 * "새 템플릿 등록" 다이얼로그(ADR 0021 2026-09-10 개정, 추가 개정). 템플릿 페이지 좌측
 * 좁은 열에 있던 AI 안내·등록 폼을 넓은 모달로 분리해 목록을 전폭으로 쓸 수 있게 한다.
 *
 * AI 안내(AiPromptBox)는 이 다이얼로그가 아니라 TemplateUploadForm의 탭 토글 줄
 * 우측에 작은 팁 버튼으로 렌더된다(폭이 안 맞는 전폭 트리거 대신 탭 줄과 어울리는
 * 크기). 등록 폼 영역(flex-1 min-h-0)이 모달의 남는 세로 공간 전부를 차지해 HTML
 * 붙여넣기 textarea가 넓게 보인다.
 *
 * 차단 거부(400)·입력 검증 오류는 모달을 열어 둔 채 toast로 안내하고, 성공(201,
 * 경고 포함)이면 모달을 닫고 목록을 갱신한다(경고는 toast로 표시). 등록은 성공이고
 * 경고는 toast로 확인할 수 있으므로 경고가 있다고 모달을 열어 둘 이유는 없다 —
 * TemplateUploadForm.onUploaded는 성공(2xx) 응답에서만 호출되므로 그 콜백에서
 * 모달을 닫는다.
 */
export function TemplateRegisterDialog({ onRegistered }: { onRegistered: () => void }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>새 템플릿 등록</Button>} />
      <DialogContent className="flex h-[85vh] max-w-4xl flex-col sm:max-w-none">
        <DialogHeader>
          <DialogTitle>새 템플릿 등록</DialogTitle>
        </DialogHeader>
        <div data-testid="template-register-body" className="flex min-h-0 flex-1 flex-col">
          <TemplateUploadForm
            onUploaded={() => {
              setOpen(false);
              onRegistered();
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
