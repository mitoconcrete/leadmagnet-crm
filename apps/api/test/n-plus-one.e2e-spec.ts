import 'reflect-metadata';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { Campaign } from '../src/entities/campaign.entity';
import { HtmlTemplate } from '../src/entities/html-template.entity';
import { Form } from '../src/entities/form.entity';
import { DistributionLink } from '../src/entities/distribution-link.entity';
import { Visitor } from '../src/entities/visitor.entity';
import { Visit } from '../src/entities/visit.entity';
import { Submission } from '../src/entities/submission.entity';
import { createTestApp, truncateAll, seedOperator, loginAgent, countQueries, TestContext } from './utils';

/**
 * ADR 0017 N+1 회귀 방지: 목록·상세 엔드포인트가 데이터 규모(N)와 무관하게
 * 고정된 쿼리 수로 응답하는지 확인한다. 각 관리자 API 호출은 AuthGuard의
 * 세션 검증(sessions LEFT JOIN operators를 leftJoinAndSelect+getOne 단일 쿼리로,
 * ADR 0017 참고) 1개를 항상 포함하므로, 상한 비교 시 `AUTH_QUERY_COUNT(1)`을 더한다.
 */
const AUTH_QUERY_COUNT = 1;

/** 스펙에 명시된 "비즈니스 로직" 쿼리 상한(세션 검증 제외). 실제 단언은 +AUTH_QUERY_COUNT. */
const CAPS = {
  campaignsList: 1, // campaignRepo.find 1개
  campaignDetail: 2, // campaignRepo.findOne 1개 + formRepo.find(campaignId) 1개
  formsList: 1, // formRepo.find 1개
  formDetail: 2, // formRepo.findOne(relations:['links']) — TypeORM이 take:1+JOIN 조합에서 안전한 페이지네이션을 위해 id 조회 1개 + 본문 조회 1개로 나눈다
  submissionsList: 2, // getCount 1개 + getRawMany 1개
  analyticsCampaigns: 1, // GROUP BY 집계 1개
  analyticsChannels: 2, // visits GROUP BY 1개 + submissions GROUP BY 1개
  campaignStats: 3, // 존재 확인 1개 + visits GROUPING SETS 1개 + submissions GROUPING SETS 1개
} as const;

interface SeedResult {
  campaignId: string;
  formId: string;
}

/**
 * 캠페인 n개를 만든다. 각 캠페인은 폼 2개, 폼마다 링크 2개, 방문 3건(그 중 1건은 제출까지)을 가진다.
 * 첫 번째 캠페인/폼의 자식 수는 n과 무관하게 항상 동일해서, N=1과 N=5에서 그 캠페인/폼을 대상으로 한
 * 쿼리 수가 같아야 함을(= 다른 캠페인 존재가 쿼리 수에 영향을 주지 않음을) 검증할 수 있다.
 */
