export const CHANNELS = ['instagram', 'x', 'youtube', 'threads'] as const;
export type Channel = (typeof CHANNELS)[number];
export const STAT_CHANNELS = ['direct', ...CHANNELS] as const;
export type StatChannel = (typeof STAT_CHANNELS)[number];
export function isChannel(v: unknown): v is Channel {
  return typeof v === 'string' && (CHANNELS as readonly string[]).includes(v);
}
