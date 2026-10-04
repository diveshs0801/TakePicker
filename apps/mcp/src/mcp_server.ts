import readline from 'node:readline';

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: string | number;
  method: string;
  params?: any;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id?: string | number;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export const MCP_TOOLS = [
  {
    name: 'get_timeline',
    description: 'Returns the current edited timeline with compact clip list: id, in, out, timelineStart, timelineEnd, duration, groupId, reason, and text.',
    inputSchema: {
      type: 'object',
      properties: {
        assetId: { type: 'string', description: 'Asset ID' },
        seq: { type: 'number', description: 'Optional historical sequence number' },
      },
      required: ['assetId'],
    },
  },
  {
    name: 'list_take_groups',
    description: 'Returns take groups and candidate retakes with feature scores and the currently chosen take.',
    inputSchema: {
      type: 'object',
      properties: {
        assetId: { type: 'string', description: 'Asset ID' },
      },
      required: ['assetId'],
    },
  },
  {
    name: 'search_transcript',
    description: 'Searches transcript words and segment text for a query keyword or phrase.',
    inputSchema: {
      type: 'object',
      properties: {
        assetId: { type: 'string', description: 'Asset ID' },
        query: { type: 'string', description: 'Search keyword or phrase' },
        limit: { type: 'number', description: 'Max results to return' },
      },
      required: ['assetId', 'query'],
    },
  },
  {
    name: 'select_take',
    description: 'Replaces the active take for a given take group with an alternative take segment.',
    inputSchema: {
      type: 'object',
      properties: {
        assetId: { type: 'string', description: 'Asset ID' },
        groupId: { type: 'string', description: 'Take group ID' },
        segmentId: { type: 'string', description: 'Desired take segment ID' },
      },
      required: ['assetId', 'groupId', 'segmentId'],
    },
  },
  {
    name: 'remove_clip',
    description: 'Deletes a clip from the timeline by clipId. Clips after it ripple left.',
    inputSchema: {
      type: 'object',
      properties: {
        assetId: { type: 'string', description: 'Asset ID' },
        clipId: { type: 'string', description: 'The clip ID to remove' },
      },
      required: ['assetId', 'clipId'],
    },
  },
  {
    name: 'trim_clip',
    description: 'Trims the in and/or out point of a clip in timeline or source seconds.',
    inputSchema: {
      type: 'object',
      properties: {
        assetId: { type: 'string', description: 'Asset ID' },
        clipId: { type: 'string', description: 'Clip ID' },
        in: { type: 'number', description: 'New in point' },
        out: { type: 'number', description: 'New out point' },
        domain: { type: 'string', enum: ['timeline', 'source'], description: 'Time domain' },
      },
      required: ['assetId', 'clipId'],
    },
  },
  {
    name: 'split_clip',
    description: 'Splits a single clip into two adjacent clips at timestamp "at".',
    inputSchema: {
      type: 'object',
      properties: {
        assetId: { type: 'string', description: 'Asset ID' },
        clipId: { type: 'string', description: 'Clip ID' },
        at: { type: 'number', description: 'Split timestamp' },
        domain: { type: 'string', enum: ['timeline', 'source'], description: 'Time domain' },
      },
      required: ['assetId', 'clipId', 'at'],
    },
  },
  {
    name: 'remove_range',
    description: 'Removes a time range from the timeline, splitting or trimming affected clips.',
    inputSchema: {
      type: 'object',
      properties: {
        assetId: { type: 'string', description: 'Asset ID' },
        start: { type: 'number', description: 'Start timestamp in seconds' },
        end: { type: 'number', description: 'End timestamp in seconds' },
        domain: { type: 'string', enum: ['timeline', 'source'], description: 'Time domain' },
      },
      required: ['assetId', 'start', 'end'],
    },
  },
  {
    name: 'undo',
    description: 'Undoes the last timeline operation by applying its inverse.',
    inputSchema: {
      type: 'object',
      properties: {
        assetId: { type: 'string', description: 'Asset ID' },
      },
      required: ['assetId'],
    },
  },
  {
    name: 'render',
    description: 'Triggers a fan-out render of the current timeline into a finished video.',
    inputSchema: {
      type: 'object',
      properties: {
        assetId: { type: 'string', description: 'Asset ID' },
      },
      required: ['assetId'],
    },
  },
];

export class TakePickerMcpServer {
  private readonly apiUrl: string;

  constructor(apiUrl = process.env.API_URL || 'http://localhost:3000') {
    this.apiUrl = apiUrl;
  }

  startStdio() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false,
    });

    rl.on('line', async (line) => {
      if (!line.trim()) return;
      try {
        const req: JsonRpcRequest = JSON.parse(line);
        const res = await this.handleRequest(req);
        if (res) {
          process.stdout.write(JSON.stringify(res) + '\n');
        }
      } catch (err: any) {
        const errRes: JsonRpcResponse = {
          jsonrpc: '2.0',
          error: { code: -32700, message: 'Parse error', data: err.message },
        };
        process.stdout.write(JSON.stringify(errRes) + '\n');
      }
    });

    process.stderr.write('[TakePicker MCP Server] Running on stdio\n');
  }

  async handleRequest(req: JsonRpcRequest): Promise<JsonRpcResponse | null> {
    const { id, method, params } = req;

    switch (method) {
      case 'initialize':
        return {
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: {},
            },
            serverInfo: {
              name: 'takepicker-mcp-server',
              version: '1.0.0',
            },
          },
        };

      case 'tools/list':
        return {
          jsonrpc: '2.0',
          id,
          result: {
            tools: MCP_TOOLS,
          },
        };

      case 'tools/call': {
        const toolName = params?.name;
        const toolArgs = params?.arguments || {};
        try {
          const result = await this.dispatchToolCall(toolName, toolArgs);
          return {
            jsonrpc: '2.0',
            id,
            result: {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
              isError: !result.ok,
            },
          };
        } catch (err: any) {
          return {
            jsonrpc: '2.0',
            id,
            result: {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({ ok: false, error: err.message }),
                },
              ],
              isError: true,
            },
          };
        }
      }

      case 'notifications/initialized':
        return null;

      default:
        return {
          jsonrpc: '2.0',
          id,
          error: {
            code: -32601,
            message: `Method "${method}" not found`,
          },
        };
    }
  }

  private async dispatchToolCall(name: string, args: any): Promise<any> {
    const assetId = args.assetId;
    if (!assetId) {
      return { ok: false, code: 'INVALID_ARGUMENT', message: 'Missing required parameter "assetId"' };
    }

    if (name === 'get_timeline') {
      const res = await fetch(`${this.apiUrl}/assets/${assetId}/timeline`);
      const data = await res.json();
      return { ok: true, data };
    }

    if (name === 'list_take_groups') {
      const res = await fetch(`${this.apiUrl}/assets/${assetId}/takes`);
      const data = await res.json();
      return { ok: true, data };
    }

    if (name === 'undo') {
      const res = await fetch(`${this.apiUrl}/assets/${assetId}/undo`, { method: 'POST' });
      const data = await res.json();
      return { ok: true, data };
    }

    // Pass write tools through the agent endpoint or timeline ops
    const agentRes = await fetch(`${this.apiUrl}/assets/${assetId}/agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `Execute tool: ${name} with arguments ${JSON.stringify(args)}`,
      }),
    });
    return await agentRes.json();
  }
}

if (require.main === module) {
  const server = new TakePickerMcpServer();
  server.startStdio();
}
