import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatRate } from '@/lib/format';
import { VISIT_STAT_LABEL, VISIT_STAT_TITLE, VISITOR_STAT_LABEL, VISITOR_STAT_TITLE } from '@/lib/types';

interface StatCardsProps {
  visits: number;
  visitors: number;
  submissions: number;
  conversionRate: number;
}

/**
 * 조회수/방문자 수/신청/전환율 4개 지표를 카드로 보여준다(ADR 0005 워딩).
 */
export function StatCards({ visits, visitors, submissions, conversionRate }: StatCardsProps) {
  const items = [
    { label: VISIT_STAT_LABEL, title: VISIT_STAT_TITLE, value: visits.toLocaleString('ko-KR') },
    { label: VISITOR_STAT_LABEL, title: VISITOR_STAT_TITLE, value: visitors.toLocaleString('ko-KR') },
    { label: '신청', title: undefined, value: submissions.toLocaleString('ko-KR') },
    { label: '전환율', title: undefined, value: formatRate(conversionRate) },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map((item) => (
        <Card key={item.label} size="sm">
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground" title={item.title}>
              {item.label}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{item.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
