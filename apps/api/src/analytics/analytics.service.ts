import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { STAT_CHANNELS, StatChannel } from '../entities/channel';
import { conversionRate } from './conversion';

export interface ChannelStat {
  channel: StatChannel;
  visits: number;
  visitors: number;
  submissions: number;
  conversionRate: number;
}

export interface ChannelAggregateRow {
  channel: string;
  visits: number | string;
  visitors: number | string;
  submissions: number | string;
}

export interface CampaignStats {
  campaignId: string;
  visits: number;
  visitors: number;
  submissions: number;
  conversionRate: number;
  channels: ChannelStat[];
}

export interface CampaignRow {
  campaignId: string;
  name: string;
  status: string;
  visits: number;
  visitors: number;
  submissions: number;
  conversionRate: number;
}

export function mergeChannelStats(rows: Array<Partial<ChannelAggregateRow> & { channel: string }>): ChannelStat[] {
  const byChannel = new Map(rows.map((row) => [row.channel, row]));
  return STAT_CHANNELS.map((channel) => {
    const row = byChannel.get(channel);
    const visits = row?.visits !== undefined ? Number(row.visits) : 0;
    const visitors = row?.visitors !== undefined ? Number(row.visitors) : 0;
    const submissions = row?.submissions !== undefined ? Number(row.submissions) : 0;
    return { channel, visits, visitors, submissions, conversionRate: conversionRate(submissions, visitors) };
  });
}

function combineChannelRows(
  visitRows: Array<{ channel: string; visits: number | string; visitors: number | string }>,
  submissionRows: Array<{ channel: string; submissions: number | string }>,
): Array<{ channel: string; visits: number; visitors: number; submissions: number }> {
  const map = new Map<string, { channel: string; visits: number; visitors: number; submissions: number }>();
  for (const row of visitRows) {
    map.set(row.channel, {
      channel: row.channel,
      visits: Number(row.visits),
      visitors: Number(row.visitors),
      submissions: 0,
    });
  }
  for (const row of submissionRows) {
    const existing = map.get(row.channel) ?? { channel: row.channel, visits: 0, visitors: 0, submissions: 0 };
    existing.submissions = Number(row.submissions);
    map.set(row.channel, existing);
  }
  return [...map.values()];
}

@Injectable()
export class AnalyticsService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async channelStats(): Promise<ChannelStat[]> {
    const visitRows = await this.dataSource.query(
      `SELECT channel, COUNT(*)::int AS visits, COUNT(DISTINCT visitor_id)::int AS visitors FROM visits GROUP BY channel`,
    );
    const submissionRows = await this.dataSource.query(
      `SELECT channel, COUNT(*)::int AS submissions FROM submissions GROUP BY channel`,
    );
    return mergeChannelStats(combineChannelRows(visitRows, submissionRows));
  }

  /**
   * ADR 0017: 채널별 집계와 캠페인 총계를 각각 따로 조회하면 쿼리 4개가 나간다.
   * `GROUP BY GROUPING SETS ((channel), ())`로 채널별 행과 총계 행(channel=NULL)을
   * 한 쿼리에서 함께 얻는다. 총계 행은 COALESCE로 '__total__' 표식을 붙여 구분한다.
   * (총 방문자 수는 채널별 distinct 합과 다를 수 있어 — 한 방문자가 여러 채널로
   * 유입될 수 있다 — 반드시 GROUPING SETS의 전체 그룹에서 따로 집계해야 한다.)
   */
  async campaignStats(campaignId: string): Promise<CampaignStats> {
    const visitRows = await this.dataSource.query(
      `SELECT COALESCE(v.channel, '__total__') AS channel,
              COUNT(DISTINCT v.id)::int AS visits,
              COUNT(DISTINCT v.visitor_id)::int AS visitors
       FROM visits v JOIN forms f ON f.id = v.form_id
       WHERE f.campaign_id = $1
       GROUP BY GROUPING SETS ((v.channel), ())`,
      [campaignId],
    );
    const submissionRows = await this.dataSource.query(
      `SELECT COALESCE(s.channel, '__total__') AS channel,
              COUNT(DISTINCT s.id)::int AS submissions
       FROM submissions s JOIN forms f ON f.id = s.form_id
       WHERE f.campaign_id = $1
       GROUP BY GROUPING SETS ((s.channel), ())`,
      [campaignId],
    );

    const totalVisitRow = visitRows.find((row: { channel: string }) => row.channel === '__total__');
    const totalSubmissionRow = submissionRows.find((row: { channel: string }) => row.channel === '__total__');
    const channelVisitRows = visitRows.filter((row: { channel: string }) => row.channel !== '__total__');
    const channelSubmissionRows = submissionRows.filter((row: { channel: string }) => row.channel !== '__total__');

    const visits = Number(totalVisitRow?.visits ?? 0);
    const visitors = Number(totalVisitRow?.visitors ?? 0);
    const submissions = Number(totalSubmissionRow?.submissions ?? 0);

    return {
      campaignId,
      visits,
      visitors,
      submissions,
      conversionRate: conversionRate(submissions, visitors),
      channels: mergeChannelStats(combineChannelRows(channelVisitRows, channelSubmissionRows)),
    };
  }

  async campaignList(): Promise<CampaignRow[]> {
    const rows = await this.dataSource.query(
      `SELECT c.id AS "campaignId", c.name AS name, c.status AS status,
              COUNT(DISTINCT v.id)::int AS visits,
              COUNT(DISTINCT v.visitor_id)::int AS visitors,
              COUNT(DISTINCT s.id)::int AS submissions
       FROM campaigns c
       LEFT JOIN forms f ON f.campaign_id = c.id
       LEFT JOIN visits v ON v.form_id = f.id
       LEFT JOIN submissions s ON s.form_id = f.id
       GROUP BY c.id, c.name, c.status
       ORDER BY c.created_at DESC`,
    );
    return rows.map((row: CampaignRow) => ({
      campaignId: row.campaignId,
      name: row.name,
      status: row.status,
      visits: Number(row.visits),
      visitors: Number(row.visitors),
      submissions: Number(row.submissions),
      conversionRate: conversionRate(Number(row.submissions), Number(row.visitors)),
    }));
  }
}
