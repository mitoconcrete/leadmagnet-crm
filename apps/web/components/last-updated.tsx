'use client';

import { formatTimeKST } from '@/lib/format';
import { Button } from '@/components/ui/button';

interface LastUpdatedProps {
  lastUpdatedAt: Date | null;
  error: unknown;
  isRefreshing: boolean;
  onRefresh: () => void;
}

/**
 * "마지막 갱신 HH:MM:SS" 또는 "갱신 실패(마지막 성공 HH:MM:SS)"와 "지금 갱신" 버튼을 보여준다(ADR 0016).
 */
export function LastUpdated({ lastUpdatedAt, error, isRefreshing, onRefresh }: LastUpdatedProps) {
  let label: string;
  if (error) {
    label = lastUpdatedAt ? `갱신 실패(마지막 성공 ${formatTimeKST(lastUpdatedAt)})` : '갱신 실패';
  } else if (lastUpdatedAt) {
    label = `마지막 갱신 ${formatTimeKST(lastUpdatedAt)}`;
  } else {
    label = '아직 갱신되지 않았습니다';
  }

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <span className={error ? 'text-destructive' : undefined}>{label}</span>
      <Button variant="outline" size="sm" disabled={isRefreshing} onClick={onRefresh}>
        지금 갱신
      </Button>
    </div>
  );
}
