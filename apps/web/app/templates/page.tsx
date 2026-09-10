'use client';

import { useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { AuthGate } from '@/components/auth-gate';
import { TemplateRegisterDialog } from '@/components/template-register-dialog';
import { TemplateTable } from '@/components/template-table';

export default function TemplatesPage() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <AuthGate>
      <AppShell>
        {/* 데스크톱 우선(ADR 0021 2026-09-10 개정): 등록은 넓은 모달로 분리하고, 목록은 전폭으로 쓴다. */}
        <div className="flex h-full min-h-0 flex-col gap-4 p-4">
          <div className="flex shrink-0 items-center justify-between">
            <h1 className="text-xl font-semibold">HTML 템플릿</h1>
            <TemplateRegisterDialog onRegistered={() => setRefreshKey((key) => key + 1)} />
          </div>

          <section className="flex min-h-0 flex-1 flex-col gap-3">
            <h2 className="text-lg font-semibold">템플릿 목록</h2>
            <TemplateTable refreshKey={refreshKey} />
          </section>
        </div>
      </AppShell>
    </AuthGate>
  );
}
