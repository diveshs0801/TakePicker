import { Module } from '@nestjs/common';
import { AgentService } from './agent.service';
import { AgentController } from './agent.controller';
import { DatabaseModule } from '../database/database.module';
import { WsModule } from '../ws/ws.module';
import { TimelineModule } from '../timeline/timeline.module';
import { ToolsModule } from '../tools/tools.module';

@Module({
  imports: [DatabaseModule, WsModule, TimelineModule, ToolsModule],
  controllers: [AgentController],
  providers: [AgentService],
  exports: [AgentService],
})
export class AgentModule {}
