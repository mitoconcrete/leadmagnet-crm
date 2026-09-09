import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { TemplateTable } from './template-table';
import { apiFetch } from '@/lib/api';
import type { Template } from '@/lib/types';

vi.mock('@/lib/api', () => ({
  apiFetch: vi.fn(),
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
});
