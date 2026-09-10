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
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

function makeHtmlFile() {
  return new File(['<form></form>'], 'lead.html', { type: 'text/html' });
}

/** toast description은 string 또는 JSX(whitespace-pre-line div)로 온다 — 개행 보존 여부를 문자열로 비교하기 위한 헬퍼. */
function descriptionText(description: unknown): string | undefined {
  if (typeof description === 'string') return description;
  if (description && typeof description === 'object' && 'props' in description) {
    return (description as { props: { children: string } }).props.children;
  }
  return undefined;
}

describe('TemplateUploadForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('파일 선택 버튼을 클릭하면 숨겨진 파일 입력을 클릭하고, 선택하면 파일명을 보여준다', () => {
    render(<TemplateUploadForm onUploaded={vi.fn()} />);

    const input = screen.getByLabelText('HTML 파일') as HTMLInputElement;
    expect(input.className).toContain('sr-only');
    const clickSpy = vi.spyOn(input, 'click');

    expect(screen.getByText('선택된 파일 없음')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '파일 선택' }));
    expect(clickSpy).toHaveBeenCalled();

    fireEvent.change(input, { target: { files: [makeHtmlFile()] } });
    expect(screen.getByText('lead.html')).toBeInTheDocument();
    expect(screen.queryByText('선택된 파일 없음')).not.toBeInTheDocument();
  });

  it('.html이 아닌 파일을 선택하면 오류 토스트를 띄우고 선택을 해제한다', () => {
    render(<TemplateUploadForm onUploaded={vi.fn()} />);

    const input = screen.getByLabelText('HTML 파일') as HTMLInputElement;
    const txtFile = new File(['hello'], 'notes.txt', { type: 'text/plain' });

    fireEvent.change(input, { target: { files: [txtFile] } });

    expect(toast.error).toHaveBeenCalledWith('HTML 파일만 선택할 수 있습니다');
    expect(screen.getByText('선택된 파일 없음')).toBeInTheDocument();
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
    await waitFor(() => expect(screen.getByText('선택된 파일 없음')).toBeInTheDocument());
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

  it('HTML 붙여넣기 탭에서 이름·HTML을 입력해 제출하면 FormData에 html·name만 담고 file은 없다', async () => {
    vi.mocked(apiFetch).mockResolvedValue({ id: 't1', name: '붙여넣기' });
    const onUploaded = vi.fn();

    render(<TemplateUploadForm onUploaded={onUploaded} />);

    fireEvent.click(screen.getByRole('tab', { name: 'HTML 붙여넣기' }));
    fireEvent.change(screen.getByLabelText('이름'), { target: { value: '붙여넣기 템플릿' } });
    fireEvent.change(screen.getByPlaceholderText('AI가 생성한 HTML 전체를 붙여넣으세요'), {
      target: { value: '<form><input name="email"></form>' },
    });
    fireEvent.click(screen.getByRole('button', { name: '템플릿 등록' }));

    await waitFor(() => expect(apiFetch).toHaveBeenCalled());
    const [path, init] = vi.mocked(apiFetch).mock.calls[0];
    expect(path).toBe('/api/admin/templates');
    expect(init?.method).toBe('POST');
    const body = init?.body as FormData;
    expect(body.get('name')).toBe('붙여넣기 템플릿');
    expect(body.get('html')).toBe('<form><input name="email"></form>');
    expect(body.get('file')).toBeNull();

    await waitFor(() => expect(onUploaded).toHaveBeenCalled());
    expect(toast.success).toHaveBeenCalled();
  });

  it('붙여넣기 탭에서 이름 없이 제출하면 오류 토스트를 띄우고 API를 호출하지 않는다', () => {
    render(<TemplateUploadForm onUploaded={vi.fn()} />);

    fireEvent.click(screen.getByRole('tab', { name: 'HTML 붙여넣기' }));
    fireEvent.change(screen.getByPlaceholderText('AI가 생성한 HTML 전체를 붙여넣으세요'), {
      target: { value: '<form></form>' },
    });
    fireEvent.click(screen.getByRole('button', { name: '템플릿 등록' }));

    expect(toast.error).toHaveBeenCalledWith('이름을 입력하세요');
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('붙여넣기 탭에서 HTML 없이 제출하면 오류 토스트를 띄우고 API를 호출하지 않는다', () => {
    render(<TemplateUploadForm onUploaded={vi.fn()} />);

    fireEvent.click(screen.getByRole('tab', { name: 'HTML 붙여넣기' }));
    fireEvent.change(screen.getByLabelText('이름'), { target: { value: '이름만' } });
    fireEvent.click(screen.getByRole('button', { name: '템플릿 등록' }));

    expect(toast.error).toHaveBeenCalledWith('HTML을 붙여넣으세요');
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('등록 응답에 warnings가 있으면 스크롤과 무관한 toast.warning으로 건수·이유를 보여준다', async () => {
    vi.mocked(apiFetch).mockResolvedValue({
      id: 't1',
      name: '이름',
      warnings: ['name 없는 입력이 있습니다', '외부 스크립트가 있습니다'],
    });

    render(<TemplateUploadForm onUploaded={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('HTML 파일'), { target: { files: [makeHtmlFile()] } });
    fireEvent.click(screen.getByRole('button', { name: '템플릿 등록' }));

    await waitFor(() => expect(toast.warning).toHaveBeenCalled());
    const [title, options] = vi.mocked(toast.warning).mock.calls[0];
    expect(title).toBe('점검 경고 2건');
    expect(descriptionText(options?.description)).toBe('name 없는 입력이 있습니다\n외부 스크립트가 있습니다');
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('등록 응답에 warnings가 없으면(빈 배열) 성공 toast만 띄운다', async () => {
    vi.mocked(apiFetch).mockResolvedValue({ id: 't1', name: '이름', warnings: [] });

    render(<TemplateUploadForm onUploaded={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('HTML 파일'), { target: { files: [makeHtmlFile()] } });
    fireEvent.click(screen.getByRole('button', { name: '템플릿 등록' }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('템플릿을 등록했습니다'));
    expect(toast.warning).not.toHaveBeenCalled();
  });

  it('붙여넣기 textarea는 뷰포트 기준 높이(h-60vh)를 직접 가져 flex 사슬에 의존하지 않고 고정 높이로 잘리지 않는다(ADR 0021 2026-09-10 개정 — AI 안내 기본 접힘으로 공간 확보)', () => {
    render(<TemplateUploadForm onUploaded={vi.fn()} />);

    fireEvent.click(screen.getByRole('tab', { name: 'HTML 붙여넣기' }));
    const textarea = screen.getByPlaceholderText('AI가 생성한 HTML 전체를 붙여넣으세요');

    // flex-grow(flex-1)는 base-ui TabsContent에서 높이 사슬이 끊겨 실제로 늘어나지 않았다(실측
    // Playwright 케이스로 확인, e2e/layout.spec.ts). 뷰포트 기준 h-[60vh]로 직접 높이를 준다.
    // AI 안내(AiPromptBox)가 기본 접힘이 되면서 모달 안 남는 공간이 늘어 60vh로 키웠다.
    expect(textarea.className).toContain('h-[60vh]');
    expect(textarea.className).toContain('min-h-[16rem]');
    expect(textarea.className).not.toContain('h-64');
    expect(textarea.className).not.toContain('max-h-64');
    expect(textarea.className).toContain('resize-none');
    expect(textarea.className).toContain('font-mono');
  });

  it('폼 래퍼는 모달 폭을 다 쓴다(고정 max-w-2xl 제거, ADR 0021 2026-09-10 개정)', () => {
    render(<TemplateUploadForm onUploaded={vi.fn()} />);

    const tabList = screen.getByRole('tablist');
    const tabsRoot = tabList.closest('[data-slot="tabs"]');
    expect(tabsRoot?.className).not.toContain('max-w-2xl');
  });

  it('탭 토글은 상단 고정, 등록 버튼은 하단 고정 푸터, 입력 영역만 스크롤한다(ADR 0021 2026-09-10)', () => {
    render(<TemplateUploadForm onUploaded={vi.fn()} />);

    const scrollArea = screen.getByTestId('upload-scroll');
    expect(scrollArea.className).toContain('overflow-y-auto');
    expect(scrollArea.className).toContain('flex-1');
    expect(scrollArea.className).toContain('min-h-0');

    const tabList = screen.getByRole('tablist');
    expect(tabList.className).toContain('sticky');
    expect(tabList.className).toContain('top-0');
    expect(tabList.className).toContain('bg-inherit');
    expect(tabList.className).not.toContain('bg-background');
    expect(tabList.closest('[data-testid="upload-scroll"]')).toBeNull();

    const button = screen.getByRole('button', { name: '템플릿 등록' });
    const footer = button.closest('[data-testid="upload-footer"]');
    expect(footer).not.toBeNull();
    expect(footer?.className).toContain('shrink-0');
    expect(footer?.className).toContain('border-t');
    expect(footer?.className).toContain('bg-inherit');
    expect(footer?.className).not.toContain('bg-background');
    // 등록 버튼은 푸터 우측에 정렬된다(2026-09-10 추가 수정: 좌측 정렬이던 것을 교정).
    expect(footer?.className).toContain('flex');
    expect(footer?.className).toContain('justify-end');
    expect(button.closest('[data-testid="upload-scroll"]')).toBeNull();
  });

  it('붙여넣기 탭으로 전환해도 등록 버튼은 여전히 하단 고정 푸터에서 해당 탭의 폼과 연결된다', async () => {
    vi.mocked(apiFetch).mockResolvedValue({ id: 't1', name: '붙여넣기' });
    const onUploaded = vi.fn();

    render(<TemplateUploadForm onUploaded={onUploaded} />);
    fireEvent.click(screen.getByRole('tab', { name: 'HTML 붙여넣기' }));

    const button = screen.getByRole('button', { name: '템플릿 등록' });
    expect(button.closest('[data-testid="upload-footer"]')).not.toBeNull();

    fireEvent.change(screen.getByLabelText('이름'), { target: { value: '붙여넣기 템플릿' } });
    fireEvent.change(screen.getByPlaceholderText('AI가 생성한 HTML 전체를 붙여넣으세요'), {
      target: { value: '<form></form>' },
    });
    fireEvent.click(button);

    await waitFor(() => expect(apiFetch).toHaveBeenCalled());
    const [, init] = vi.mocked(apiFetch).mock.calls[0];
    const body = init?.body as FormData;
    expect(body.get('html')).toBe('<form></form>');
  });

  it('등록이 배열 메시지(ADR 0018 차단 규칙)로 거부되면 화면 고정 toast.error에 제목·이유 목록을 보여준다(스크롤 무관)', async () => {
    const reasons = ['관리자 API 참조(/api/admin)가 포함되어 있습니다', '쿠키 접근(document.cookie)이 포함되어 있습니다'];
    vi.mocked(apiFetch).mockRejectedValue(new ApiError(400, reasons.join(', '), undefined, reasons));

    render(<TemplateUploadForm onUploaded={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('HTML 파일'), { target: { files: [makeHtmlFile()] } });
    fireEvent.click(screen.getByRole('button', { name: '템플릿 등록' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    const [title, options] = vi.mocked(toast.error).mock.calls[0];
    expect(title).toBe('등록이 거부되었습니다');
    expect(descriptionText(options?.description)).toBe(reasons.join('\n'));
  });

  it('등록이 문자열 메시지로 실패하면(배열 메시지가 아니면) 기존처럼 메시지만 담아 toast.error를 띄운다', async () => {
    vi.mocked(apiFetch).mockRejectedValue(new ApiError(400, '<form>이 없는 HTML입니다'));

    render(<TemplateUploadForm onUploaded={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('HTML 파일'), { target: { files: [makeHtmlFile()] } });
    fireEvent.click(screen.getByRole('button', { name: '템플릿 등록' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('<form>이 없는 HTML입니다'));
  });
});