async function seedCampaigns(ctx: TestContext, n: number): Promise<SeedResult> {
  const templateRepo = ctx.ds.getRepository(HtmlTemplate);
  const campaignRepo = ctx.ds.getRepository(Campaign);
  const formRepo = ctx.ds.getRepository(Form);
  const linkRepo = ctx.ds.getRepository(DistributionLink);
  const visitorRepo = ctx.ds.getRepository(Visitor);
  const visitRepo = ctx.ds.getRepository(Visit);
  const submissionRepo = ctx.ds.getRepository(Submission);

  const template = await templateRepo.save(
    templateRepo.create({ name: 'N+1 템플릿', originalFilename: 'x.html', html: '<html></html>', sizeBytes: 10 }),
  );

  let firstCampaignId = '';
  let firstFormId = '';

  for (let c = 0; c < n; c++) {
    const campaign = await campaignRepo.save(campaignRepo.create({ name: `캠페인 ${c}` }));
    const channels = ['instagram', 'x'] as const;

    for (let f = 0; f < 2; f++) {
      const form = await formRepo.save(
        formRepo.create({
          campaignId: campaign.id,
          templateId: template.id,
          name: `폼 ${c}-${f}`,
          slug: `slug-${randomUUID()}`,
        }),
      );

      if (c === 0 && f === 0) {
        firstCampaignId = campaign.id;
        firstFormId = form.id;
      }

      for (const channel of channels) {
        await linkRepo.save(linkRepo.create({ formId: form.id, channel, code: randomUUID().slice(0, 12) }));
      }

      for (let v = 0; v < 3; v++) {
        const visitor = await visitorRepo.save(visitorRepo.create({ lastSeenAt: new Date() }));
        const visit = await visitRepo.save(
          visitRepo.create({ formId: form.id, visitorId: visitor.id, linkId: null, channel: 'direct' }),
        );
        if (v === 0) {
          await submissionRepo.save(
            submissionRepo.create({
              formId: form.id,
              visitId: visit.id,
              visitorId: visitor.id,
              linkId: null,
              channel: 'direct',
              payload: { name: `제출자 ${c}-${f}-${v}` },
            }),
          );
        }
      }
    }
  }

  return { campaignId: firstCampaignId, formId: firstFormId };
}

interface Measured {
  campaignsList: number;
  campaignDetail: number;
  formsList: number;
  formDetail: number;
  submissionsList: number;
  analyticsCampaigns: number;
  analyticsChannels: number;
  campaignStats: number;
}

async function measure(ctx: TestContext, agent: request.SuperAgentTest, seed: SeedResult): Promise<Measured> {
  const run = async (label: string, url: string): Promise<number> => {
    const { result, count } = await countQueries(ctx.ds, () => agent.get(url));
    expect(result.status).toBeLessThan(400);
    return count;
  };

  return {
    campaignsList: await run('campaignsList', '/api/admin/campaigns'),
    campaignDetail: await run('campaignDetail', `/api/admin/campaigns/${seed.campaignId}`),
    formsList: await run('formsList', `/api/admin/forms?campaignId=${seed.campaignId}`),
    formDetail: await run('formDetail', `/api/admin/forms/${seed.formId}`),
    submissionsList: await run('submissionsList', `/api/admin/submissions?campaignId=${seed.campaignId}`),
    analyticsCampaigns: await run('analyticsCampaigns', '/api/admin/analytics/campaigns'),
    analyticsChannels: await run('analyticsChannels', '/api/admin/analytics/channels'),
    campaignStats: await run('campaignStats', `/api/admin/campaigns/${seed.campaignId}/stats`),
  };
}

describe('N+1 회귀 방지 (ADR 0017) e2e', () => {
  let ctx: TestContext;
  let agent: request.SuperAgentTest;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  async function freshAgent(): Promise<request.SuperAgentTest> {
    await truncateAll(ctx.ds);
    await seedOperator(ctx.ds);
    const { agent: loggedIn } = await loginAgent(ctx);
    return loggedIn;
  }

  it('목록·상세 엔드포인트 쿼리 수는 캠페인 1개일 때와 5개일 때가 같고, 각 상한(+세션 검증 1) 이내다', async () => {
    agent = await freshAgent();
    const seedWithOne = await seedCampaigns(ctx, 1);
    const withOne = await measure(ctx, agent, seedWithOne);

    agent = await freshAgent();
    const seedWithFive = await seedCampaigns(ctx, 5);
    const withFive = await measure(ctx, agent, seedWithFive);

    (Object.keys(CAPS) as Array<keyof typeof CAPS>).forEach((key) => {
      const cap = CAPS[key] + AUTH_QUERY_COUNT;
      expect(withFive[key]).toBe(withOne[key]);
      expect(withOne[key]).toBeLessThanOrEqual(cap);
      expect(withFive[key]).toBeLessThanOrEqual(cap);
    });
  });
});
