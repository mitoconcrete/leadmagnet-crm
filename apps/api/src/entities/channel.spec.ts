import { CHANNELS, STAT_CHANNELS, isChannel } from './channel';

describe('channel', () => {
  it('4개 채널과 direct 포함 5개 집계 채널', () => {
    expect(CHANNELS).toEqual(['instagram', 'x', 'youtube', 'threads']);
    expect(STAT_CHANNELS).toEqual(['direct', 'instagram', 'x', 'youtube', 'threads']);
  });
  it('isChannel', () => {
    expect(isChannel('x')).toBe(true);
    expect(isChannel('tiktok')).toBe(false);
  });
});
