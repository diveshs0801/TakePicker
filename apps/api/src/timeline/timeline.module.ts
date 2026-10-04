import { Module } from '@nestjs/common';
import { TimelineService } from './timeline.service';
import { DatabaseModule } from '../database/database.module';
import { WsModule } from '../ws/ws.module';
import { AssetsModule } from '../assets/assets.module';

@Module({
  imports: [DatabaseModule, WsModule, AssetsModule],
  providers: [TimelineService],
  exports: [TimelineService],
})
export class TimelineModule {}
