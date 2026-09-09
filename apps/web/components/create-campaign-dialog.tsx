'use client';

import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiFetch } from '@/lib/api';
import type { Campaign } from '@/lib/types';

/**
 * 캠페인 생성 다이얼로그. 성공하면 목록 재조회를 위해 onCreated를 호출한다.
 */
export function CreateCampaignDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await apiFetch<Campaign>('/api/admin/campaigns', {
        method: 'POST',
        json: { name, description: description || undefined },
      });
      toast.success('캠페인을 만들었습니다');
      setName('');
      setDescription('');
      setOpen(false);
      onCreated();
    } catch {
      toast.error('캠페인을 만들지 못했습니다');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>캠페인 만들기</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>새 캠페인</DialogTitle>
          <DialogDescription>이름과 설명을 입력하세요.</DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="campaign-name">이름</Label>
            <Input id="campaign-name" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="campaign-description">설명</Label>
            <Input
              id="campaign-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? '만드는 중…' : '만들기'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
