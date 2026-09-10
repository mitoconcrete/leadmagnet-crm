import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TemplateCombobox } from './template-combobox';
import type { Template } from '@/lib/types';

const templates: Template[] = [
  { id: 't1', name: '가을 랜딩', originalFilename: 'a.html', sizeBytes: 100, createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 't2', name: '겨울 세일', originalFilename: 'b.html', sizeBytes: 100, createdAt: '2026-01-01T00:00:00.000Z' },
];

describe('TemplateCombobox', () => {
  it('선택 전에는 "템플릿 선택"을 트리거에 보여준다', () => {
    render(<TemplateCombobox templates={templates} value="" onChange={vi.fn()} />);

    const trigger = screen.getByRole('combobox');
    expect(trigger).toHaveTextContent('템플릿 선택');
    expect(trigger.className).toContain('w-full');
    expect(trigger.className).toContain('justify-between');
  });

  it('트리거를 열고 입력으로 이름을 필터링한 뒤 항목을 클릭하면 onChange(id)를 호출하고, 값이 바뀌면 트리거에 선택된 이름을 보여준다', async () => {
    const onChange = vi.fn();
    const { rerender } = render(<TemplateCombobox templates={templates} value="" onChange={onChange} />);

    const trigger = screen.getByRole('combobox');
    fireEvent.click(trigger);

    await waitFor(() => expect(screen.getByRole('option', { name: '가을 랜딩' })).toBeInTheDocument());
    expect(screen.getByRole('option', { name: '겨울 세일' })).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('템플릿 이름 검색'), { target: { value: '겨울' } });

    await waitFor(() => expect(screen.queryByRole('option', { name: '가을 랜딩' })).not.toBeInTheDocument());
    expect(screen.getByRole('option', { name: '겨울 세일' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('option', { name: '겨울 세일' }));
    expect(onChange).toHaveBeenCalledWith('t2');

    rerender(<TemplateCombobox templates={templates} value="t2" onChange={onChange} />);
    expect(trigger).toHaveTextContent('겨울 세일');
  });

  it('선택된 템플릿 이름은 트리거 안에서 truncate로 표시한다', () => {
    render(<TemplateCombobox templates={templates} value="t1" onChange={vi.fn()} />);

    const name = screen.getByText('가을 랜딩');
    expect(name.className).toContain('truncate');
  });

  it('템플릿이 없으면 빈 상태 문구를 보여준다', async () => {
    render(<TemplateCombobox templates={[]} value="" onChange={vi.fn()} />);

    fireEvent.click(screen.getByRole('combobox'));

    await waitFor(() => expect(screen.getByText('템플릿이 없습니다.')).toBeInTheDocument());
  });
});
