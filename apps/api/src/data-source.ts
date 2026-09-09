import 'reflect-metadata';
import { DataSource, DataSourceOptions } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { entities } from './entities';

export function createDataSourceOptions(url: string): DataSourceOptions {
  return {
    type: 'postgres',
    url,
    entities,
    migrations: [__dirname + '/migrations/*.{ts,js}'],
    namingStrategy: new SnakeNamingStrategy(),
    synchronize: false,
    logging: false,
  };
}

export const AppDataSource = new DataSource(createDataSourceOptions(process.env.DATABASE_URL ?? ''));
