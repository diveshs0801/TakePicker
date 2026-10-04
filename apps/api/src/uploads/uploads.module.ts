import { Module } from '@nestjs/common';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';
import { LocalStorage } from './storage/local.storage';
import { DatabaseModule } from '../database/database.module';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [DatabaseModule, RedisModule],
  controllers: [UploadsController],
  providers: [UploadsService, LocalStorage],
  exports: [UploadsService, LocalStorage],
})
export class UploadsModule {}
