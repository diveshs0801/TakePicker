import { Module } from '@nestjs/common';
import { RendersController } from './renders.controller';
import { RendersService } from './renders.service';
import { AssetsModule } from '../assets/assets.module';

@Module({
  imports: [AssetsModule],
  controllers: [RendersController],
  providers: [RendersService],
  exports: [RendersService],
})
export class RendersModule {}
