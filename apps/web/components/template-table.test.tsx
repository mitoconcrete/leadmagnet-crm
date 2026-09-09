import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TemplateTable } from './template-table';
import { apiFetch, ApiError } from '@/lib/api';
import { toast } from 'sonner';
import type { Template } from '@/lib/types';

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return { ...actual, apiFetch: vi.fn() };
});

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

const templates: Template[] = [
  {
    id: 't1',
    name: '가을 랜딩',
    originalFilename: 'lead.html',
    sizeBytes: 2048,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
];

describe('TemplateTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('템플릿 목록 API를 조회해 이름·파일명·크기(KB)·등록일을 표시한다', async () => {
    vi.mocked(apiFetch).mockResolvedValue(templates);

    render(<TemplateTable />);

    expect(apiFetch).toHaveBeenCalledWith('/api/admin/templates');

    await waitFor(() => expect(screen.getByText('가을 랜딩')).toBeInTheDocument());
    expect(screen.getByText('lead.html')).toBeInTheDocument();
    expect(screen.getByText('2.0KB')).toBeInTheDocument();
    expect(screen.getByText('2026-01-01 09:00')).toBeInTheDocument();
  });

  it('템플릿이 없으면 안내 문구를 보여준다', async () => {
    vi.mocked(apiFetch).mockResolvedValue([]);

    render(<TemplateTable />);

    await waitFor(() => expect(screen.getByText('등록된 템플릿이 없습니다.')).toBeInTheDocument());
  });

  it('조회에 실패하면 오류 토스트를 띄우고 빈 상태를 보여준다', async () => {
    vi.mocked(apiFetch).mockRejectedValue(new ApiError(500, '템플릿 목록을 불러오지 못했습니다'));

    render(<TemplateTable />);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('템플릿 목록을 불러오지 못했습니다');
    });
    expect(screen.getByText('등록된 템플릿이 없습니다.')).toBeInTheDocument();
  });

  it('미리보기 버튼을 클릭하면 Dialog가 열리고 iframe이 올바른 src와 sandbox 속성을 갖는다', async () => {
    vi.mocked(apiFetch).mockResolvedValue(templates);

    render(<TemplateTable />);

    await waitFor(() => expect(screen.getByText('가을 랜딩')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: '미리보기' }));

    const iframe = await screen.findByTitle('템플릿 미리보기');
    expect(iframe).toHaveAttribute('src', '/api/admin/templates/t1/preview');
    expect(iframe).toHaveAttribute('sandbox', 'allow-scripts allow-forms');
    expect(screen.getByRole('heading', { name: '가을 랜딩' })).toBeInTheDocument();
  });

  it('언마운트 후 응답이 와도 상태를 갱신하지 않는다', async () => {
    let resolveFn: (value: Template[]) => void = () => {};
    vi.mocked(apiFetch).mockReturnValue(
      new Promise((resolve) => {
        resolveFn = resolve;
      }),
    );

    const { unmount } = render(<TemplateTable />);
    unmount();
    resolveFn(templates);

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(toast.error).not.toHaveBeenCalled();
  });
});
