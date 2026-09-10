'use client';

import { SparklesIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { CardDescription, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { AI_PROMPT_TEMPLATE } from '@/lib/ai-prompt';

/**
 * AI 생성 안내 팁 버튼(ADR 0012). 이 시스템은 AI를 호출하지 않는다.
 * 운영자가 이 프롬프트를 외부 AI에 붙여넣어 만든 HTML을 등록 폼으로 등록하도록 안내한다.
 *
 * 작은 팁 버튼 + 떠 있는 Popover(ADR 0021 2026-09-10 추가 개정): 전폭 트리거는
 * 탭 토글과 폭이 안 맞아 어색했다. 이제 탭 토글과 같은 줄 우측에 놓이는 작은
 * outline 버튼("AI 프롬프트")이며, 클릭하면 Popover가 트리거 기준으로 떠서
 * 문서 흐름(등록 폼 레이아웃, 붙여넣기 textarea 크기 포함)을 전혀 바꾸지 않는다.
 */
export function AiPromptBox() {
  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(AI_PROMPT_TEMPLATE);
      toast.success('프롬프트를 복사했습니다');
    } catch {
      toast.error('프롬프트를 복사하지 못했습니다');
    }
  }

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button type="button" variant="outline" size="sm">
            <SparklesIcon className="size-4" />
            AI 프롬프트
          </Button>
        }
      />
      <PopoverContent
        align="end"
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
