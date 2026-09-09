'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ApiError, apiFetch } from '@/lib/api';
import { CHANNELS, CHANNEL_LABELS, type Channel, type Link } from '@/lib/types';

/**
 * 폼 하나의 배포 링크 4채널을 보여준다. 없으면 "링크 만들기", 있으면 URL과 복사 버튼.
 * 같은 채널로 동시에 생성해 409가 나면 목록을 다시 조회한다.
 * disabled가 true면(캠페인 종료) "링크 만들기" 버튼을 비활성화한다(ADR 0019).
 */
export function LinkPanel({ formId, disabled = false }: { formId: string; disabled?: boolean }) {
  const [links, setLinks] = useState<Link[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState<Channel | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await apiFetch<Link[]>(`/api/admin/forms/${formId}/links`);
      setLinks(data);
    } catch {
      toast.error('배포 링크 목록을 불러오지 못했습니다');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formId]);

  async function handleCreate(channel: Channel) {
    setCreating(channel);
    try {
      const link = await apiFetch<Link>(`/api/admin/forms/${formId}/links`, {
        method: 'POST',
        json: { channel },
      });
      setLinks((prev) => [...prev, link]);
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        await load();
      } else {
        toast.error('배포 링크를 만들지 못했습니다');
      }
    } finally {
      setCreating(null);
    }
  }

  async function handleCopy(url: string) {
    await navigator.clipboard.writeText(url);
    toast.success('링크를 복사했습니다');
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">불러오는 중…</p>;
  }

  const byChannel = new Map(links.map((l) => [l.channel, l]));

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {CHANNELS.map((channel) => {
        const link = byChannel.get(channel);
        return (
          <div
            key={channel}
            className="flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-sm"
          >
            <span className="font-medium">{CHANNEL_LABELS[channel]}</span>
            {link ? (
              <div className="flex items-center gap-2">
                <span className="max-w-40 truncate text-muted-foreground">{link.url}</span>
                <Button variant="outline" size="sm" onClick={() => handleCopy(link.url)}>
                  복사
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                disabled={disabled || creating === channel}
                onClick={() => handleCreate(channel)}
              >
                링크 만들기
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
