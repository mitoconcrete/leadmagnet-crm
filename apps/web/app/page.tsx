'use client';

import { AppShell } from '@/components/app-shell';
import { AuthGate } from '@/components/auth-gate';

export default function DashboardPage() {
  return (
    <AuthGate>
      <AppShell>
        <h1 className="text-xl font-semibold">대시보드</h1>
      </AppShell>
    </AuthGate>
  );
}
