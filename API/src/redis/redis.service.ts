import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, type RedisClientType } from 'redis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly client: RedisClientType;

  constructor(private readonly config: ConfigService) {
    this.client = createClient({
      socket: {
        host: this.config.get<string>('REDIS_HOST', 'localhost'),
        port: this.config.get<number>('REDIS_PORT', 6379),
      },
      password: this.config.get<string>('REDIS_PASSWORD') || undefined,
      database: this.config.get<number>('REDIS_DB', 0),
    });

    this.client.on('error', (error) => {
      console.error('Redis client error', error);
    });
  }

  async onModuleInit(): Promise<void> {
    await this.client.connect();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client.isOpen) {
      await this.client.quit();
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const value = await this.client.get(key);
    return value ? (JSON.parse(value) as T) : null;
  }

  async set<T>(key: string, value: T): Promise<void> {
    await this.client.set(key, JSON.stringify(value));
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async exists(key: string): Promise<boolean> {
    return (await this.client.exists(key)) === 1;
  }

  async sAdd(key: string, value: string): Promise<void> {
    await this.client.sAdd(key, value);
  }

  async sIsMember(key: string, value: string): Promise<boolean> {
    return (await this.client.sIsMember(key, value)) === 1;
  }

  async hSet(
    key: string,
    values: Record<string, string | number | boolean>,
  ): Promise<void> {
    const stringifiedValues: Record<string, string> = Object.fromEntries(
      Object.entries(values).map(([key, value]) => [key, String(value)]),
    );
    await this.client.hSet(key, stringifiedValues);
  }

  async hGetAll<T>(key: string): Promise<T | null> {
    const values = await this.client.hGetAll(key);
    return values ? (JSON.parse(JSON.stringify(values)) as T) : null;
  }

  async sRem(key: string, value: string): Promise<void> {
    await this.client.sRem(key, value);
  }

  async sMembers(key: string): Promise<string[]> {
    return await this.client.sMembers(key);
  }

  /** Every key matching `pattern`, gathered over a non-blocking SCAN. */
  async scanKeys(pattern: string): Promise<string[]> {
    const found: string[] = [];
    for await (const keys of this.client.scanIterator({
      MATCH: pattern,
      COUNT: 100,
    })) {
      found.push(...keys);
    }
    return found;
  }

  async expire(key: string, seconds: number): Promise<void> {
    await this.client.expire(key, seconds);
  }

  async subscribe(
    channel: string,
    handler: (message: string) => void,
  ): Promise<void> {
    // A client used for regular commands can't also block on subscriptions
    // in redis v4, so subscriptions get their own connection.
    const subscriber = this.client.duplicate();
    subscriber.on('error', (error) => {
      console.error(`Redis subscriber error (${channel})`, error);
    });
    await subscriber.connect();
    await subscriber.subscribe(channel, handler);
  }
}
