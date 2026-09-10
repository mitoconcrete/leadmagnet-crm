'use client';

import { useState } from 'react';
import { ChevronDownIcon, SparklesIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { AI_PROMPT_TEMPLATE } from '@/lib/ai-prompt';

/**
 * AI 생성 안내 박스(ADR 0012). 이 시스템은 AI를 호출하지 않는다.
 * 운영자가 이 프롬프트를 외부 AI에 붙여넣어 만든 HTML을 아래 폼으로 등록하도록 안내한다.
 *
 * 기본 접힘(ADR 0021 2026-09-10 개정): 등록 모달에서 HTML 입력 공간을 넓게 쓰도록
 * 트리거 한 줄만 기본으로 보이고, 클릭하면 기존 설명·조건 요약·프롬프트·복사 버튼이 펼쳐진다.
 * 트리거는 테두리·배경·호버·포커스 링을 가진 버튼형으로 만들어(2026-09-10 추가 수정)
 * 평문+아이콘처럼 클릭 요소로 안 보이는 문제를 없앤다.
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
    <Card className="mt-2 gap-0 py-0">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="flex w-full shrink-0 items-center justify-between gap-2 rounded-md border bg-muted/50 px-4 py-3 text-left text-sm font-medium transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
          <span className="flex items-center gap-2">
            <SparklesIcon className="size-4 shrink-0 text-muted-foreground" />
            AI로 HTML 만들기 (프롬프트 열기)
          </span>
          <ChevronDownIcon
            className={`size-4 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="rounded-b-md border border-t-0">
          <CardHeader>
            <CardTitle>AI로 만들기</CardTitle>
            <CardDescription>
              아래 프롬프트를 ChatGPT·Claude 등에 붙여넣어 HTML 파일을 만든 뒤 여기에 등록하세요
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 pb-4">
            <ul className="list-disc pl-5 text-sm text-muted-foreground">
              <li>.html 파일 하나</li>
              <li>&lt;form&gt;과 모든 입력의 name 속성 필수</li>
              <li>외부 스크립트 없이 완전한 파일 하나</li>
            </ul>
            <pre className="max-h-64 overflow-auto rounded-lg bg-muted p-3 text-xs whitespace-pre-wrap">
              {AI_PROMPT_TEMPLATE}
            </pre>
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={handleCopy}>
                프롬프트 복사
              </Button>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
