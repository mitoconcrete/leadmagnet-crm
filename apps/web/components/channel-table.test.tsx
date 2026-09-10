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

  it('전달받은 stats로 항상 5행(direct 포함)을 순서대로 보여준다', () => {
    render(<ChannelTable stats={stats} loading={false} />);

    expect(screen.getAllByRole('row')).toHaveLength(6); // 헤더 1 + 채널 5

    const rows = screen.getAllByRole('row').slice(1);
    const labels = rows.map((row) => row.querySelector('td')?.textContent);
    expect(labels).toEqual(['직접 유입', '인스타그램', 'X', '유튜브', '스레드']);
    expect(screen.getByText('33.3%')).toBeInTheDocument();
  });

  it('데이터가 없는 채널은 0으로 표시한다', () => {
    render(<ChannelTable stats={[]} loading={false} />);

    expect(screen.getAllByRole('row')).toHaveLength(6);
    expect(screen.getAllByText('0.0%')).toHaveLength(5);
  });

  it('표 헤더가 sticky다(ADR 0021 2026-09-10)', () => {
    render(<ChannelTable stats={stats} loading={false} />);

    const thead = document.querySelector('thead');
    expect(thead).toHaveClass('sticky');
  });
});
