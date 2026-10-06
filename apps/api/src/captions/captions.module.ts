import { Module } from '@nestjs/common';
import { CaptionsController } from './captions.controller';
import { CaptionsService } from './captions.service';
import { AssetsModule } from '../assets/assets.module';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [AssetsModule, DatabaseModule],
  controllers: [CaptionsController],
  providers: [CaptionsService],
  exports: [CaptionsService],
})
export class CaptionsModule {}
