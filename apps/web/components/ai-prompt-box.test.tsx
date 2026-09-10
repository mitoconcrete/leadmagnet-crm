import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AiPromptBox } from './ai-prompt-box';
import { AI_PROMPT_TEMPLATE } from '@/lib/ai-prompt';
import { toast } from 'sonner';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const writeText = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
  });
});

/** 접힌 트리거를 펼친다(ADR 0021 2026-09-10 개정: 기본 접힘). */
function expandBox() {
  fireEvent.click(screen.getByRole('button', { name: /AI로 HTML 만들기/ }));
}

describe('AiPromptBox', () => {
  it('기본 상태는 접혀 있고 트리거 한 줄만 보인다(ADR 0021 2026-09-10 개정)', () => {
    render(<AiPromptBox />);

    expect(screen.getByRole('button', { name: /AI로 HTML 만들기 — 프롬프트 보기/ })).toBeInTheDocument();
    expect(screen.queryByText('AI로 만들기')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '프롬프트 복사' })).not.toBeInTheDocument();
    expect(screen.queryByText(AI_PROMPT_TEMPLATE)).not.toBeInTheDocument();
  });

  it('트리거를 클릭하면 펼쳐져 제목·설명·조건 요약·프롬프트 전문을 보여준다', () => {
    const { container } = render(<AiPromptBox />);

    expandBox();

    expect(screen.getByText('AI로 만들기')).toBeInTheDocument();
    expect(
      screen.getByText('아래 프롬프트를 ChatGPT·Claude 등에 붙여넣어 HTML 파일을 만든 뒤 여기에 등록하세요'),
    ).toBeInTheDocument();

    expect(screen.getByText('.html 파일 하나')).toBeInTheDocument();
    expect(screen.getByText('<form>과 모든 입력의 name 속성 필수')).toBeInTheDocument();
    expect(screen.getByText('외부 스크립트 없이 완전한 파일 하나')).toBeInTheDocument();

    const pre = container.querySelector('pre');
    expect(pre).not.toBeNull();
    expect(pre?.textContent).toBe(AI_PROMPT_TEMPLATE);
  });

  it('펼친 뒤 트리거를 다시 클릭하면 접힌다', () => {
    render(<AiPromptBox />);

    expandBox();
    expect(screen.getByText('AI로 만들기')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /AI로 HTML 만들기/ }));
    expect(screen.queryByText('AI로 만들기')).not.toBeInTheDocument();
  });

  it('복사 버튼을 누르면 프롬프트를 클립보드에 기록하고 성공 토스트를 띄운다', async () => {
    writeText.mockResolvedValue(undefined);

    render(<AiPromptBox />);
    expandBox();
    fireEvent.click(screen.getByRole('button', { name: '프롬프트 복사' }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(AI_PROMPT_TEMPLATE));
    expect(toast.success).toHaveBeenCalledWith('프롬프트를 복사했습니다');
  });

  it('클립보드 복사에 실패하면 오류 토스트를 띄운다', async () => {
    writeText.mockRejectedValue(new Error('클립보드 접근이 거부되었습니다'));

    render(<AiPromptBox />);
    expandBox();
    fireEvent.click(screen.getByRole('button', { name: '프롬프트 복사' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(toast.success).not.toHaveBeenCalled();
  });
});
