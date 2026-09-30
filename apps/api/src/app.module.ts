import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { RedisModule } from './redis/redis.module';
import { WsModule } from './ws/ws.module';
import { AssetsModule } from './assets/assets.module';
import { RendersModule } from './renders/renders.module';

@Module({
  imports: [
    DatabaseModule,
    RedisModule,
    WsModule,
    AssetsModule,
    RendersModule,
  ],
})
export class AppModule {}
