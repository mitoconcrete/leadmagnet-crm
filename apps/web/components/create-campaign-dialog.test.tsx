import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CreateCampaignDialog } from './create-campaign-dialog';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';

vi.mock('@/lib/api', () => ({
  apiFetch: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

describe('CreateCampaignDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('이름·설명을 입력해 제출하면 캠페인 생성 API를 호출하고 onCreated를 호출한다', async () => {
    vi.mocked(apiFetch).mockResolvedValue({ id: '1', name: '가을 캠페인' });
    const onCreated = vi.fn();

    render(<CreateCampaignDialog onCreated={onCreated} />);

    fireEvent.click(screen.getByRole('button', { name: '캠페인 만들기' }));

    fireEvent.change(screen.getByLabelText('이름'), { target: { value: '가을 캠페인' } });
    fireEvent.change(screen.getByLabelText('설명'), { target: { value: '가을 프로모션' } });
    fireEvent.click(screen.getByRole('button', { name: '만들기' }));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith('/api/admin/campaigns', {
        method: 'POST',
        json: { name: '가을 캠페인', description: '가을 프로모션' },
      });
    });
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(toast.success).toHaveBeenCalled();
  });

  it('생성에 실패하면 오류 토스트를 띄우고 onCreated를 호출하지 않는다', async () => {
    vi.mocked(apiFetch).mockRejectedValue(new Error('실패'));
    const onCreated = vi.fn();

    render(<CreateCampaignDialog onCreated={onCreated} />);

    fireEvent.click(screen.getByRole('button', { name: '캠페인 만들기' }));
    fireEvent.change(screen.getByLabelText('이름'), { target: { value: '캠페인' } });
    fireEvent.click(screen.getByRole('button', { name: '만들기' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(onCreated).not.toHaveBeenCalled();
  });
});
