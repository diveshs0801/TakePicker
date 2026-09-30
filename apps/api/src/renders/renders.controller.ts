import { Controller, Get, Post, Param, Body } from '@nestjs/common';
import { RendersService } from './renders.service';
import type { Timeline } from '../../../../packages/contracts';

@Controller()
export class RendersController {
  constructor(private readonly rendersService: RendersService) {}

  @Post('assets/:assetId/renders')
  async createRender(
    @Param('assetId') assetId: string,
    @Body() body: { timeline?: Timeline }
  ) {
    return this.rendersService.createRender(assetId, body?.timeline);
  }

  @Get('renders/:id')
  async getRender(@Param('id') id: string) {
    return this.rendersService.getRender(id);
  }
}
