import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AssetsService } from './assets.service';

@Controller('assets')
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Get()
  async list() {
    return this.assetsService.listAssets();
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async upload(@UploadedFile() file: Express.Multer.File) {
    return this.assetsService.createAsset(file);
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    return this.assetsService.getAsset(id);
  }

  @Get(':id/transcript')
  async getTranscript(@Param('id') id: string) {
    return this.assetsService.getTranscript(id);
  }

  @Get(':id/takes')
  async getTakes(@Param('id') id: string) {
    return this.assetsService.getTakes(id);
  }

  @Patch('take-groups/:groupId')
  async updateTakeGroup(
    @Param('groupId') groupId: string,
    @Body() body: { chosenSegmentId: string }
  ) {
    return this.assetsService.updateTakeGroup(groupId, body.chosenSegmentId);
  }

  @Get(':id/timeline')
  async getTimeline(@Param('id') id: string) {
    return this.assetsService.getTimeline(id);
  }
}
