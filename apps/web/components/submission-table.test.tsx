import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { SubmissionTable } from './submission-table';
import type { SubmissionPage } from '@/lib/types';

function makePage(page: number): SubmissionPage {
  return {
    items: [
      {
        id: `s${page}`,
        formId: 'f1',
        formName: '기본 신청폼',
        campaignId: 'c1',
        channel: 'instagram',
        payload: { name: '홍길동', interest: ['A', 'B'] },
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    total: 25,
    page,
    limit: 20,
  };
}

describe('SubmissionTable', () => {
  it('불러오는 중이면 안내 문구를 보여준다', () => {
    render(<SubmissionTable data={null} loading={true} page={1} onPageChange={vi.fn()} />);

    expect(screen.getByText('불러오는 중…')).toBeInTheDocument();
  });

  it('전달받은 신청 명단으로 시각(KST)·폼·채널·payload를 보여준다', () => {
    render(<SubmissionTable data={makePage(1)} loading={false} page={1} onPageChange={vi.fn()} />);

    expect(screen.getByText('기본 신청폼')).toBeInTheDocument();
    expect(screen.getByText('인스타그램')).toBeInTheDocument();
    expect(screen.getByText('2026-01-01 09:00')).toBeInTheDocument();
    expect(screen.getByText('홍길동', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('A, B', { exact: false })).toBeInTheDocument();
  });

  it('신청 내역이 없으면 안내 문구를 보여준다', () => {
    render(
      <SubmissionTable
        data={{ items: [], total: 0, page: 1, limit: 20 }}
        loading={false}
        page={1}
        onPageChange={vi.fn()}
      />,
    );

    expect(screen.getByText('신청 내역이 없습니다.')).toBeInTheDocument();
  });

  it('data가 null이고 loading도 아니면(조회 실패) 안내 문구를 보여준다', () => {
    render(<SubmissionTable data={null} loading={false} page={1} onPageChange={vi.fn()} />);

    expect(screen.getByText('신청 내역이 없습니다.')).toBeInTheDocument();
  });

  it('payload 값이 객체이면 JSON 문자열로 방어 렌더한다', () => {
    // 서버 응답이 예상 스키마(Record<string, string | string[]>)를 벗어나는 경우를 방어적으로 검증한다.
    const data = {
      items: [
        {
          id: 's1',
          formId: 'f1',
          formName: '기본 신청폼',
          campaignId: 'c1',
          channel: 'instagram',
          payload: { name: { nested: true } },
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      total: 1,
      page: 1,
      limit: 20,
    } as unknown as SubmissionPage;

    render(
      <SubmissionTable
        data={data}
        loading={false}
        page={1}
        onPageChange={vi.fn()}
      />,
    );

    expect(screen.getByText(JSON.stringify({ nested: true }), { exact: false })).toBeInTheDocument();
  });

  it('다음 버튼을 누르면 onPageChange(page + 1)을 호출한다', () => {
    const onPageChange = vi.fn();
    render(<SubmissionTable data={makePage(1)} loading={false} page={1} onPageChange={onPageChange} />);

    expect(screen.getByRole('button', { name: '다음' })).not.toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '다음' }));

    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('첫 페이지에서는 이전 버튼이 비활성화되고, 마지막 페이지에서는 다음 버튼이 비활성화된다', () => {
    const { rerender } = render(
      <SubmissionTable data={makePage(1)} loading={false} page={1} onPageChange={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: '이전' })).toBeDisabled();

    rerender(<SubmissionTable data={makePage(2)} loading={false} page={2} onPageChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: '다음' })).toBeDisabled();
  });
});
