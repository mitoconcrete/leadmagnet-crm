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

  async campaignStats(campaignId: string): Promise<CampaignStats> {
    const [totals] = await this.dataSource.query(
      `SELECT COUNT(*)::int AS visits, COUNT(DISTINCT v.visitor_id)::int AS visitors
       FROM visits v JOIN forms f ON f.id = v.form_id WHERE f.campaign_id = $1`,
      [campaignId],
    );
    const [submissionTotals] = await this.dataSource.query(
      `SELECT COUNT(*)::int AS submissions
       FROM submissions s JOIN forms f ON f.id = s.form_id WHERE f.campaign_id = $1`,
      [campaignId],
    );
    const channelVisitRows = await this.dataSource.query(
      `SELECT v.channel AS channel, COUNT(*)::int AS visits, COUNT(DISTINCT v.visitor_id)::int AS visitors
       FROM visits v JOIN forms f ON f.id = v.form_id WHERE f.campaign_id = $1 GROUP BY v.channel`,
      [campaignId],
    );
    const channelSubmissionRows = await this.dataSource.query(
      `SELECT s.channel AS channel, COUNT(*)::int AS submissions
       FROM submissions s JOIN forms f ON f.id = s.form_id WHERE f.campaign_id = $1 GROUP BY s.channel`,
      [campaignId],
    );

    const visits = Number(totals?.visits ?? 0);
    const visitors = Number(totals?.visitors ?? 0);
    const submissions = Number(submissionTotals?.submissions ?? 0);

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
