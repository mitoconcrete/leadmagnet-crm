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

vi.mock('@/components/template-upload-form', () => ({
  TemplateUploadForm: ({ onUploaded }: { onUploaded: () => void }) => (
    <button onClick={onUploaded}>템플릿 등록</button>
  ),
}));

describe('TemplatesPage', () => {
  beforeEach(() => {
    templateTableProps.length = 0;
  });

  it('업로드 폼과 템플릿 목록을 함께 보여준다', () => {
    render(<TemplatesPage />);

    expect(screen.getByTestId('app-shell')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '템플릿 등록' })).toBeInTheDocument();
    expect(screen.getByTestId('template-table')).toBeInTheDocument();
  });

  it('업로드 후 TemplateTable의 refreshKey가 바뀐다', () => {
    render(<TemplatesPage />);

    const before = templateTableProps.at(-1)?.refreshKey;
    fireEvent.click(screen.getByRole('button', { name: '템플릿 등록' }));
    const after = templateTableProps.at(-1)?.refreshKey;

    expect(after).not.toBe(before);
  });

  it('데스크톱 우선 레이아웃(ADR 0021): 2열(1:2) 그리드로 안내·등록과 목록을 나눠 갖는다', () => {
    render(<TemplatesPage />);

    const columns = screen.getByTestId('templates-columns');
    expect(columns.className).toContain('min-h-0');
    expect(columns.className).toContain('lg:grid-cols-[1fr_2fr]');
  });
});
