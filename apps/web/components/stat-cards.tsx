import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatRate } from '@/lib/format';

interface StatCardsProps {
  visits: number;
  visitors: number;
  submissions: number;
  conversionRate: number;
}

/**
 * 방문/방문자/신청/전환율 4개 지표를 카드로 보여준다.
 */
export function StatCards({ visits, visitors, submissions, conversionRate }: StatCardsProps) {
  const items = [
    { label: '방문', value: visits.toLocaleString('ko-KR') },
    { label: '방문자', value: visitors.toLocaleString('ko-KR') },
    { label: '신청', value: submissions.toLocaleString('ko-KR') },
    { label: '전환율', value: formatRate(conversionRate) },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map((item) => (
        <Card key={item.label} size="sm">
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">{item.label}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{item.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
