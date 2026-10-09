import { NestFactory } from '@nestjs/core';
import { AppModule } from 'src/app.module';
import { DataSource } from 'typeorm';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);

  const dataSource = app.get(DataSource);

  console.log('Synchronizing schema...');
  await dataSource.synchronize();
  console.log('Schema synchronized');

  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
