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
        <div className="flex flex-col gap-6">
          <h1 className="text-xl font-semibold">HTML 템플릿</h1>
          <AiPromptBox />
          <TemplateUploadForm onUploaded={() => setRefreshKey((key) => key + 1)} />
          <TemplateTable refreshKey={refreshKey} />
        </div>
      </AppShell>
    </AuthGate>
  );
}
