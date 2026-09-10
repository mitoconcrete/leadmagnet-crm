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

/** 닫힌 트리거를 연다(ADR 0021 2026-09-10 추가 개정: 뜨는 Popover, 기본 닫힘). */
function openBox() {
  fireEvent.click(screen.getByRole('button', { name: /AI로 HTML 만들기/ }));
}

describe('AiPromptBox', () => {
  it('기본 상태는 닫혀 있고 트리거 한 줄만 보인다', () => {
    render(<AiPromptBox />);

    expect(screen.getByRole('button', { name: /AI로 HTML 만들기/ })).toBeInTheDocument();
    expect(screen.queryByText('AI로 만들기')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '프롬프트 복사' })).not.toBeInTheDocument();
    expect(screen.queryByText(AI_PROMPT_TEMPLATE)).not.toBeInTheDocument();
  });

  it('트리거가 클릭 요소로 보이도록 테두리·배경·호버·포커스 링 스타일을 가진다', () => {
    render(<AiPromptBox />);

    const trigger = screen.getByRole('button', { name: /AI로 HTML 만들기/ });
    expect(trigger.className).toContain('border');
    expect(trigger.className).toContain('bg-muted/50');
    expect(trigger.className).toContain('hover:bg-muted');
    expect(trigger.className).toContain('focus-visible:ring-2');
    expect(trigger.className).toContain('focus-visible:ring-ring');
  });

  it('트리거 문구는 액션임이 명확하게 드러난다', () => {
    render(<AiPromptBox />);

    expect(screen.getByText(/AI로 HTML 만들기/)).toBeInTheDocument();
    expect(screen.getByText(/프롬프트 열기/)).toBeInTheDocument();
  });

  it('트리거는 위쪽 여백(mt-4, 16px 이상)을 가진다(모달 제목과 충분히 떨어지도록)', () => {
    render(<AiPromptBox />);

    const trigger = screen.getByRole('button', { name: /AI로 HTML 만들기/ });
    expect(trigger.className).toContain('mt-4');
  });

  it('트리거를 클릭하면 떠 있는 패널이 열려 제목·설명·조건 요약·프롬프트 전문을 보여준다', () => {
    const { baseElement } = render(<AiPromptBox />);

    openBox();

    expect(screen.getByText('AI로 만들기')).toBeInTheDocument();
    expect(
      screen.getByText('아래 프롬프트를 ChatGPT·Claude 등에 붙여넣어 HTML 파일을 만든 뒤 여기에 등록하세요'),
    ).toBeInTheDocument();

    expect(screen.getByText('.html 파일 하나')).toBeInTheDocument();
    expect(screen.getByText('<form>과 모든 입력의 name 속성 필수')).toBeInTheDocument();
    expect(screen.getByText('외부 스크립트 없이 완전한 파일 하나')).toBeInTheDocument();

    const pre = baseElement.querySelector('pre');
    expect(pre).not.toBeNull();
    expect(pre?.textContent).toBe(AI_PROMPT_TEMPLATE);
  });

  it('열린 패널은 Popover로 렌더되어(popover-content) 뜨는 크기·스크롤 제약을 갖는다', () => {
    const { baseElement } = render(<AiPromptBox />);
    openBox();

    const content = baseElement.querySelector('[data-slot="popover-content"]');
    expect(content?.className).toContain('w-[36rem]');
    expect(content?.className).toContain('max-w-[calc(100vw-2rem)]');
    expect(content?.className).toContain('max-h-[60vh]');
    expect(content?.className).toContain('overflow-auto');
    expect(content?.className).toContain('p-4');
    expect(content?.className).toContain('box-border');
  });

  it('열린 뒤 트리거를 다시 클릭하면 닫힌다', () => {
    render(<AiPromptBox />);

    openBox();
    expect(screen.getByText('AI로 만들기')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /AI로 HTML 만들기/ }));
    expect(screen.queryByText('AI로 만들기')).not.toBeInTheDocument();
  });

  it('열린 뒤 바깥을 클릭하면 닫힌다', () => {
    render(<AiPromptBox />);

    openBox();
    expect(screen.getByText('AI로 만들기')).toBeInTheDocument();

    fireEvent.mouseDown(document.body);
    fireEvent.click(document.body);
    expect(screen.queryByText('AI로 만들기')).not.toBeInTheDocument();
  });

  it('복사 버튼을 누르면 프롬프트를 클립보드에 기록하고 성공 토스트를 띄운다', async () => {
    writeText.mockResolvedValue(undefined);

    render(<AiPromptBox />);
    openBox();
    fireEvent.click(screen.getByRole('button', { name: '프롬프트 복사' }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(AI_PROMPT_TEMPLATE));
    expect(toast.success).toHaveBeenCalledWith('프롬프트를 복사했습니다');
  });

  it('클립보드 복사에 실패하면 오류 토스트를 띄운다', async () => {
    writeText.mockRejectedValue(new Error('클립보드 접근이 거부되었습니다'));

    render(<AiPromptBox />);
    openBox();
    fireEvent.click(screen.getByRole('button', { name: '프롬프트 복사' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('열리면 "프롬프트 복사" 버튼이 우측 정렬 컨테이너(flex justify-end) 안에 있다', () => {
    render(<AiPromptBox />);
    openBox();

    const button = screen.getByRole('button', { name: '프롬프트 복사' });
    expect(button.parentElement?.className).toContain('flex');
    expect(button.parentElement?.className).toContain('justify-end');
  });

  it('열린 내용에 hr·구분선(Separator)이 없다', () => {
    const { baseElement } = render(<AiPromptBox />);
    openBox();

    expect(baseElement.querySelector('hr')).toBeNull();
    expect(baseElement.querySelector('[data-slot="separator"]')).toBeNull();
  });

  it('내부 요소는 개별 패딩/마진 없는 일반 div로 단순화되어 있다(Card의 CardHeader/CardContent 패딩 미사용)', () => {
    const { baseElement } = render(<AiPromptBox />);
    openBox();

    expect(baseElement.querySelector('[data-slot="card-header"]')).toBeNull();
    expect(baseElement.querySelector('[data-slot="card-content"]')).toBeNull();
  });

  it('프롬프트 <pre>는 box-border·w-full이라 패딩이 너비에 영향을 주지 않는다', () => {
    const { baseElement } = render(<AiPromptBox />);
    openBox();

    const pre = baseElement.querySelector('pre');
    expect(pre?.className).toContain('box-border');
    expect(pre?.className).toContain('w-full');
  });
});
