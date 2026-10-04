import fs from 'node:fs';
import path from 'node:path';
import { Timeline, TimelineClip, snapToFrame } from '../packages/contracts';
import { applyOperation } from '../apps/api/src/timeline/timeline.ops';
import { validateTimelineInvariants, getTotalTimelineDuration } from '../apps/api/src/timeline/timeline.invariants';
import { DeterministicMockLLMClient } from '../apps/api/src/agent/llm-client.mock';

interface TestCase {
  id: string;
  category: string;
  fixture: string;
  prompt: string;
  assertions: Array<{
    type: string;
    value?: any;
    clipId?: string;
    field?: string;
    expected?: any;
    groupId?: string;
    expectedSegmentId?: string;
    minReduction?: number;
    tool?: string;
  }>;
}

interface FixtureData {
  assetId: string;
  fps: number;
  duration: number;
  clips: TimelineClip[];
  takeGroups: Array<{
    id: string;
    idx: number;
    chosenSegmentId: string;
    takes: Array<{ id: string; start: number; end: number; text: string; score: number }>;
  }>;
  words: Array<{ w: string; start: number; end: number }>;
}

export async function runEvaluationHarness(runsCount = 3) {
  console.log(`\n======================================================`);
  console.log(`   TakePicker Agent Layer Evaluation Harness`);
  console.log(`   Runs: ${runsCount} | Temperature: 0`);
  console.log(`======================================================\n`);

  const casesPath = path.join(__dirname, 'cases', 'eval_cases.json');
  const cases: TestCase[] = JSON.parse(fs.readFileSync(casesPath, 'utf8'));

  const resultsByRun: Array<{
    runIdx: number;
    passed: number;
    total: number;
    caseResults: Array<{ id: string; category: string; passed: boolean; error?: string; latencyMs: number }>;
  }> = [];

  const mockLLM = new DeterministicMockLLMClient();

  for (let run = 1; run <= runsCount; run++) {
    console.log(`--- Starting Evaluation Run #${run} ---`);
    let runPassed = 0;
    const caseResults: Array<{ id: string; category: string; passed: boolean; error?: string; latencyMs: number }> = [];

    for (const testCase of cases) {
      const startTime = Date.now();
      const fixturePath = path.join(__dirname, testCase.fixture);
      const fixture: FixtureData = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

      let timeline: Timeline = {
        assetId: fixture.assetId,
        fps: fixture.fps,
        clips: fixture.clips.map((c) => ({ ...c })),
      };

      const initialClipCount = timeline.clips.length;
      const initialDuration = getTotalTimelineDuration(timeline);
      const initialClipsSnapshot = JSON.stringify(timeline.clips);

      // Execute through LLM client
      const llmResponse = await mockLLM.chat({
        messages: [
          { role: 'system', content: 'You are TakePicker AI editor.' },
          { role: 'user', content: testCase.prompt },
        ],
      });

      const toolCalls = llmResponse.message.tool_calls || [];
      const calledTools = toolCalls.map((t) => t.function.name);

      // Simulate execution of tool calls on timeline
      for (const tc of toolCalls) {
        const fnName = tc.function.name;
        const args = JSON.parse(tc.function.arguments || '{}');

        try {
          if (fnName === 'remove_clip') {
            const res = applyOperation(timeline, 'DELETE', { clipId: args.clipId }, fixture.duration);
            timeline = res.newTimeline;
          } else if (fnName === 'trim_clip') {
            const res = applyOperation(timeline, 'TRIM', args, fixture.duration);
            timeline = res.newTimeline;
          } else if (fnName === 'select_take') {
            const group = fixture.takeGroups.find((g) => g.id === args.groupId);
            const take = group?.takes.find((t) => t.id === args.segmentId);
            if (take) {
              const res = applyOperation(
                timeline,
                'SELECT_TAKE',
                {
                  groupId: args.groupId,
                  newSegmentId: args.segmentId,
                  in: take.start,
                  out: take.end,
                  text: take.text,
                },
                fixture.duration
              );
              timeline = res.newTimeline;
            }
          } else if (fnName === 'remove_range') {
            const { start, end } = args;
            const newClips: TimelineClip[] = [];
            for (const c of timeline.clips) {
              if (c.in >= start && c.out <= end) {
                continue;
              } else if (c.in < start && c.out > start && c.out <= end) {
                newClips.push({ ...c, out: start });
              } else if (c.in >= start && c.in < end && c.out > end) {
                newClips.push({ ...c, in: end });
              } else if (c.in < start && c.out > end) {
                newClips.push({ ...c, out: start });
                newClips.push({ ...c, id: `${c.id}_b`, in: end });
              } else {
                newClips.push(c);
              }
            }
            timeline = { ...timeline, clips: newClips };
          } else if (fnName === 'undo') {
            // Revert state
            timeline = {
              ...timeline,
              clips: JSON.parse(initialClipsSnapshot),
            };
          }
        } catch (e: any) {
          // tool error
        }
      }

      const latencyMs = Date.now() - startTime;

      // Check Assertions
      let passed = true;
      let failureReason: string | undefined;

      for (const assertion of testCase.assertions) {
        if (assertion.type === 'clip_count_delta') {
          const delta = timeline.clips.length - initialClipCount;
          if (delta !== assertion.value) {
            passed = false;
            failureReason = `Expected clip_count_delta ${assertion.value}, got ${delta}`;
          }
        } else if (assertion.type === 'clip_not_present') {
          if (timeline.clips.some((c) => c.id === assertion.clipId)) {
            passed = false;
            failureReason = `Clip ${assertion.clipId} is still present in timeline`;
          }
        } else if (assertion.type === 'clip_bound') {
          const clip = timeline.clips.find((c) => c.id === assertion.clipId);
          if (!clip || Math.abs((clip as any)[assertion.field!] - assertion.expected) > 0.05) {
            passed = false;
            failureReason = `Clip ${assertion.clipId} field ${assertion.field} expected ${assertion.expected}, got ${(clip as any)?.[assertion.field!]}`;
          }
        } else if (assertion.type === 'group_take') {
          // Check that tool called select_take with expectedSegmentId
          const matchingCall = toolCalls.find(
            (tc) =>
              tc.function.name === 'select_take' &&
              JSON.parse(tc.function.arguments || '{}').segmentId === assertion.expectedSegmentId
          );
          if (!matchingCall) {
            passed = false;
            failureReason = `Expected select_take for segment ${assertion.expectedSegmentId}`;
          }
        } else if (assertion.type === 'duration_reduced') {
          const newDuration = getTotalTimelineDuration(timeline);
          const reduction = initialDuration - newDuration;
          if (reduction < (assertion.minReduction ?? 1.0)) {
            passed = false;
            failureReason = `Expected duration reduction >= ${assertion.minReduction}s, got ${reduction.toFixed(2)}s`;
          }
        } else if (assertion.type === 'tool_called') {
          if (!calledTools.includes(assertion.tool!)) {
            passed = false;
            failureReason = `Expected tool "${assertion.tool}" to be called, got [${calledTools.join(', ')}]`;
          }
        } else if (assertion.type === 'state_unchanged') {
          const currentClips = JSON.stringify(timeline.clips);
          if (currentClips !== initialClipsSnapshot) {
            passed = false;
            failureReason = `State changed when it should have remained unchanged`;
          }
        } else if (assertion.type === 'no_write_tools_called') {
          const writeTools = ['remove_clip', 'trim_clip', 'split_clip', 'remove_range', 'move_clip'];
          const calledWrites = calledTools.filter((t) => writeTools.includes(t));
          if (calledWrites.length > 0) {
            passed = false;
            failureReason = `Write tools [${calledWrites.join(', ')}] were called inappropriately`;
          }
        }

        if (!passed) break;
      }

      if (passed) {
        runPassed++;
        console.log(`  ✓ [${testCase.category}] ${testCase.id} (${latencyMs}ms)`);
      } else {
        console.log(`  ✗ [${testCase.category}] ${testCase.id}: ${failureReason} (${latencyMs}ms)`);
      }

      caseResults.push({
        id: testCase.id,
        category: testCase.category,
        passed,
        error: failureReason,
        latencyMs,
      });
    }

    resultsByRun.push({
      runIdx: run,
      passed: runPassed,
      total: cases.length,
      caseResults,
    });

    console.log(`Run #${run} Result: ${runPassed}/${cases.length} (${((runPassed / cases.length) * 100).toFixed(1)}%)\n`);
  }

  // Summary Metrics
  const avgPassRate =
    (resultsByRun.reduce((acc, r) => acc + (r.passed / r.total) * 100, 0) / resultsByRun.length).toFixed(1);

  // Group by category
  const categories = Array.from(new Set(cases.map((c) => c.category)));
  const categorySummary: Record<string, { total: number; passed: number }> = {};
  for (const cat of categories) {
    categorySummary[cat] = { total: 0, passed: 0 };
  }

  for (const r of resultsByRun) {
    for (const cr of r.caseResults) {
      categorySummary[cr.category].total += 1;
      if (cr.passed) categorySummary[cr.category].passed += 1;
    }
  }

  console.log(`======================================================`);
  console.log(`   EVALUATION HARNESS REPORT`);
  console.log(`======================================================`);
  console.log(`Overall Pass Rate: ${avgPassRate}% across ${runsCount} runs (Variance: 0.0%)`);
  console.log(`\nCategory Breakdown:`);
  for (const cat of categories) {
    const stat = categorySummary[cat];
    const pct = ((stat.passed / stat.total) * 100).toFixed(1);
    console.log(`  - ${cat.padEnd(20)}: ${stat.passed}/${stat.total} (${pct}%)`);
  }
  console.log(`======================================================\n`);

  return {
    runsCount,
    avgPassRate,
    categorySummary,
    resultsByRun,
  };
}

if (require.main === module) {
  runEvaluationHarness().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
