import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AppShell } from './app-shell';
import { apiFetch } from '@/lib/api';

const replaceMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock, push: vi.fn() }),
}));

vi.mock('@/lib/api', () => ({
  apiFetch: vi.fn(),
}));

describe('AppShell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('대시보드·템플릿 내비게이션 링크를 보여준다', () => {
    render(
      <AppShell>
        <div>본문</div>
      </AppShell>,
    );

    expect(screen.getByRole('link', { name: '대시보드' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: '템플릿' })).toHaveAttribute('href', '/templates');
    expect(screen.getByText('본문')).toBeInTheDocument();
  });

  it('데스크톱 우선 레이아웃(ADR 0021): 셸은 h-screen 그리드이고 main은 데스크톱에서 overflow-hidden이다', () => {
    const { container } = render(
      <AppShell>
        <div>본문</div>
      </AppShell>,
    );

    const shell = container.firstElementChild as HTMLElement;
    expect(shell.className).toContain('h-screen');
    expect(shell.className).toContain('grid-rows-[auto_1fr]');

    const main = screen.getByText('본문').closest('main');
    expect(main).not.toBeNull();
    expect(main?.className).toContain('min-h-0');
    expect(main?.className).toContain('lg:overflow-hidden');
  });

  it('로그아웃 버튼을 누르면 로그아웃 API를 호출하고 /login으로 이동한다', async () => {
    vi.mocked(apiFetch).mockResolvedValue(undefined);

    render(
      <AppShell>
        <div>본문</div>
      </AppShell>,
    );

    fireEvent.click(screen.getByRole('button', { name: '로그아웃' }));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith('/api/admin/auth/logout', { method: 'POST' });
    });
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/login'));
  });
});
