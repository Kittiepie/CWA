import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ServerErrorValues } from './common/lib/errors/ApiErrorValues';

@Injectable()
export class AppService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) { }

  async healthCheck(): Promise<ServerErrorValues | 'ERR_UNKNOWN' | null> {
    try {
      // Test DB connection
      const dbCheck: Array<{ result: number }> = await this.dataSource.query(
        'SELECT 1+1 AS result',
      );
      if (dbCheck[0].result !== 2) {
        return 'ERR_UNABLE_TO_CONNECT_DB';
      }

      return null;
    } catch {
      return 'ERR_UNKNOWN';
    }
  }
}
