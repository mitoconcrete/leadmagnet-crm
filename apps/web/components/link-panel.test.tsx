import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LinkPanel } from './link-panel';
import { apiFetch, ApiError } from '@/lib/api';
import { toast } from 'sonner';
import type { Link } from '@/lib/types';

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return { ...actual, apiFetch: vi.fn() };
});

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const writeText = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
  });
});

describe('LinkPanel', () => {
  it('링크가 없는 채널은 "링크 만들기" 버튼을 보여주고, 클릭하면 생성 API를 호출한다', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce([]); // GET links
    const created: Link = {
      id: 'l1',
      formId: 'f1',
      channel: 'instagram',
      code: 'abc12345',
      url: 'http://localhost:3001/p/slug?src=abc12345',
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    vi.mocked(apiFetch).mockResolvedValueOnce(created); // POST links

    render(<LinkPanel formId="f1" />);

    await waitFor(() => expect(screen.getAllByRole('button', { name: '링크 만들기' })).toHaveLength(4));

    fireEvent.click(screen.getAllByRole('button', { name: '링크 만들기' })[0]);

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith('/api/admin/forms/f1/links', {
        method: 'POST',
        json: { channel: 'instagram' },
      });
    });
    await waitFor(() => expect(screen.getByText(created.url)).toBeInTheDocument());
  });

  it('이미 있는 채널은 URL과 복사 버튼을 보여주고, 복사하면 클립보드에 기록한다', async () => {
    const existing: Link = {
      id: 'l1',
      formId: 'f1',
      channel: 'x',
      code: 'zzz99999',
      url: 'http://localhost:3001/p/slug?src=zzz99999',
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    vi.mocked(apiFetch).mockResolvedValueOnce([existing]);

    render(<LinkPanel formId="f1" />);

    await waitFor(() => expect(screen.getByText(existing.url)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: '복사' }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(existing.url));
    expect(toast.success).toHaveBeenCalled();
  });

  it('링크 목록 조회에 실패하면 오류 토스트를 띄운다', async () => {
    vi.mocked(apiFetch).mockRejectedValueOnce(new ApiError(500, '링크 목록을 불러오지 못했습니다'));

    render(<LinkPanel formId="f1" />);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
  });

  it('링크 생성이 409로 실패하면 목록을 다시 조회한다', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce([]); // 최초 조회
    vi.mocked(apiFetch).mockRejectedValueOnce(new ApiError(409, '이미 링크가 있습니다')); // 생성 실패
    const existing: Link = {
      id: 'l1',
      formId: 'f1',
      channel: 'instagram',
      code: 'abc12345',
      url: 'http://localhost:3001/p/slug?src=abc12345',
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    vi.mocked(apiFetch).mockResolvedValueOnce([existing]); // 재조회

    render(<LinkPanel formId="f1" />);

    await waitFor(() => expect(screen.getAllByRole('button', { name: '링크 만들기' })).toHaveLength(4));
    fireEvent.click(screen.getAllByRole('button', { name: '링크 만들기' })[0]);

    await waitFor(() => expect(screen.getByText(existing.url)).toBeInTheDocument());
    expect(apiFetch).toHaveBeenCalledTimes(3);
  });

  it('세로 한 열 레이아웃(사용자 보고 버그 수정): 그리드가 아니라 채널 라벨 고정폭·URL 줄임표로 구성한다', async () => {
    const existing: Link = {
      id: 'l1',
      formId: 'f1',
      channel: 'x',
      code: 'zzz99999',
      url: 'http://localhost:3001/p/slug?src=zzz99999',
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    vi.mocked(apiFetch).mockResolvedValueOnce([existing]);

    const { container } = render(<LinkPanel formId="f1" />);

    await waitFor(() => expect(screen.getByText(existing.url)).toBeInTheDocument());

    // 좁은 카드에서 "인스타그램" 같은 라벨이 글자 단위로 세로 줄바꿈되지 않도록 4채널 라벨 모두 whitespace-nowrap.
    for (const label of ['인스타그램', 'X', '유튜브', '스레드']) {
      expect(screen.getByText(label)).toHaveClass('whitespace-nowrap');
    }

    // URL은 카드 폭을 넘지 않도록 잘리고(줄임표) 전체 값은 title 속성으로 접근 가능해야 한다.
    const urlEl = screen.getByText(existing.url);
    expect(urlEl).toHaveClass('truncate');
    expect(urlEl).toHaveAttribute('title', existing.url);

    // 2열 그리드(sm:grid-cols-2)가 아니라 위에서 아래로 한 채널씩 쌓는 세로 목록이어야 한다.
    expect(container.querySelector('.grid-cols-2')).toBeNull();
    expect(container.querySelector('.sm\\:grid-cols-2')).toBeNull();
  });

  it('마운트 시 링크 목록을 1회만 조회한다(배포 링크 패널이 항상 펼쳐져 있어도 재조회하지 않는다)', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce([]);

    render(<LinkPanel formId="f1" />);

    await waitFor(() => expect(screen.getAllByRole('button', { name: '링크 만들기' })).toHaveLength(4));

    expect(apiFetch).toHaveBeenCalledTimes(1);
    expect(apiFetch).toHaveBeenCalledWith('/api/admin/forms/f1/links');
  });
});
