import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { RedisModule } from './redis/redis.module';
import { WsModule } from './ws/ws.module';
import { AssetsModule } from './assets/assets.module';
import { RendersModule } from './renders/renders.module';
import { TimelineModule } from './timeline/timeline.module';
import { ToolsModule } from './tools/tools.module';
import { AgentModule } from './agent/agent.module';
import { UploadsModule } from './uploads/uploads.module';

import { ExportModule } from './export/export.module';

@Module({
  imports: [
    DatabaseModule,
    RedisModule,
    WsModule,
    AssetsModule,
    RendersModule,
    TimelineModule,
    ToolsModule,
    AgentModule,
    UploadsModule,
    ExportModule,
  ],
})
export class AppModule {}

