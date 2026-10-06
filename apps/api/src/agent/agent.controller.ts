import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { AgentService } from './agent.service';
import { TimelineService } from '../timeline/timeline.service';

@Controller()
export class AgentController {
  constructor(
    private readonly agentService: AgentService,
    private readonly timelineService: TimelineService
  ) {}

  @Get('agent/providers')
  getProviders() {
    return {
      active: this.agentService.getActiveProvider(),
      providers: this.agentService.getAvailableProviders(),
    };
  }

  @Post('assets/:id/agent')
  async startAgentRun(
    @Param('id') assetId: string,
    @Body() body: { message: string; model?: string; maxSteps?: number; provider?: string }
  ) {
    if (!body?.message) {
      throw new BadRequestException('Field "message" is required');
    }
    const run = await this.agentService.runAgent(assetId, body.message, {
      model: body.model,
      maxSteps: body.maxSteps,
      provider: body.provider,
    });
    return {
      runId: run.id,
      status: run.status,
      model: run.model,
      provider: run.provider,
      tokensIn: run.tokensIn,
      tokensOut: run.tokensOut,
      stepsCount: run.steps.length,
      steps: run.steps,
    };
  }

  @Get('agent-runs/:id')
  async getAgentRun(@Param('id') runId: string) {
    return await this.agentService.getRun(runId);
  }

  @Post('agent-runs/:id/cancel')
  async cancelAgentRun(@Param('id') runId: string) {
    return await this.agentService.cancelRun(runId);
  }

  @Get('assets/:id/ops')
  async getTimelineOps(
    @Param('id') assetId: string,
    @Query('since') since?: string
  ) {
    const sinceSeq = since ? parseInt(since, 10) : 0;
    const ops = await this.timelineService.getOpsLog(assetId, sinceSeq);
    return { assetId, sinceSeq, ops };
  }

  @Post('assets/:id/undo')
  async undoLastOp(@Param('id') assetId: string) {
    const res = await this.timelineService.undo(assetId, 'user');
    return {
      assetId,
      seq: res.seq,
      undoneOp: res.op,
      timeline: res.timeline,
    };
  }

  @Get('assets/:id/silences')
  async getSilences(
    @Param('id') assetId: string,
    @Query('minSilence') minSilence?: string,
    @Query('buffer') buffer?: string
  ) {
    const minSilenceSec = minSilence ? parseFloat(minSilence) : 0.6;
    const bufferSec = buffer ? parseFloat(buffer) : 0.1;
    return await this.timelineService.getSilences(assetId, { minSilenceSec, bufferSec });
  }

  @Post('assets/:id/jump-cut')
  async applyJumpCut(
    @Param('id') assetId: string,
    @Body() body?: { minSilenceSec?: number; bufferSec?: number }
  ) {
    return await this.timelineService.jumpCut(
      assetId,
      {
        minSilenceSec: body?.minSilenceSec ?? 0.6,
        bufferSec: body?.bufferSec ?? 0.1,
      },
      'user'
    );
  }
}

