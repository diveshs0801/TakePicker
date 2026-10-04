import { z } from 'zod';
import { TimelineService } from '../timeline/timeline.service';
import { AssetsService } from '../assets/assets.service';
import { RendersService } from '../renders/renders.service';
import { DatabaseService } from '../database/database.service';
import { ToolResult } from '../../../../packages/contracts';

export interface ToolContext {
  assetId: string;
  timelineService: TimelineService;
  assetsService: AssetsService;
  rendersService?: RendersService;
  db: DatabaseService;
  actor: 'user' | 'agent';
  agentRunId?: string;
  baseSeq?: number;
}

export interface ToolDefinition<TSchema extends z.ZodTypeAny = z.ZodTypeAny> {
  name: string;
  description: string;
  schema: TSchema;
  isWrite: boolean;
  execute(ctx: ToolContext, args: z.infer<TSchema>): Promise<ToolResult>;
}

export function zodToJsonSchema(schema: z.ZodTypeAny): Record<string, any> {
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape;
    const properties: Record<string, any> = {};
    const required: string[] = [];

    for (const key of Object.keys(shape)) {
      const field = shape[key];
      properties[key] = zodFieldToJson(field);
      if (!(field instanceof z.ZodOptional)) {
        required.push(key);
      }
    }

    return {
      type: 'object',
      properties,
      required: required.length > 0 ? required : undefined,
    };
  }
  return { type: 'object' };
}

function zodFieldToJson(field: z.ZodTypeAny): Record<string, any> {
  if (field instanceof z.ZodString) {
    return { type: 'string', description: field.description };
  }
  if (field instanceof z.ZodNumber) {
    return { type: 'number', description: field.description };
  }
  if (field instanceof z.ZodBoolean) {
    return { type: 'boolean', description: field.description };
  }
  if (field instanceof z.ZodEnum) {
    return { type: 'string', enum: field._def.values, description: field.description };
  }
  if (field instanceof z.ZodOptional) {
    return zodFieldToJson(field._def.innerType);
  }
  if (field instanceof z.ZodArray) {
    return { type: 'array', items: zodFieldToJson(field._def.type), description: field.description };
  }
  return { type: 'string' };
}
