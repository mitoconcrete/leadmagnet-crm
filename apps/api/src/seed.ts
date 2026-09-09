import 'reflect-metadata';
import * as bcrypt from 'bcryptjs';
import { DataSource } from 'typeorm';
import { Operator } from './entities';
import { AppDataSource } from './data-source';
import { loadEnv } from './config/env';

/** ADR 0020(부분 채택): 시드 계정은 항상 role=admin, isActive=true다. */
export async function runSeed(ds: DataSource, opts: { email: string; password: string }): Promise<Operator> {
  const repo = ds.getRepository(Operator);
  const passwordHash = await bcrypt.hash(opts.password, 10);
  const existing = await repo.findOne({ where: { email: opts.email } });
  if (existing) {
    existing.passwordHash = passwordHash;
    existing.role = 'admin';
    existing.isActive = true;
    await repo.save(existing);
    return existing;
  }
  return repo.save(repo.create({ email: opts.email, passwordHash, role: 'admin', isActive: true }));
}

if (require.main === module) {
  const env = loadEnv();
  AppDataSource.initialize().then(async (ds) => {
    await runSeed(ds, { email: env.adminEmail, password: env.adminPassword });
    await ds.destroy();
    console.log(`seeded operator ${env.adminEmail}`);
  });
}
