import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CreateFormDialog } from './create-form-dialog';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import type { Template } from '@/lib/types';

vi.mock('@/lib/api', () => ({
  apiFetch: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const templates: Template[] = [
  { id: 't1', name: '가을 랜딩', originalFilename: 'lead.html', sizeBytes: 100, createdAt: '2026-01-01T00:00:00.000Z' },
];

describe('CreateFormDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('다이얼로그를 열면 템플릿 목록을 조회한다', async () => {
    vi.mocked(apiFetch).mockResolvedValue(templates);

    render(<CreateFormDialog campaignId="c1" onCreated={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '폼 만들기' }));

    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith('/api/admin/templates'));
  });

  it('템플릿·이름·성공 메시지를 입력해 제출하면 폼 생성 API를 호출한다', async () => {
    vi.mocked(apiFetch).mockImplementation((path: string, init?: { method?: string }) => {
      if (path === '/api/admin/templates') return Promise.resolve(templates);
      if (path === '/api/admin/forms' && init?.method === 'POST') {
        return Promise.resolve({ id: 'f1', name: '기본 신청폼' });
      }
      return Promise.reject(new Error('unexpected call'));
    });
    const onCreated = vi.fn();

    render(<CreateFormDialog campaignId="c1" onCreated={onCreated} />);
    fireEvent.click(screen.getByRole('button', { name: '폼 만들기' }));

    await waitFor(() => expect(screen.getByRole('combobox')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('combobox'));
    await waitFor(() => expect(screen.getByRole('option', { name: '가을 랜딩' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('option', { name: '가을 랜딩' }));

    fireEvent.change(screen.getByLabelText('이름'), { target: { value: '기본 신청폼' } });
    fireEvent.change(screen.getByLabelText('성공 메시지'), { target: { value: '감사합니다' } });
    fireEvent.click(screen.getByRole('button', { name: '만들기' }));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith('/api/admin/forms', {
        method: 'POST',
        json: { campaignId: 'c1', templateId: 't1', name: '기본 신청폼', successMessage: '감사합니다' },
      });
    });
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(toast.success).toHaveBeenCalled();
  });
});
