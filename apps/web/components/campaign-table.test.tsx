import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CampaignTable } from './campaign-table';
import type { CampaignRow } from '@/lib/types';

const rows: CampaignRow[] = [
  {
    campaignId: 'c1',
    name: '가을 캠페인',
    status: 'active',
    visits: 100,
    visitors: 80,
    submissions: 20,
    conversionRate: 0.25,
  },
];

describe('CampaignTable', () => {
  it('불러오는 중이면 안내 문구를 보여준다', () => {
    render(<CampaignTable rows={[]} loading={true} />);

    expect(screen.getByText('불러오는 중…')).toBeInTheDocument();
  });

  it('전달받은 rows로 이름·상태·전환율을 표시한다', () => {
    render(<CampaignTable rows={rows} loading={false} />);

    expect(screen.getByRole('link', { name: '가을 캠페인' })).toHaveAttribute('href', '/campaigns/c1');
    expect(screen.getByText('25.0%')).toBeInTheDocument();
  });

  it('캠페인이 없으면 안내 문구를 보여준다', () => {
    render(<CampaignTable rows={[]} loading={false} />);

    expect(screen.getByText('등록된 캠페인이 없습니다.')).toBeInTheDocument();
  });

  it('보관된 캠페인은 보관됨 배지를 보여준다', () => {
    render(<CampaignTable rows={[{ ...rows[0], status: 'archived' }]} loading={false} />);

    expect(screen.getByText('보관됨')).toBeInTheDocument();
  });

  it('행이 많아져도 페이지가 길어지지 않도록 자기 영역 안에서만 스크롤하고 sticky thead를 가진다(ADR 0021)', () => {
    render(<CampaignTable rows={rows} loading={false} />);

    const region = screen.getByRole('region', { name: '캠페인 성과 목록' });
    expect(region).toHaveClass('overflow-y-auto');
    // 뷰포트 상대 고정 높이(max-h-[60vh]) 대신 그리드가 준 남은 높이를 채운다.
    expect(region.className).toContain('min-h-0');
    expect(region.className).toContain('flex-1');
    expect(region.className).not.toContain('max-h-[60vh]');

    const thead = region.querySelector('thead');
    expect(thead).toHaveClass('sticky');
    expect(thead).toHaveClass('bg-inherit');
    expect(thead).not.toHaveClass('bg-background');
  });

  it('진행중인데 활성 폼이 0개면 활성 폼 없음 배지를 보여준다(ADR 0019)', () => {
    render(<CampaignTable rows={[{ ...rows[0], status: 'active', forms: 3, activeForms: 0 }]} loading={false} />);

    const badge = screen.getByText('활성 폼 없음');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveAttribute('title', '템플릿 삭제 등으로 폼이 모두 비활성 상태입니다');
  });

  it('종료된 캠페인은 활성 폼이 0개여도 배지를 보여주지 않는다', () => {
    render(<CampaignTable rows={[{ ...rows[0], status: 'archived', forms: 3, activeForms: 0 }]} loading={false} />);

    expect(screen.queryByText('활성 폼 없음')).not.toBeInTheDocument();
  });

  it('진행중이고 활성 폼이 1개 이상이면 배지를 보여주지 않는다', () => {
    render(<CampaignTable rows={[{ ...rows[0], status: 'active', forms: 3, activeForms: 1 }]} loading={false} />);

    expect(screen.queryByText('활성 폼 없음')).not.toBeInTheDocument();
  });

  it('폼(활성/전체) 열을 우측 정렬 고정폭 숫자로 보여준다', () => {
    render(<CampaignTable rows={[{ ...rows[0], forms: 3, activeForms: 2 }]} loading={false} />);

    const header = screen.getByRole('columnheader', { name: '폼(활성/전체)' });
    expect(header.className).toContain('text-right');
    expect(header.className).toContain('tabular-nums');

    const cell = screen.getByText('2/3');
    expect(cell.className).toContain('text-right');
    expect(cell.className).toContain('tabular-nums');
  });

  it('forms·activeForms가 없으면 0/0으로 표시한다', () => {
    render(<CampaignTable rows={rows} loading={false} />);

    expect(screen.getByText('0/0')).toBeInTheDocument();
  });

  it('밀도(ADR 0021): 조회수·방문자 수·신청·전환율 열은 헤더·셀 모두 우측 정렬 고정폭 숫자다', () => {
    render(<CampaignTable rows={rows} loading={false} />);

    const headerCells = screen.getAllByRole('columnheader');
    const numericHeaders = headerCells.filter((cell) =>
      ['조회수', '방문자 수', '신청', '전환율'].includes(cell.textContent ?? ''),
    );
    expect(numericHeaders).toHaveLength(4);
    for (const header of numericHeaders) {
      expect(header.className).toContain('text-right');
      expect(header.className).toContain('tabular-nums');
    }

    const visitsCell = screen.getByText('100');
    expect(visitsCell.className).toContain('text-right');
    expect(visitsCell.className).toContain('tabular-nums');

    const rateCell = screen.getByText('25.0%');
    expect(rateCell.className).toContain('text-right');
    expect(rateCell.className).toContain('tabular-nums');
  });

  it('조회수·방문자 수 헤더에 정의를 알려주는 title 툴팁이 있다(ADR 0005)', () => {
    render(<CampaignTable rows={rows} loading={false} />);

    const visitHeader = screen.getByRole('columnheader', { name: '조회수' });
    expect(visitHeader).toHaveAttribute('title', '링크가 열린 횟수(새로고침 포함)');

    const visitorHeader = screen.getByRole('columnheader', { name: '방문자 수' });
    expect(visitorHeader).toHaveAttribute('title', '서로 다른 브라우저(쿠키) 수');
  });
});
