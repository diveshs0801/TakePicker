import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { AssetsService } from '../assets/assets.service';
import { TimelineService } from '../timeline/timeline.service';
import { DatabaseService } from '../database/database.service';
import {
  Asset,
  Timeline,
  ExportFormat,
  ExportOptions,
  ExportResult,
} from '../../../../packages/contracts';
import {
  generateEDL,
  generatePremiereXML,
  generateFCPXML,
  generateOTIO,
} from './export.generator';

@Injectable()
export class ExportService {
  constructor(
    private readonly assetsService: AssetsService,
    private readonly timelineService: TimelineService,
    private readonly db: DatabaseService
  ) {}

  async exportTimeline(
    assetId: string,
    format: ExportFormat,
    customTimeline?: Timeline,
    options?: ExportOptions
  ): Promise<ExportResult> {
    const asset = await this.assetsService.getAsset(assetId);
    if (!asset) {
      throw new NotFoundException(`Asset ${assetId} not found`);
    }

    // Use client-provided timeline if valid, otherwise fetch active timeline from DB
    const timeline = customTimeline && customTimeline.clips
      ? customTimeline
      : await this.assetsService.getTimeline(assetId);

    if (!timeline.clips || timeline.clips.length === 0) {
      throw new BadRequestException('Timeline has no clips to export');
    }

    const baseName = (asset.filename || 'timeline')
      .replace(/\.[^/.]+$/, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_');

    const totalDurationSec = timeline.clips.reduce(
      (acc, c) => acc + Math.max(0, c.out - c.in),
      0
    );

    let content = '';
    let filename = '';
    let mimeType = '';

    switch (format) {
      case 'fcpxml':
        content = generateFCPXML(asset, timeline, options);
        filename = `${baseName}_takepicker.fcpxml`;
        mimeType = 'application/xml';
        break;

      case 'premiere':
        content = generatePremiereXML(asset, timeline, options);
        filename = `${baseName}_premiere.xml`;
        mimeType = 'application/xml';
        break;

      case 'edl':
        content = generateEDL(asset, timeline, options);
        filename = `${baseName}_takepicker.edl`;
        mimeType = 'text/plain';
        break;

      case 'otio':
        const otioObj = generateOTIO(asset, timeline, options);
        content = JSON.stringify(otioObj, null, 2);
        filename = `${baseName}_takepicker.otio`;
        mimeType = 'application/json';
        break;

      default:
        throw new BadRequestException(`Unsupported export format: ${format}`);
    }

    return {
      format,
      filename,
      mimeType,
      content,
      clipCount: timeline.clips.length,
      totalDurationSec,
    };
  }
}
