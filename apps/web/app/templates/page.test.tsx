import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import TemplatesPage from './page';

vi.mock('@/components/auth-gate', () => ({
  AuthGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/app-shell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div data-testid="app-shell">{children}</div>,
}));

const templateTableProps: { refreshKey?: number }[] = [];

vi.mock('@/components/template-table', () => ({
  TemplateTable: (props: { refreshKey?: number }) => {
    templateTableProps.push(props);
    return <div data-testid="template-table" />;
  },
}));

vi.mock('@/components/template-register-dialog', () => ({
  TemplateRegisterDialog: ({ onRegistered }: { onRegistered: () => void }) => (
    <button onClick={onRegistered}>새 템플릿 등록</button>
  ),
}));

describe('TemplatesPage', () => {
  beforeEach(() => {
    templateTableProps.length = 0;
  });

  it('등록 다이얼로그 트리거와 템플릿 목록을 함께 보여준다', () => {
    render(<TemplatesPage />);

    expect(screen.getByTestId('app-shell')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '새 템플릿 등록' })).toBeInTheDocument();
    expect(screen.getByTestId('template-table')).toBeInTheDocument();
  });

  it('등록 다이얼로그의 onRegistered가 호출되면 TemplateTable의 refreshKey가 바뀐다', () => {
    render(<TemplatesPage />);

    const before = templateTableProps.at(-1)?.refreshKey;
    fireEvent.click(screen.getByRole('button', { name: '새 템플릿 등록' }));
    const after = templateTableProps.at(-1)?.refreshKey;

    expect(after).not.toBe(before);
  });

  it('데스크톱 우선 레이아웃(ADR 0021 2026-09-10 개정): 등록은 상단 바 버튼+모달로 분리하고, 목록 섹션이 남은 공간을 전폭으로 채운다', () => {
    render(<TemplatesPage />);

    const heading = screen.getByRole('heading', { name: '템플릿 목록' });
    const section = heading.closest('section');
    expect(section?.className).toContain('flex');
    expect(section?.className).toContain('flex-1');
    expect(section?.className).toContain('min-h-0');
  });
});
