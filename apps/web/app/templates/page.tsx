'use client';

import { useState } from 'react';
import { AiPromptBox } from '@/components/ai-prompt-box';
import { AppShell } from '@/components/app-shell';
import { AuthGate } from '@/components/auth-gate';
import { TemplateTable } from '@/components/template-table';
import { TemplateUploadForm } from '@/components/template-upload-form';

export default function TemplatesPage() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <AuthGate>
      <AppShell>
        {/* 데스크톱 우선(ADR 0021): 좌 안내+등록, 우 목록 2열. 좌 열도 내용이 길면 자체 스크롤한다. */}
        <div className="grid h-full min-h-0 grid-rows-[auto_1fr] gap-4 p-4">
          <h1 className="text-xl font-semibold">HTML 템플릿</h1>

          <div data-testid="templates-columns" className="grid min-h-0 grid-cols-1 gap-4 lg:grid-cols-[1fr_2fr]">
            <div data-testid="templates-left-column" className="flex min-h-0 flex-col gap-4">
              <div data-testid="templates-ai-box" className="shrink-0">
                <AiPromptBox />
              </div>
              <div data-testid="templates-upload-section" className="flex h-full min-h-0 flex-1 flex-col">
                <TemplateUploadForm onUploaded={() => setRefreshKey((key) => key + 1)} />
              </div>
            </div>

            <section className="flex min-h-0 flex-col gap-3">
              <h2 className="text-lg font-semibold">템플릿 목록</h2>
              <TemplateTable refreshKey={refreshKey} />
            </section>
          </div>
        </div>
      </AppShell>
    </AuthGate>
  );
}
