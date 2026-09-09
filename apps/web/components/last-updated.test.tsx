import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { LastUpdated } from './last-updated';

describe('LastUpdated', () => {
  it('마지막 갱신 시각을 HH:MM:SS(KST)로 보여준다', () => {
    render(
      <LastUpdated
        lastUpdatedAt={new Date('2026-01-01T00:00:00.000Z')}
        error={null}
        isRefreshing={false}
        onRefresh={vi.fn()}
      />,
    );

    expect(screen.getByText('마지막 갱신 09:00:00')).toBeInTheDocument();
  });

  it('아직 한 번도 갱신되지 않았으면 안내 문구를 보여준다', () => {
    render(<LastUpdated lastUpdatedAt={null} error={null} isRefreshing={false} onRefresh={vi.fn()} />);

    expect(screen.getByText('아직 갱신되지 않았습니다')).toBeInTheDocument();
  });

  it('오류가 있으면 마지막 성공 시각과 함께 갱신 실패 문구를 보여준다', () => {
    render(
      <LastUpdated
        lastUpdatedAt={new Date('2026-01-01T00:00:00.000Z')}
        error={new Error('실패')}
        isRefreshing={false}
        onRefresh={vi.fn()}
      />,
    );

    expect(screen.getByText('갱신 실패(마지막 성공 09:00:00)')).toBeInTheDocument();
  });

  it('지금 갱신 버튼을 클릭하면 onRefresh를 호출한다', () => {
    const onRefresh = vi.fn();
    render(
      <LastUpdated
        lastUpdatedAt={new Date('2026-01-01T00:00:00.000Z')}
        error={null}
        isRefreshing={false}
        onRefresh={onRefresh}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '지금 갱신' }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('갱신 중에는 버튼이 비활성화된다', () => {
    render(
      <LastUpdated
        lastUpdatedAt={new Date('2026-01-01T00:00:00.000Z')}
        error={null}
        isRefreshing={true}
        onRefresh={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: '지금 갱신' })).toBeDisabled();
  });
});
