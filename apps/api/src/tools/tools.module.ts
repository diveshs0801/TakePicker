import { Module } from '@nestjs/common';
import { ToolsRegistry } from './tools.registry';
import { TimelineModule } from '../timeline/timeline.module';
import { AssetsModule } from '../assets/assets.module';
import { DatabaseModule } from '../database/database.module';
import { RendersModule } from '../renders/renders.module';

@Module({
  imports: [TimelineModule, AssetsModule, DatabaseModule, RendersModule],
  providers: [ToolsRegistry],
  exports: [ToolsRegistry],
})
export class ToolsModule {}
