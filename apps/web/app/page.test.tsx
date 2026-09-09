import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import DashboardPage from './page';

vi.mock('@/components/auth-gate', () => ({
  AuthGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/app-shell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div data-testid="app-shell">{children}</div>,
}));

vi.mock('@/lib/api', () => ({
  apiFetch: vi.fn().mockResolvedValue([]),
}));

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('AuthGate와 AppShell로 감싸 대시보드 제목을 보여준다', () => {
    render(<DashboardPage />);

    expect(screen.getByTestId('app-shell')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '대시보드' })).toBeInTheDocument();
  });
});
