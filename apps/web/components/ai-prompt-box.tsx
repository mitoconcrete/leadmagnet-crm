'use client';

import { useState } from 'react';
import { ChevronDownIcon, SparklesIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { CardDescription, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { AI_PROMPT_TEMPLATE } from '@/lib/ai-prompt';

/**
 * AI 생성 안내 박스(ADR 0012). 이 시스템은 AI를 호출하지 않는다.
 * 운영자가 이 프롬프트를 외부 AI에 붙여넣어 만든 HTML을 아래 폼으로 등록하도록 안내한다.
 *
 * 떠 있는 Popover(ADR 0021 2026-09-10 추가 개정): 이전의 접이식 아코디언(Collapsible)은
 * 펼쳐지면 아래 등록 폼을 밀어내렸다. Popover는 Portal로 body에 렌더되고 트리거 기준
 * absolute로 위치하므로, 열려도 모달 안 폼 레이아웃(붙여넣기 textarea 크기 포함)이
 * 전혀 바뀌지 않는다 — 트리거는 열려 있든 닫혀 있든 항상 한 줄만 차지한다.
 * 트리거는 테두리·배경·호버·포커스 링을 가진 버튼형이다(평문+아이콘처럼 안 보이는 문제 방지).
 */
export function AiPromptBox() {
  const [open, setOpen] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(AI_PROMPT_TEMPLATE);
      toast.success('프롬프트를 복사했습니다');
    } catch {
      toast.error('프롬프트를 복사하지 못했습니다');
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="mt-4 flex w-full shrink-0 items-center justify-between gap-2 rounded-md border bg-muted/50 px-4 py-3 text-left text-sm font-medium transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
        <span className="flex items-center gap-2">
          <SparklesIcon className="size-4 shrink-0 text-muted-foreground" />
          AI로 HTML 만들기 (프롬프트 열기)
        </span>
        <ChevronDownIcon
          className={`size-4 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        collisionPadding={16}
        className="box-border w-[36rem] max-w-[calc(100vw-2rem)] max-h-[60vh] overflow-auto p-4"
      >
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <CardTitle>AI로 만들기</CardTitle>
            <CardDescription>
              아래 프롬프트를 ChatGPT·Claude 등에 붙여넣어 HTML 파일을 만든 뒤 여기에 등록하세요
            </CardDescription>
          </div>
          <ul className="list-disc pl-5 text-sm text-muted-foreground">
            <li>.html 파일 하나</li>
            <li>&lt;form&gt;과 모든 입력의 name 속성 필수</li>
            <li>외부 스크립트 없이 완전한 파일 하나</li>
          </ul>
          <pre className="box-border max-h-64 w-full overflow-auto rounded-lg bg-muted p-3 text-xs whitespace-pre-wrap">
            {AI_PROMPT_TEMPLATE}
          </pre>
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={handleCopy}>
              프롬프트 복사
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
