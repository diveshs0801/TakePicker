import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import IORedis from 'ioredis';
import { Queue, FlowProducer } from 'bullmq';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: IORedis;
  private subscriber: IORedis;
  private ingestQueue: Queue;
  private flowProducer: FlowProducer;

  onModuleInit() {
    const redisUrl = process.env.REDIS_URL || 'redis://redis:6379';
    this.client = new IORedis(redisUrl, { maxRetriesPerRequest: null });
    this.subscriber = new IORedis(redisUrl, { maxRetriesPerRequest: null });
    this.ingestQueue = new Queue('ingest', { connection: this.client });
    this.flowProducer = new FlowProducer({ connection: this.client });
  }

  async onModuleDestroy() {
    await this.ingestQueue.close();
    await this.flowProducer.close();
    await this.client.quit();
    await this.subscriber.quit();
  }

  getClient(): IORedis {
    return this.client;
  }

  getSubscriber(): IORedis {
    return this.subscriber;
  }

  getIngestQueue(): Queue {
    return this.ingestQueue;
  }

  getFlowProducer(): FlowProducer {
    return this.flowProducer;
  }
}
