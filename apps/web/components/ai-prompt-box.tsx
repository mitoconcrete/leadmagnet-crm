'use client';

import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AI_PROMPT_TEMPLATE } from '@/lib/ai-prompt';

/**
 * AI 생성 안내 박스(ADR 0012). 이 시스템은 AI를 호출하지 않는다.
 * 운영자가 이 프롬프트를 외부 AI에 붙여넣어 만든 HTML을 아래 폼으로 등록하도록 안내한다.
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
    <Card>
      <CardHeader>
        <CardTitle>AI로 만들기</CardTitle>
        <CardDescription>
          아래 프롬프트를 ChatGPT·Claude 등에 붙여넣어 HTML 파일을 만든 뒤 여기에 등록하세요
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <ul className="list-disc pl-5 text-sm text-muted-foreground">
          <li>.html 파일 하나</li>
          <li>&lt;form&gt;과 모든 입력의 name 속성 필수</li>
          <li>외부 스크립트 없이 완전한 파일 하나</li>
        </ul>
        <pre className="max-h-64 overflow-auto rounded-lg bg-muted p-3 text-xs whitespace-pre-wrap">
          {AI_PROMPT_TEMPLATE}
        </pre>
        <Button variant="outline" size="sm" className="self-start" onClick={handleCopy}>
          프롬프트 복사
        </Button>
      </CardContent>
    </Card>
  );
}
