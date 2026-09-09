import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { FormList } from './form-list';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import type { Form } from '@/lib/types';

vi.mock('@/lib/api', () => ({
  apiFetch: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('./link-panel', () => ({
  LinkPanel: ({ formId }: { formId: string }) => <div data-testid={`link-panel-${formId}`} />,
}));

const writeText = vi.fn().mockResolvedValue(undefined);

const form: Form = {
  id: 'f1',
  campaignId: 'c1',
  templateId: 't1',
  name: '기본 신청폼',
  slug: 'lead-abcd',
  successMessage: '신청이 완료되었습니다.',
  isActive: true,
  publicUrl: 'http://localhost:3001/p/lead-abcd',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('FormList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  });

  it('폼 목록을 조회해 이름·slug·공개 URL·LinkPanel을 보여준다', async () => {
    vi.mocked(apiFetch).mockResolvedValue([form]);

    render(<FormList campaignId="c1" />);

    expect(apiFetch).toHaveBeenCalledWith('/api/admin/forms?campaignId=c1');
    await waitFor(() => expect(screen.getByText('기본 신청폼')).toBeInTheDocument());
    expect(screen.getByText('lead-abcd')).toBeInTheDocument();
    expect(screen.getByText(form.publicUrl)).toBeInTheDocument();
    expect(screen.getByTestId('link-panel-f1')).toBeInTheDocument();
  });

  it('활성 토글을 누르면 PATCH isActive를 호출한다', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce([form]);
    vi.mocked(apiFetch).mockResolvedValueOnce({ ...form, isActive: false });

    render(<FormList campaignId="c1" />);

    await waitFor(() => expect(screen.getByText('기본 신청폼')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('switch'));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith('/api/admin/forms/f1', {
        method: 'PATCH',
        json: { isActive: false },
      });
    });
  });

  it('복사 버튼을 누르면 공개 URL을 클립보드에 기록한다', async () => {
    vi.mocked(apiFetch).mockResolvedValue([form]);

    render(<FormList campaignId="c1" />);

    await waitFor(() => expect(screen.getByText('기본 신청폼')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: '복사' }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(form.publicUrl));
    expect(toast.success).toHaveBeenCalled();
  });
});
