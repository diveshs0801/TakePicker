import { Module } from '@nestjs/common';
import { ToolsRegistry } from './tools.registry';
import { TimelineModule } from '../timeline/timeline.module';
import { AssetsModule } from '../assets/assets.module';
import { DatabaseModule } from '../database/database.module';
import { RendersModule } from '../renders/renders.module';
import { ExportModule } from '../export/export.module';
import { CaptionsModule } from '../captions/captions.module';

@Module({
  imports: [TimelineModule, AssetsModule, DatabaseModule, RendersModule, ExportModule, CaptionsModule],
  providers: [ToolsRegistry],
  exports: [ToolsRegistry],
})
export class ToolsModule {}
