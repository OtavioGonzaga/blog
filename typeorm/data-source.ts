import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { Logger } from '@nestjs/common';
dotenv.config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: +process.env.DB_PORT,
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/../typeorm/migrations/*{.ts,.js}'],
});

AppDataSource.initialize().catch((err) => {
  Logger.error('Error during Data Source initialization:\n', err);
});
