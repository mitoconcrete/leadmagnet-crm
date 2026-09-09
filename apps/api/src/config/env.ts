export interface Env {
  port: number;
  databaseUrl: string;
  adminEmail: string;
  adminPassword: string;
  sessionTtlSeconds: number;
  publicBaseUrl: string;
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const databaseUrl = source.DATABASE_URL;
  if (!databaseUrl && source.DOCS_ONLY !== '1') throw new Error('DATABASE_URL is required');
  return {
    port: Number(source.PORT ?? 3001),
    databaseUrl: databaseUrl ?? '',
    adminEmail: source.ADMIN_EMAIL ?? 'admin@example.com',
    adminPassword: source.ADMIN_PASSWORD ?? 'admin1234',
    sessionTtlSeconds: Number(source.SESSION_TTL_SECONDS ?? 604800),
    publicBaseUrl: (source.PUBLIC_BASE_URL ?? 'http://localhost:3001').replace(/\/$/, ''),
  };
}
