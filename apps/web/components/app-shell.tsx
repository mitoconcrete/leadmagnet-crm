'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';

/**
 * 상단 내비게이션(대시보드/템플릿)과 로그아웃 버튼을 가진 관리자 화면 레이아웃.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();

  async function handleLogout() {
    await apiFetch('/api/admin/auth/logout', { method: 'POST' });
    router.replace('/login');
  }

  return (
    <div className="grid h-screen grid-rows-[auto_1fr]">
      <header className="flex items-center justify-between border-b bg-white px-6 py-3">
        <nav className="flex items-center gap-4 text-sm font-medium text-zinc-700">
          <Link href="/" className="hover:text-zinc-950">
            대시보드
          </Link>
          <Link href="/templates" className="hover:text-zinc-950">
            템플릿
          </Link>
        </nav>
        <Button variant="outline" size="sm" onClick={handleLogout}>
          로그아웃
        </Button>
      </header>
      {/* 데스크톱(lg 이상)에서는 바깥 문서를 스크롤하지 않는다(ADR 0021). 좁은 화면만 main이 스크롤된다. */}
      <main className="min-h-0 overflow-y-auto lg:overflow-hidden">{children}</main>
    </div>
  );
}
