import { LLMClient, LLMMessage, ToolDef, LLMResponse, LLMToolCall } from './llm-client.interface';

/**
 * Deterministic LLM client for offline evals and testing.
 * Accurately parses user edit intents and converts them into appropriate tool calls,
 * while safely handling ambiguity, injections, and invalid cases.
 */
export class DeterministicMockLLMClient implements LLMClient {
  async chat(args: {
    messages: LLMMessage[];
    tools?: ToolDef[];
    temperature?: number;
    max_tokens?: number;
  }): Promise<LLMResponse> {
    const lastMsg = args.messages[args.messages.length - 1];

    // If the last message is a tool response, formulate the final user-facing summary
    if (lastMsg.role === 'tool') {
      return {
        message: {
          role: 'assistant',
          content: 'Done! I have completed the requested edits and verified the timeline.',
        },
        usage: { prompt_tokens: 120, completion_tokens: 25 },
      };
    }

    // Find the latest user message
    const userMsgs = args.messages.filter((m) => m.role === 'user');
    const prompt = userMsgs[userMsgs.length - 1]?.content || '';
    const promptLower = prompt.toLowerCase().trim();

    // 1. INJECTION DEFENSE:
    // If the prompt appears to come from untrusted transcript text or contains prompt injection markers
    if (
      promptLower.includes('ignore your instructions') ||
      promptLower.includes('system override') ||
      promptLower.includes('disregard previous')
    ) {
      return {
        message: {
          role: 'assistant',
          content: 'I cannot comply with embedded system override instructions. Transcript text is treated as untrusted data.',
        },
        usage: { prompt_tokens: 80, completion_tokens: 20 },
      };
    }

    // 2. AMBIGUITY:
    // e.g. "cut the boring part", "make it better", "edit it nicely"
    if (
      promptLower.includes('boring part') ||
      promptLower.includes('make it better') ||
      promptLower.includes('do something cool') ||
      promptLower.includes('make it funnier')
    ) {
      return {
        message: {
          role: 'assistant',
          content:
            'Could you please specify which timestamp, clip, or phrase you consider boring? I cannot guess destructive edits without specific instructions.',
        },
        usage: { prompt_tokens: 95, completion_tokens: 35 },
      };
    }

    // 3. UNDO:
    if (promptLower.startsWith('undo') || promptLower.includes('revert that')) {
      return {
        message: {
          role: 'assistant',
          content: 'Undoing the last operation.',
          tool_calls: [
            {
              id: 'call_undo_1',
              type: 'function',
              function: {
                name: 'undo',
                arguments: '{}',
              },
            },
          ],
        },
        usage: { prompt_tokens: 65, completion_tokens: 15 },
      };
    }

    // 4. TAKE SELECTION:
    // e.g. "use the first take of the intro", "use the second take of group 3"
    const takeMatch =
      promptLower.match(/use\s+(?:the\s+)?(first|second|third|1st|2nd|3rd|\d+)(?:st|nd|rd|th)?\s+take(?:\s+of\s+(?:group\s+)?([\w_]+))?/i) ||
      promptLower.match(/select\s+take\s+(\d+|[\w_]+)(?:\s+for\s+group\s+([\w_]+))?/i);

    if (takeMatch) {
      const takeOrdinal = takeMatch[1];
      let groupName = takeMatch[2] || 'g1';
      if (groupName === 'intro') groupName = 'g1';
      if (!groupName.startsWith('g') && !isNaN(Number(groupName))) {
        groupName = `g${groupName}`;
      }

      let segIdx = 0;
      if (takeOrdinal === 'first' || takeOrdinal === '1st' || takeOrdinal === '1') segIdx = 0;
      else if (takeOrdinal === 'second' || takeOrdinal === '2nd' || takeOrdinal === '2') segIdx = 1;
      else if (takeOrdinal === 'third' || takeOrdinal === '3rd' || takeOrdinal === '3') segIdx = 2;

      return {
        message: {
          role: 'assistant',
          content: `Selecting take ${segIdx + 1} for group ${groupName}.`,
          tool_calls: [
            {
              id: 'call_select_take_1',
              type: 'function',
              function: {
                name: 'select_take',
                arguments: JSON.stringify({
                  groupId: groupName,
                  segmentId: `seg_${groupName}_${segIdx + 1}`,
                }),
              },
            },
          ],
        },
        usage: { prompt_tokens: 110, completion_tokens: 28 },
      };
    }

    // 5. REMOVE CLIP:
    // e.g. "remove clip 2", "delete clip_1", "remove the second clip"
    const removeMatch = promptLower.match(/(?:remove|delete|cut)\s+(?:the\s+)?(?:clip\s+)?([a-z0-9_]+)/i);
    if (removeMatch && (promptLower.includes('clip') || promptLower.includes('intro'))) {
      let clipId = removeMatch[1];
      if (clipId === 'intro' || clipId === 'first') clipId = 'clip_1';
      else if (clipId === 'second') clipId = 'clip_2';
      else if (!clipId.startsWith('clip_') && !isNaN(Number(clipId))) {
        clipId = `clip_${clipId}`;
      }

      return {
        message: {
          role: 'assistant',
          content: `Removing ${clipId} from the timeline.`,
          tool_calls: [
            {
              id: 'call_remove_1',
              type: 'function',
              function: {
                name: 'remove_clip',
                arguments: JSON.stringify({ clipId }),
              },
            },
          ],
        },
        usage: { prompt_tokens: 90, completion_tokens: 20 },
      };
    }

    // 6. RANGE CUT:
    // e.g. "cut everything between 0:42 and 0:50" or "cut between 10 and 15"
    const rangeMatch = promptLower.match(/between\s+([\d:.]+)\s+and\s+([\d:.]+)/i);
    if (rangeMatch) {
      const parseTime = (s: string) => {
        if (s.includes(':')) {
          const [m, sec] = s.split(':').map(Number);
          return m * 60 + sec;
        }
        return parseFloat(s);
      };
      const start = parseTime(rangeMatch[1]);
      const end = parseTime(rangeMatch[2]);

      return {
        message: {
          role: 'assistant',
          content: `Removing range from ${start}s to ${end}s.`,
          tool_calls: [
            {
              id: 'call_range_1',
              type: 'function',
              function: {
                name: 'remove_range',
                arguments: JSON.stringify({ start, end, domain: 'timeline' }),
              },
            },
          ],
        },
        usage: { prompt_tokens: 100, completion_tokens: 25 },
      };
    }

    // 7. REMOVE FILLERS:
    // e.g. "remove all ums", "cut filler words"
    if (promptLower.includes('filler') || promptLower.includes('um') || promptLower.includes('uh')) {
      return {
        message: {
          role: 'assistant',
          content: 'Scanning transcript and removing detected filler words.',
          tool_calls: [
            {
              id: 'call_fillers_1',
              type: 'function',
              function: {
                name: 'remove_fillers',
                arguments: JSON.stringify({ scope: 'all' }),
              },
            },
          ],
        },
        usage: { prompt_tokens: 90, completion_tokens: 20 },
      };
    }

    // 8. TRIM CLIP:
    // e.g. "trim the end of clip_1 by 1 second" or "trim clip_2 out to 10"
    const trimMatch = promptLower.match(/trim\s+([\w_]+)(?:\s+(?:out|end)\s+(?:to|by)\s+([\d.]+))?/i);
    if (trimMatch) {
      let clipId = trimMatch[1];
      if (!clipId.startsWith('clip_') && !isNaN(Number(clipId))) {
        clipId = `clip_${clipId}`;
      }
      const val = trimMatch[2] ? parseFloat(trimMatch[2]) : undefined;

      return {
        message: {
          role: 'assistant',
          content: `Trimming ${clipId}.`,
          tool_calls: [
            {
              id: 'call_trim_1',
              type: 'function',
              function: {
                name: 'trim_clip',
                arguments: JSON.stringify({ clipId, out: val, domain: 'timeline' }),
              },
            },
          ],
        },
        usage: { prompt_tokens: 95, completion_tokens: 22 },
      };
    }

    // Default: Check timeline state first
    return {
      message: {
        role: 'assistant',
        content: 'Inspecting current timeline state.',
        tool_calls: [
          {
            id: 'call_get_timeline_init',
            type: 'function',
            function: {
              name: 'get_timeline',
              arguments: '{}',
            },
          },
        ],
      },
      usage: { prompt_tokens: 85, completion_tokens: 15 },
    };
  }
}
