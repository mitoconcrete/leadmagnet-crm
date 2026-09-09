import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatCards } from './stat-cards';

describe('StatCards', () => {
  it('방문·방문자·신청·전환율 카드를 보여준다', () => {
    render(<StatCards visits={100} visitors={80} submissions={20} conversionRate={0.25} />);

    expect(screen.getByText('방문')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('방문자')).toBeInTheDocument();
    expect(screen.getByText('80')).toBeInTheDocument();
    expect(screen.getByText('신청')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
    expect(screen.getByText('전환율')).toBeInTheDocument();
    expect(screen.getByText('25.0%')).toBeInTheDocument();
  });
});
