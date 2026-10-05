import { Module } from '@nestjs/common';
import { ExportController } from './export.controller';
import { ExportService } from './export.service';
import { AssetsModule } from '../assets/assets.module';
import { TimelineModule } from '../timeline/timeline.module';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [AssetsModule, TimelineModule, DatabaseModule],
  controllers: [ExportController],
  providers: [ExportService],
  exports: [ExportService],
})
export class ExportModule {}
