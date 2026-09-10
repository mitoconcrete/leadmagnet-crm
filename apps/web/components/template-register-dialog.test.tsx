import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TemplateRegisterDialog } from './template-register-dialog';
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

describe('TemplateRegisterDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('"새 템플릿 등록" 버튼을 누르면 모달이 열리고 AI 프롬프트 팁 버튼(닫힘)·등록 폼(탭·등록 버튼)이 보인다', () => {
    render(<TemplateRegisterDialog onRegistered={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: '새 템플릿 등록' }));

    expect(screen.getByRole('heading', { name: '새 템플릿 등록' })).toBeInTheDocument();
    // AI 안내(AiPromptBox)는 닫힌 팁 버튼만 보이고, 펼친 내용(제목 "AI로 만들기")은 없다.
    expect(screen.getByRole('button', { name: /AI 프롬프트/ })).toBeInTheDocument();
    expect(screen.queryByText('AI로 만들기')).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '파일 업로드' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'HTML 붙여넣기' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '템플릿 등록' })).toBeInTheDocument();
  });

  it('등록에 성공(201)하면 모달이 닫히고 onRegistered가 호출된다', async () => {
    vi.mocked(apiFetch).mockResolvedValue({ id: 't1', name: '이름', warnings: [] });
    const onRegistered = vi.fn();

    render(<TemplateRegisterDialog onRegistered={onRegistered} />);
    fireEvent.click(screen.getByRole('button', { name: '새 템플릿 등록' }));

    fireEvent.change(screen.getByLabelText('HTML 파일'), { target: { files: [makeHtmlFile()] } });
    fireEvent.click(screen.getByRole('button', { name: '템플릿 등록' }));

    await waitFor(() => expect(onRegistered).toHaveBeenCalled());
    expect(toast.success).toHaveBeenCalledWith('템플릿을 등록했습니다');
    await waitFor(() => expect(screen.queryByRole('heading', { name: '새 템플릿 등록' })).not.toBeInTheDocument());
  });

  it('등록에 성공(201)하고 점검 경고가 있어도 모달이 닫히고 onRegistered가 호출되며 toast.warning으로 경고를 안내한다(회귀 방지: 경고 때문에 모달이 열려 있으면 안 된다)', async () => {
    vi.mocked(apiFetch).mockResolvedValue({
      id: 't1',
      name: '이름',
      warnings: ['개인정보 수집 동의 체크박스(name="consent")가 없습니다'],
    });
    const onRegistered = vi.fn();

    render(<TemplateRegisterDialog onRegistered={onRegistered} />);
    fireEvent.click(screen.getByRole('button', { name: '새 템플릿 등록' }));

    fireEvent.change(screen.getByLabelText('HTML 파일'), { target: { files: [makeHtmlFile()] } });
    fireEvent.click(screen.getByRole('button', { name: '템플릿 등록' }));

    await waitFor(() => expect(onRegistered).toHaveBeenCalled());
    expect(toast.warning).toHaveBeenCalledWith('점검 경고 1건', expect.anything());
    expect(toast.success).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole('heading', { name: '새 템플릿 등록' })).not.toBeInTheDocument());
  });

  it('등록이 거부(400)되면 toast만 뜨고 모달은 열린 채로 유지되며 onRegistered는 호출되지 않는다', async () => {
    const reasons = ['관리자 API 참조(/api/admin)가 포함되어 있습니다'];
    vi.mocked(apiFetch).mockRejectedValue(new ApiError(400, reasons.join(', '), undefined, reasons));
    const onRegistered = vi.fn();

    render(<TemplateRegisterDialog onRegistered={onRegistered} />);
    fireEvent.click(screen.getByRole('button', { name: '새 템플릿 등록' }));

    fireEvent.change(screen.getByLabelText('HTML 파일'), { target: { files: [makeHtmlFile()] } });
    fireEvent.click(screen.getByRole('button', { name: '템플릿 등록' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(onRegistered).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: '새 템플릿 등록' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '템플릿 등록' })).toBeInTheDocument();
  });
});
