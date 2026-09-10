import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChannelTable } from './channel-table';
import type { ChannelStat } from '@/lib/types';

const stats: ChannelStat[] = [
  { channel: 'instagram', visits: 40, visitors: 30, submissions: 10, conversionRate: 0.3333 },
];

describe('ChannelTable', () => {
  it('불러오는 중이면 안내 문구를 보여준다', () => {
    render(<ChannelTable stats={[]} loading={true} />);

    expect(screen.getByText('불러오는 중…')).toBeInTheDocument();
  });

  it('direct가 0이면(코드 없이 열린 적 없음) 4채널만 순서대로 보여준다(ADR 0005)', () => {
    render(<ChannelTable stats={stats} loading={false} />);

    expect(screen.getAllByRole('row')).toHaveLength(5); // 헤더 1 + 채널 4(direct 숨김)

    const rows = screen.getAllByRole('row').slice(1);
    const labels = rows.map((row) => row.querySelector('td')?.textContent);
    expect(labels).toEqual(['인스타그램', 'X', '유튜브', '스레드']);
    expect(screen.getByText('33.3%')).toBeInTheDocument();
    expect(screen.queryByText('직접 유입(코드 없음)')).not.toBeInTheDocument();
  });

  it('direct 값이 하나라도 0이 아니면 "직접 유입(코드 없음)" 행을 맨 위에 보여준다(ADR 0005)', () => {
    const withDirect: ChannelStat[] = [
      { channel: 'direct', visits: 5, visitors: 4, submissions: 1, conversionRate: 0.2 },
      ...stats,
    ];
    render(<ChannelTable stats={withDirect} loading={false} />);

    expect(screen.getAllByRole('row')).toHaveLength(6); // 헤더 1 + 채널 5(direct 포함)

    const rows = screen.getAllByRole('row').slice(1);
    const labels = rows.map((row) => row.querySelector('td')?.textContent);
    expect(labels).toEqual(['직접 유입(코드 없음)', '인스타그램', 'X', '유튜브', '스레드']);
  });

  it('데이터가 없는 채널은 0으로 표시한다(direct는 전부 0이므로 숨긴다)', () => {
    render(<ChannelTable stats={[]} loading={false} />);

    expect(screen.getAllByRole('row')).toHaveLength(5);
    expect(screen.getAllByText('0.0%')).toHaveLength(4);
  });

  it('표 헤더가 sticky다(ADR 0021 2026-09-10)', () => {
    render(<ChannelTable stats={stats} loading={false} />);

    const thead = document.querySelector('thead');
    expect(thead).toHaveClass('sticky');
    expect(thead).toHaveClass('bg-inherit');
    expect(thead).not.toHaveClass('bg-background');
  });

  it('방문 열은 "조회수", 방문자 열은 "방문자 수"로 표시하고 헤더에 정의 title이 있다(ADR 0005)', () => {
    render(<ChannelTable stats={stats} loading={false} />);

    const visitHeader = screen.getByRole('columnheader', { name: '조회수' });
    expect(visitHeader).toHaveAttribute('title', '링크가 열린 횟수(새로고침 포함)');

    const visitorHeader = screen.getByRole('columnheader', { name: '방문자 수' });
    expect(visitorHeader).toHaveAttribute('title', '서로 다른 브라우저(쿠키) 수');
  });
});
