import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatCards } from './stat-cards';

describe('StatCards', () => {
  it('조회수·방문자 수·신청·전환율 카드를 보여준다(ADR 0005 워딩)', () => {
    render(<StatCards visits={100} visitors={80} submissions={20} conversionRate={0.25} />);

    expect(screen.getByText('조회수')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('방문자 수')).toBeInTheDocument();
    expect(screen.getByText('80')).toBeInTheDocument();
    expect(screen.getByText('신청')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
    expect(screen.getByText('전환율')).toBeInTheDocument();
    expect(screen.getByText('25.0%')).toBeInTheDocument();
  });

  it('조회수·방문자 수 카드 제목에 정의를 알려주는 title 툴팁이 있다', () => {
    render(<StatCards visits={100} visitors={80} submissions={20} conversionRate={0.25} />);

    expect(screen.getByText('조회수')).toHaveAttribute('title', '링크가 열린 횟수(새로고침 포함)');
    expect(screen.getByText('방문자 수')).toHaveAttribute('title', '서로 다른 브라우저(쿠키) 수');
  });
});
