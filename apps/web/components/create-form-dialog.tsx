'use client';

import { useEffect, useState, type FormEvent } from 'react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiFetch } from '@/lib/api';
import type { Form, Template } from '@/lib/types';

/**
 * 캠페인에 새 신청 폼을 만드는 다이얼로그. 템플릿을 선택하고 이름·성공 메시지를 입력한다.
 */
export function CreateFormDialog({ campaignId, onCreated }: { campaignId: string; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateId, setTemplateId] = useState('');
  const [name, setName] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    apiFetch<Template[]>('/api/admin/templates')
      .then(setTemplates)
      .catch(() => setTemplates([]));
  }, [open]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!templateId) {
      toast.error('템플릿을 선택하세요');
      return;
    }
    setSubmitting(true);
    try {
      await apiFetch<Form>('/api/admin/forms', {
        method: 'POST',
        json: {
          campaignId,
          templateId,
          name,
          successMessage: successMessage || undefined,
        },
      });
      toast.success('폼을 만들었습니다');
      setName('');
      setSuccessMessage('');
      setTemplateId('');
      setOpen(false);
      onCreated();
    } catch {
      toast.error('폼을 만들지 못했습니다');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>폼 만들기</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>새 폼</DialogTitle>
          <DialogDescription>템플릿과 이름, 성공 메시지를 입력하세요.</DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="form-template">템플릿</Label>
            <Select
              value={templateId || null}
              onValueChange={(value) => setTemplateId(value ? String(value) : '')}
            >
              <SelectTrigger id="form-template">
                <SelectValue placeholder="템플릿 선택" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="form-name">이름</Label>
            <Input id="form-name" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="form-success-message">성공 메시지</Label>
            <Input
              id="form-success-message"
              value={successMessage}
              onChange={(e) => setSuccessMessage(e.target.value)}
              placeholder="신청이 완료되었습니다."
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
