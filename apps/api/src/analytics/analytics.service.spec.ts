import { AnalyticsService, mergeChannelStats } from './analytics.service';

describe('mergeChannelStats', () => {
  it('없는 채널은 0으로 채우고 direct,instagram,x,youtube,threads 순서를 지킨다', () => {
    const result = mergeChannelStats([{ channel: 'instagram', visits: 5, visitors: 3, submissions: 1 }]);
    expect(result.map((r) => r.channel)).toEqual(['direct', 'instagram', 'x', 'youtube', 'threads']);
    expect(result[0]).toEqual({ channel: 'direct', visits: 0, visitors: 0, submissions: 0, conversionRate: 0 });
    expect(result[1]).toEqual({ channel: 'instagram', visits: 5, visitors: 3, submissions: 1, conversionRate: 0.3333 });
  });

  it('입력이 비어 있으면 5개 채널이 모두 0이다', () => {
    const result = mergeChannelStats([]);
    expect(result).toHaveLength(5);
    expect(result.every((r) => r.visits === 0 && r.visitors === 0 && r.submissions === 0)).toBe(true);
  });

  it('문자열로 온 카운트도 숫자로 변환한다', () => {
    const result = mergeChannelStats([
      { channel: 'x', visits: '10' as unknown as number, visitors: '2' as unknown as number, submissions: '2' as unknown as number },
    ]);
    const xRow = result.find((r) => r.channel === 'x');
    expect(xRow).toEqual({ channel: 'x', visits: 10, visitors: 2, submissions: 2, conversionRate: 1 });
  });
});

describe('AnalyticsService', () => {
  function dataSourceMock() {
    return { query: jest.fn() };
  }

  it('channelStats는 전체 캠페인 합산을 5행 고정으로 반환한다', async () => {
    const dataSource = dataSourceMock();
    dataSource.query
      .mockResolvedValueOnce([
        { channel: 'instagram', visits: 4, visitors: 2 },
        { channel: 'direct', visits: 1, visitors: 1 },
      ])
      .mockResolvedValueOnce([{ channel: 'instagram', submissions: 1 }]);
    const service = new AnalyticsService(dataSource as never);
    const result = await service.channelStats();
    expect(result).toHaveLength(5);
    expect(result.map((r) => r.channel)).toEqual(['direct', 'instagram', 'x', 'youtube', 'threads']);
    const instagram = result.find((r) => r.channel === 'instagram');
    expect(instagram).toEqual({ channel: 'instagram', visits: 4, visitors: 2, submissions: 1, conversionRate: 0.5 });
  });

  it('campaignStats는 캠페인 총계와 채널 breakdown을 함께 반환한다(ADR 0017: GROUPING SETS로 쿼리 2개)', async () => {
    const dataSource = dataSourceMock();
    dataSource.query
      // 방문: 채널별 행 + GROUPING SETS(())의 총계 행(channel = '__total__')
      .mockResolvedValueOnce([
        { channel: 'instagram', visits: 10, visitors: 4 },
        { channel: '__total__', visits: 10, visitors: 4 },
      ])
      // 제출: 채널별 행 + 총계 행
      .mockResolvedValueOnce([
        { channel: 'instagram', submissions: 2 },
        { channel: '__total__', submissions: 2 },
      ]);
    const service = new AnalyticsService(dataSource as never);
    const result = await service.campaignStats('camp-1');
    expect(dataSource.query).toHaveBeenCalledTimes(2);
    expect(result.campaignId).toBe('camp-1');
    expect(result.visits).toBe(10);
    expect(result.visitors).toBe(4);
    expect(result.submissions).toBe(2);
    expect(result.conversionRate).toBe(0.5);
    expect(result.channels).toHaveLength(5);
    const instagram = result.channels.find((c) => c.channel === 'instagram');
    expect(instagram).toEqual({ channel: 'instagram', visits: 10, visitors: 4, submissions: 2, conversionRate: 0.2 });
  });

  it('campaignStats: 방문·제출이 전혀 없으면 총계 행이 없어도 0으로 채운다', async () => {
    const dataSource = dataSourceMock();
    dataSource.query.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    const service = new AnalyticsService(dataSource as never);
    const result = await service.campaignStats('camp-1');
    expect(result.visits).toBe(0);
    expect(result.visitors).toBe(0);
    expect(result.submissions).toBe(0);
    expect(result.conversionRate).toBe(0);
  });

  it('campaignList는 캠페인별 성과 배열을 반환한다', async () => {
    const dataSource = dataSourceMock();
    dataSource.query.mockResolvedValueOnce([
      { campaignId: 'camp-1', name: '캠페인A', status: 'active', visits: 10, visitors: 5, submissions: 2 },
    ]);
    const service = new AnalyticsService(dataSource as never);
    const result = await service.campaignList();
    expect(result).toEqual([
      { campaignId: 'camp-1', name: '캠페인A', status: 'active', visits: 10, visitors: 5, submissions: 2, conversionRate: 0.4 },
    ]);
  });
});
