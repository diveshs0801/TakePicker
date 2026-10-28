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

  // --- Frontier Problem #09 Extensions ---

  @Get('hazard-attribution')
  async getHazardAttribution(@Param('assetId') assetId: string) {
    return this.timelineService.getDenseHazardAttribution(assetId);
  }

  @Get('causal-lift')
  async getCausalLift(
    @Param('assetId') assetId: string,
    @Query('subscribers') subscribers?: string,
    @Query('observedRetention') observed?: string
  ) {
    return this.timelineService.evaluateCausalTreatment(
      assetId,
      observed ? parseFloat(observed) : 78.4,
      subscribers ? parseInt(subscribers, 10) : 250000
    );
  }

  @Get('virtual-audience')
  async simulateVirtualAudience(@Param('assetId') assetId: string) {
    return this.timelineService.simulateAudienceTrajectory(assetId);
  }

  @Post('dpo-undo')
  async harvestDPOUndo(
    @Param('assetId') assetId: string,
    @Body()
    body: {
      undoneCut: { timestamp: number; action: string };
      humanCut: { timestamp: number; action: string };
      transcriptContext?: string;
    }
  ) {
    return this.timelineService.harvestDPOUndoEvent(
      assetId,
      body.undoneCut,
      body.humanCut,
      body.transcriptContext || ''
    );
  }

  @Get('creator-style')
  async getCreatorStyle(@Param('assetId') assetId: string) {
    return this.timelineService.getCreatorStyle(assetId);
  }

  @Post('protect-span')
  async protectSpan(
    @Param('assetId') assetId: string,
    @Body() body: any
  ) {
    return this.timelineService.protectCreativeSpan(assetId, body);
  }

  @Get('trimodal-cut')
  async optimizeTriModalCut(
    @Query('timestamp') timestamp: string,
    @Query('bpm') bpm?: string
  ) {
    return this.timelineService.optimizeCutToTriModalManifold(
      parseFloat(timestamp || '4.5'),
      bpm ? parseInt(bpm, 10) : 120
    );
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
