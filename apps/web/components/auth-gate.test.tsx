import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AuthGate } from './auth-gate';
import { apiFetch } from '@/lib/api';

vi.mock('@/lib/api', () => ({
  apiFetch: vi.fn(),
}));

describe('AuthGate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('/api/admin/auth/me 조회에 성공하면 children을 렌더한다', async () => {
    vi.mocked(apiFetch).mockResolvedValue({ id: '1', email: 'a@b.com' });

    render(
      <AuthGate>
        <div>보호된 콘텐츠</div>
      </AuthGate>,
    );

    expect(apiFetch).toHaveBeenCalledWith('/api/admin/auth/me');
    await waitFor(() => expect(screen.getByText('보호된 콘텐츠')).toBeInTheDocument());
  });

  it('조회가 끝나기 전에는 children을 렌더하지 않는다', async () => {
    let resolveFn: (value: { id: string; email: string }) => void = () => {};
    vi.mocked(apiFetch).mockReturnValue(
      new Promise((resolve) => {
        resolveFn = resolve;
      }),
    );

    render(
      <AuthGate>
        <div>보호된 콘텐츠</div>
      </AuthGate>,
    );

    expect(screen.queryByText('보호된 콘텐츠')).not.toBeInTheDocument();
    resolveFn({ id: '1', email: 'a@b.com' });
    await waitFor(() => expect(screen.getByText('보호된 콘텐츠')).toBeInTheDocument());
  });

  it('조회에 실패하면 children을 렌더하지 않는다', async () => {
    vi.mocked(apiFetch).mockRejectedValue(new Error('Unauthorized'));

    render(
      <AuthGate>
        <div>보호된 콘텐츠</div>
      </AuthGate>,
    );

    await waitFor(() => expect(apiFetch).toHaveBeenCalled());
    expect(screen.queryByText('보호된 콘텐츠')).not.toBeInTheDocument();
  });
});
