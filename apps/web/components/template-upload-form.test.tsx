import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TemplateUploadForm } from './template-upload-form';
import { apiFetch, ApiError } from '@/lib/api';
import { toast } from 'sonner';

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return { ...actual, apiFetch: vi.fn() };
});

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

function makeHtmlFile() {
  return new File(['<form></form>'], 'lead.html', { type: 'text/html' });
}

describe('TemplateUploadForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('파일과 이름을 선택해 제출하면 FormData로 템플릿 등록 API를 호출한다', async () => {
    vi.mocked(apiFetch).mockResolvedValue({ id: 't1', name: '이름' });
    const onUploaded = vi.fn();

    render(<TemplateUploadForm onUploaded={onUploaded} />);

    fireEvent.change(screen.getByLabelText('이름'), { target: { value: '가을 랜딩' } });
    fireEvent.change(screen.getByLabelText('HTML 파일'), { target: { files: [makeHtmlFile()] } });
    fireEvent.click(screen.getByRole('button', { name: '템플릿 등록' }));

    await waitFor(() => expect(apiFetch).toHaveBeenCalled());
    const [path, init] = vi.mocked(apiFetch).mock.calls[0];
    expect(path).toBe('/api/admin/templates');
    expect(init?.method).toBe('POST');
    const body = init?.body as FormData;
    expect(body.get('name')).toBe('가을 랜딩');
    expect((body.get('file') as File).name).toBe('lead.html');

    await waitFor(() => expect(onUploaded).toHaveBeenCalled());
    expect(toast.success).toHaveBeenCalled();
  });

  it('파일을 선택하지 않으면 오류 토스트를 띄우고 API를 호출하지 않는다', () => {
    render(<TemplateUploadForm onUploaded={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: '템플릿 등록' }));

    expect(toast.error).toHaveBeenCalledWith('HTML 파일을 선택하세요');
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('등록에 실패하면 서버 메시지를 토스트로 보여준다', async () => {
    vi.mocked(apiFetch).mockRejectedValue(new ApiError(400, '<form>이 없는 HTML입니다'));

    render(<TemplateUploadForm onUploaded={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('HTML 파일'), { target: { files: [makeHtmlFile()] } });
    fireEvent.click(screen.getByRole('button', { name: '템플릿 등록' }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('<form>이 없는 HTML입니다');
    });
  });
});
