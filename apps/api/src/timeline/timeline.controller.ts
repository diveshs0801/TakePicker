import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { TimelineService } from './timeline.service';
import { TimelineVersionService } from './timeline-version.service';
import { ConflictResolutionStrategy, BrandKitConfig } from '../../../../packages/contracts';

@Controller('assets/:assetId/timeline')
export class TimelineController {
  constructor(
    private readonly timelineService: TimelineService,
    private readonly versionService: TimelineVersionService
  ) {}

  @Get()
  async getTimeline(@Param('assetId') assetId: string) {
    return this.timelineService.getTimelineAt(assetId);
  }

  @Get('lint')
  async lintTimeline(@Param('assetId') assetId: string) {
    return this.timelineService.lintTimeline(assetId);
  }

  @Post('repair')
  async autoRepairTimeline(
    @Param('assetId') assetId: string,
    @Body() body?: { actor?: 'user' | 'agent' }
  ) {
    return this.timelineService.autoRepairTimeline(assetId, body?.actor || 'user');
  }

  @Get('aesthetics')
  async getAesthetics(
    @Param('assetId') assetId: string,
    @Query('brandId') brandId?: string
  ) {
    return this.timelineService.evaluateAesthetics(assetId);
  }

  @Get('telemetry')
  async getTelemetry(
    @Param('assetId') assetId: string,
    @Query('platform') platform?: 'tiktok' | 'youtube_shorts' | 'instagram_reels'
  ) {
    return this.timelineService.processEngagementTelemetry(assetId, platform || 'tiktok');
  }

  @Get('rl-state')
  async getRLState(@Param('assetId') assetId: string) {
    return this.timelineService.getRLState();
  }

  // --- Version Control Endpoints (Problem #10) ---

  @Get('branches')
  async listBranches(@Param('assetId') assetId: string) {
    const { timeline } = await this.timelineService.getTimelineAt(assetId);
    this.versionService.ensureMainBranch(assetId, timeline);
    return this.versionService.listBranches(assetId);
  }

  @Post('branches')
  async createBranch(
    @Param('assetId') assetId: string,
    @Body() body: { name: string; author: string; description?: string; fromBranch?: string }
  ) {
    const { timeline } = await this.timelineService.getTimelineAt(assetId);
    this.versionService.ensureMainBranch(assetId, timeline);
    return this.versionService.createBranch(
      assetId,
      body.name,
      body.author,
      body.description,
      body.fromBranch || 'main'
    );
  }

  @Post('merge')
  async mergeBranches(
    @Param('assetId') assetId: string,
    @Body()
    body: {
      sourceBranch: string;
      targetBranch?: string;
      strategy?: ConflictResolutionStrategy;
    }
  ) {
    return this.versionService.mergeBranches(
      assetId,
      body.sourceBranch,
      body.targetBranch || 'main',
      body.strategy || 'SPLIT_AUDITION_LANES'
    );
  }
}
