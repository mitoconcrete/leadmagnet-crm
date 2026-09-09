import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import LoginPage from './page';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';

const replaceMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock, push: vi.fn() }),
}));

vi.mock('@/lib/api', () => ({
  apiFetch: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('이메일·비밀번호를 입력해 제출하면 /api/admin/auth/login을 호출하고 성공 시 /로 이동한다', async () => {
    vi.mocked(apiFetch).mockResolvedValue({ operator: { id: '1', email: 'a@b.com' } });

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText('이메일'), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByLabelText('비밀번호'), { target: { value: 'secret1234' } });
    fireEvent.click(screen.getByRole('button', { name: '로그인' }));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith('/api/admin/auth/login', {
        method: 'POST',
        json: { email: 'a@b.com', password: 'secret1234' },
      });
    });
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/'));
  });

  it('로그인 실패 시 오류 토스트를 띄우고 이동하지 않는다', async () => {
    vi.mocked(apiFetch).mockRejectedValue(new Error('Unauthorized'));

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText('이메일'), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByLabelText('비밀번호'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: '로그인' }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('이메일 또는 비밀번호가 올바르지 않습니다');
    });
    expect(replaceMock).not.toHaveBeenCalled();
  });
});
