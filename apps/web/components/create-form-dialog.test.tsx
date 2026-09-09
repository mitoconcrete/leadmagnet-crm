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

  it('템플릿을 선택하지 않고 제출하면 오류 토스트를 띄우고 API를 호출하지 않는다', async () => {
    vi.mocked(apiFetch).mockResolvedValue(templates);

    render(<CreateFormDialog campaignId="c1" onCreated={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '폼 만들기' }));
    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith('/api/admin/templates'));

    fireEvent.change(screen.getByLabelText('이름'), { target: { value: '이름만 입력' } });
    fireEvent.click(screen.getByRole('button', { name: '만들기' }));

    expect(toast.error).toHaveBeenCalledWith('템플릿을 선택하세요');
    expect(apiFetch).not.toHaveBeenCalledWith('/api/admin/forms', expect.anything());
  });

  it('템플릿 목록 조회에 실패해도 다이얼로그가 동작한다', async () => {
    vi.mocked(apiFetch).mockRejectedValue(new Error('네트워크 오류'));

    render(<CreateFormDialog campaignId="c1" onCreated={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '폼 만들기' }));

    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith('/api/admin/templates'));
    expect(screen.queryAllByRole('option')).toHaveLength(0);
  });

  it('폼 생성 API가 실패하면 오류 토스트를 띄운다', async () => {
    vi.mocked(apiFetch).mockImplementation((path: string, init?: { method?: string }) => {
      if (path === '/api/admin/templates') return Promise.resolve(templates);
      if (path === '/api/admin/forms' && init?.method === 'POST') {
        return Promise.reject(new Error('실패'));
      }
      return Promise.reject(new Error('unexpected call'));
    });

    render(<CreateFormDialog campaignId="c1" onCreated={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '폼 만들기' }));

    await waitFor(() => expect(screen.getByRole('combobox')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('combobox'));
    await waitFor(() => expect(screen.getByRole('option', { name: '가을 랜딩' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('option', { name: '가을 랜딩' }));

    fireEvent.change(screen.getByLabelText('이름'), { target: { value: '기본 신청폼' } });
    fireEvent.click(screen.getByRole('button', { name: '만들기' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('폼을 만들지 못했습니다'));
  });
});
