import { SubmissionsService } from './submissions.service';

function queryBuilderMock() {
  const qb: Record<string, jest.Mock> = {};
  qb.innerJoin = jest.fn().mockReturnValue(qb);
  qb.andWhere = jest.fn().mockReturnValue(qb);
  qb.select = jest.fn().mockReturnValue(qb);
  qb.orderBy = jest.fn().mockReturnValue(qb);
  qb.offset = jest.fn().mockReturnValue(qb);
  qb.limit = jest.fn().mockReturnValue(qb);
  qb.getRawMany = jest.fn().mockResolvedValue([]);
  qb.getCount = jest.fn().mockResolvedValue(0);
  return qb;
}

function repoMock(qb: ReturnType<typeof queryBuilderMock>) {
  return { createQueryBuilder: jest.fn(() => qb) };
}

describe('SubmissionsService.list', () => {
  it('campaignId/formId를 모두 지정하면 두 조건 모두 andWhere로 적용한다', async () => {
    const qb = queryBuilderMock();
    const service = new SubmissionsService(repoMock(qb) as never);
    await service.list({ campaignId: 'camp-1', formId: 'form-1' });
    expect(qb.andWhere).toHaveBeenCalledWith('f.campaign_id = :campaignId', { campaignId: 'camp-1' });
    expect(qb.andWhere).toHaveBeenCalledWith('s.form_id = :formId', { formId: 'form-1' });
  });

  it('필터가 없으면 andWhere를 호출하지 않는다', async () => {
    const qb = queryBuilderMock();
    const service = new SubmissionsService(repoMock(qb) as never);
    await service.list({});
    expect(qb.andWhere).not.toHaveBeenCalled();
  });

  it('createdAt DESC로 정렬한다', async () => {
    const qb = queryBuilderMock();
    const service = new SubmissionsService(repoMock(qb) as never);
    await service.list({});
    expect(qb.orderBy).toHaveBeenCalledWith('s.created_at', 'DESC');
  });

  it('page/limit 기본값(1, 20)으로 offset·limit을 계산한다', async () => {
    const qb = queryBuilderMock();
    const service = new SubmissionsService(repoMock(qb) as never);
    await service.list({});
    expect(qb.offset).toHaveBeenCalledWith(0);
    expect(qb.limit).toHaveBeenCalledWith(20);
  });

  it('page=2, limit=10이면 offset=10, limit=10을 계산한다', async () => {
    const qb = queryBuilderMock();
    const service = new SubmissionsService(repoMock(qb) as never);
    await service.list({ page: 2, limit: 10 });
    expect(qb.offset).toHaveBeenCalledWith(10);
    expect(qb.limit).toHaveBeenCalledWith(10);
  });

  it('0 이하의 page/limit은 기본값으로 보정한다', async () => {
    const qb = queryBuilderMock();
    const service = new SubmissionsService(repoMock(qb) as never);
    const result = await service.list({ page: 0, limit: -5 });
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
  });

  it('응답은 {items, total, page, limit} 형태이며 items는 formName을 포함한다', async () => {
    const qb = queryBuilderMock();
    const rows = [
      {
        id: 'sub-1',
        formId: 'form-1',
        formName: '신청폼',
        campaignId: 'camp-1',
        channel: 'instagram',
        payload: { name: '홍길동' },
        createdAt: new Date('2026-01-01T00:00:00Z'),
      },
    ];
    qb.getRawMany.mockResolvedValue(rows);
    qb.getCount.mockResolvedValue(1);
    const service = new SubmissionsService(repoMock(qb) as never);
    const result = await service.list({ page: 1, limit: 20 });
    expect(result).toEqual({ items: rows, total: 1, page: 1, limit: 20 });
    expect(result.items[0].formName).toBe('신청폼');
  });

  it('select에 요구된 컬럼 별칭을 포함한다', async () => {
    const qb = queryBuilderMock();
    const service = new SubmissionsService(repoMock(qb) as never);
    await service.list({});
    expect(qb.select).toHaveBeenCalledWith(
      expect.arrayContaining([
        's.id AS id',
        's.form_id AS "formId"',
        'f.name AS "formName"',
        'f.campaign_id AS "campaignId"',
        's.channel AS channel',
        's.payload AS payload',
        's.created_at AS "createdAt"',
      ]),
    );
  });
});
