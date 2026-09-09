import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { createDataSourceOptions } from './data-source';
import { loadEnv } from './config/env';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        ...createDataSourceOptions(loadEnv().databaseUrl),
        autoLoadEntities: true,
      }),
    }),
  ],
})
export class DatabaseModule {}
