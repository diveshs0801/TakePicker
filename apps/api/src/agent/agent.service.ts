import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { EventsGateway } from '../ws/events.gateway';
import { TimelineService } from '../timeline/timeline.service';
import { ToolsRegistry } from '../tools/tools.registry';
import { LLMClient, LLMMessage } from './llm-client.interface';
import { DeterministicMockLLMClient } from './llm-client.mock';
import {
  createLLMClientFromEnv,
  ResolvedClientInfo,
  listAvailableProviders,
} from './llm-providers';
import { AGENT_SYSTEM_PROMPT, buildTimelineContextSummary } from './agent.prompts';
import {
  AgentRun,
  AgentStep,
  AgentToolCallRecord,
  AgentRunStatus,
} from '../../../../packages/contracts';
import { randomUUID } from 'node:crypto';

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);
  private llmClient: LLMClient;
  private activeProviderInfo: ResolvedClientInfo;

  constructor(
    private readonly db: DatabaseService,
    private readonly wsGateway: EventsGateway,
    private readonly timelineService: TimelineService,
    private readonly toolsRegistry: ToolsRegistry
  ) {
    this.activeProviderInfo = createLLMClientFromEnv();
    this.llmClient = this.activeProviderInfo.client;

    if (this.activeProviderInfo.isReal) {
      this.logger.log(
        `[AgentService] 🚀 Live LLM initialized with provider "${this.activeProviderInfo.provider}" (model: ${this.activeProviderInfo.model})`
      );
    } else {
      this.logger.log(
        `[AgentService] ℹ️ Running with DeterministicMockLLMClient. Set DEEPSEEK_API_KEY, GROQ_API_KEY, or LLM_API_KEY to activate live AI inference.`
      );
    }
  }

  getActiveProvider(): ResolvedClientInfo {
    return this.activeProviderInfo;
  }

  getAvailableProviders() {
    return listAvailableProviders();
  }

  setLLMClient(client: LLMClient) {
    this.llmClient = client;
  }

  async runAgent(
    assetId: string,
    prompt: string,
    options?: { maxSteps?: number; model?: string; provider?: string }
  ): Promise<AgentRun & { provider?: string }> {
    const runId = randomUUID();
    const model = options?.model || this.activeProviderInfo.model || 'takepicker-agent-v1';
    const maxSteps = options?.maxSteps || 8;

    // Use custom client if caller specifies an alternate provider
    let runnerClient = this.llmClient;
    if (options?.provider) {
      const custom = createLLMClientFromEnv({
        provider: options.provider,
        model: options.model,
      });
      runnerClient = custom.client;
    }

    // 1. Create run record in database
    await this.db.query(
      `INSERT INTO agent_runs (id, asset_id, prompt, status, steps, model, tokens_in, tokens_out, started_at)
       VALUES ($1, $2, $3, 'RUNNING', '[]'::jsonb, $4, 0, 0, NOW())`,
      [runId, assetId, prompt, model]
    );

    this.wsGateway.emitToAsset(assetId, 'agent:run_started', {
      runId,
      assetId,
      prompt,
      model,
      provider: this.activeProviderInfo.provider,
    });

    // 2. Build compact context
    const { timeline, currentSeq } = await this.timelineService.getTimelineAt(assetId);
    const contextSummary = buildTimelineContextSummary(timeline, currentSeq);

    const messages: LLMMessage[] = [
      { role: 'system', content: `${AGENT_SYSTEM_PROMPT}\n\n${contextSummary}` },
      { role: 'user', content: prompt },
    ];

    let stepCount = 0;
    let totalTokensIn = 0;
    let totalTokensOut = 0;
    const recordedSteps: AgentStep[] = [];
    const failedCallsCount = new Map<string, number>();
    let runStatus: AgentRunStatus = 'DONE';

    try {
      while (stepCount < maxSteps) {
        stepCount++;

        const response = await runnerClient.chat({
          messages,
          tools: this.toolsRegistry.getToolSchemasForLLM(),
          temperature: 0,
          model,
        });

        if (response.usage) {
          totalTokensIn += response.usage.prompt_tokens;
          totalTokensOut += response.usage.completion_tokens;
        }

        const assistantMsg = response.message;
        messages.push(assistantMsg);

        const currentStepRecord: AgentStep = {
          step: stepCount,
          thought: assistantMsg.content || undefined,
          toolCalls: [],
          response: assistantMsg.content || undefined,
        };

        const toolCalls = assistantMsg.tool_calls || [];

        // If no tool calls, model gave final answer
        if (toolCalls.length === 0) {
          recordedSteps.push(currentStepRecord);
          this.wsGateway.emitToAsset(assetId, 'agent:message', {
            runId,
            step: stepCount,
            message: assistantMsg.content,
          });
          break;
        }

        // Execute tool calls
        let hasNoProgressViolation = false;

        for (const tc of toolCalls) {
          const fnName = tc.function.name;
          let parsedArgs: any = {};
          try {
            parsedArgs = JSON.parse(tc.function.arguments || '{}');
          } catch (e) {
            parsedArgs = {};
          }

          const callSignature = `${fnName}:${tc.function.arguments}`;
          const prevFailures = failedCallsCount.get(callSignature) || 0;
          if (prevFailures >= 2) {
            hasNoProgressViolation = true;
            this.logger.warn(`Aborting loop: identical failing tool call repeated: ${callSignature}`);
            break;
          }

          this.wsGateway.emitToAsset(assetId, 'agent:tool_call', {
            runId,
            step: stepCount,
            toolCallId: tc.id,
            tool: fnName,
            args: parsedArgs,
          });

          // Fetch current sequence number for optimistic concurrency
          const { currentSeq: latestSeq } = await this.timelineService.getTimelineAt(assetId);

          const result = await this.toolsRegistry.executeTool(fnName, parsedArgs, {
            assetId,
            actor: 'agent',
            agentRunId: runId,
            baseSeq: latestSeq,
          });

          if (!result.ok) {
            failedCallsCount.set(callSignature, prevFailures + 1);
          }

          const toolRecord: AgentToolCallRecord = {
            id: tc.id,
            name: fnName,
            args: parsedArgs,
            result,
          };
          currentStepRecord.toolCalls.push(toolRecord);

          this.wsGateway.emitToAsset(assetId, 'agent:tool_result', {
            runId,
            step: stepCount,
            toolCallId: tc.id,
            tool: fnName,
            result,
          });

          // Append tool result into LLM message history
          messages.push({
            role: 'tool',
            tool_call_id: tc.id,
            name: fnName,
            content: JSON.stringify(result),
          });
        }

        recordedSteps.push(currentStepRecord);

        if (hasNoProgressViolation) {
          runStatus = 'FAILED';
          break;
        }
      }
    } catch (err: any) {
      this.logger.error(`Error during agent execution: ${err.message}`, err.stack);
      runStatus = 'FAILED';
    }

    // 3. Finalize run in DB
    await this.db.query(
      `UPDATE agent_runs
       SET status = $1, steps = $2, tokens_in = $3, tokens_out = $4, finished_at = NOW()
       WHERE id = $5`,
      [runStatus, JSON.stringify(recordedSteps), totalTokensIn, totalTokensOut, runId]
    );

    this.wsGateway.emitToAsset(assetId, 'agent:run_done', {
      runId,
      assetId,
      status: runStatus,
      stepsCount: recordedSteps.length,
      tokensIn: totalTokensIn,
      tokensOut: totalTokensOut,
    });

    return {
      id: runId,
      assetId,
      prompt,
      status: runStatus,
      steps: recordedSteps,
      model,
      provider: this.activeProviderInfo.provider,
      tokensIn: totalTokensIn,
      tokensOut: totalTokensOut,
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
    };
  }

  async getRun(runId: string): Promise<AgentRun> {
    const res = await this.db.query('SELECT * FROM agent_runs WHERE id = $1', [runId]);
    if (res.rows.length === 0) {
      throw new NotFoundException(`Agent run "${runId}" not found`);
    }
    const row = res.rows[0];
    return {
      id: row.id,
      assetId: row.asset_id,
      prompt: row.prompt,
      status: row.status,
      steps: row.steps,
      model: row.model,
      tokensIn: row.tokens_in,
      tokensOut: row.tokens_out,
      startedAt: row.started_at,
      finishedAt: row.finished_at,
    };
  }

  async cancelRun(runId: string): Promise<{ ok: boolean; status: string }> {
    await this.db.query(`UPDATE agent_runs SET status = 'CANCELLED' WHERE id = $1`, [runId]);
    return { ok: true, status: 'CANCELLED' };
  }
}
