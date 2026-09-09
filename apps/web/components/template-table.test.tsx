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

const writeText = vi.fn().mockResolvedValue(undefined);

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
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
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

  it('코드 버튼을 클릭하면 상세 조회 결과의 html을 <pre> 텍스트로 보여준다(렌더 금지)', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(templates); // GET list
    vi.mocked(apiFetch).mockResolvedValueOnce({ ...templates[0], html: '<form><input name="email"></form>' }); // GET detail

    render(<TemplateTable />);
    await waitFor(() => expect(screen.getByText('가을 랜딩')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: '코드' }));

    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith('/api/admin/templates/t1'));
    const pre = await screen.findByText('<form><input name="email"></form>', { selector: 'pre' });
    expect(pre.tagName).toBe('PRE');
    expect(document.querySelector('form')).not.toBeInTheDocument();
  });

  it('코드 Dialog의 복사 버튼을 클릭하면 클립보드에 html을 기록하고 토스트를 띄운다', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(templates);
    vi.mocked(apiFetch).mockResolvedValueOnce({ ...templates[0], html: '<form></form>' });

    render(<TemplateTable />);
    await waitFor(() => expect(screen.getByText('가을 랜딩')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: '코드' }));
    await screen.findByText('<form></form>', { selector: 'pre' });

    fireEvent.click(screen.getByRole('button', { name: '복사' }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith('<form></form>'));
    expect(toast.success).toHaveBeenCalled();
  });

  it('삭제 버튼을 클릭해 204를 받으면 재조회하고 성공 토스트를 띄운다', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(templates); // GET list
    vi.mocked(apiFetch).mockResolvedValueOnce(undefined); // DELETE 204
    vi.mocked(apiFetch).mockResolvedValueOnce([]); // GET list(재조회)

    render(<TemplateTable />);
    await waitFor(() => expect(screen.getByText('가을 랜딩')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: '삭제' }));

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith('/api/admin/templates/t1', expect.objectContaining({ method: 'DELETE' })),
    );
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText('등록된 템플릿이 없습니다.')).toBeInTheDocument());
  });

  it('삭제가 409면 폼·방문·신청 수를 담은 확인 대화상자를 띄우고, 확인하면 force=true로 재요청한다', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(templates); // GET list
    vi.mocked(apiFetch).mockRejectedValueOnce(
      new ApiError(409, '사용 중인 템플릿입니다(폼 2개, 방문 5건, 신청 3건)', {
        forms: 2,
        visits: 5,
        submissions: 3,
      }),
    ); // DELETE(force 아님)
    vi.mocked(apiFetch).mockResolvedValueOnce(undefined); // DELETE(force=true)
    vi.mocked(apiFetch).mockResolvedValueOnce([]); // GET list(재조회)

    render(<TemplateTable />);
    await waitFor(() => expect(screen.getByText('가을 랜딩')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: '삭제' }));

    await screen.findByText(/폼 2개, 방문 5건, 신청 3건/);

    fireEvent.click(screen.getByRole('button', { name: '정말 삭제' }));

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        '/api/admin/templates/t1?force=true',
        expect.objectContaining({ method: 'DELETE' }),
      ),
    );
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
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
