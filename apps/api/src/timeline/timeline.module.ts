import { Module } from '@nestjs/common';
import { TimelineService } from './timeline.service';
import { TimelineVersionService } from './timeline-version.service';
import { TimelineController } from './timeline.controller';
import { DatabaseModule } from '../database/database.module';
import { WsModule } from '../ws/ws.module';
import { AssetsModule } from '../assets/assets.module';

@Module({
  imports: [DatabaseModule, WsModule, AssetsModule],
  controllers: [TimelineController],
  providers: [TimelineService, TimelineVersionService],
  exports: [TimelineService, TimelineVersionService],
})
export class TimelineModule {}
