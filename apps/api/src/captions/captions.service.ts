import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { AssetsService } from '../assets/assets.service';
import { DatabaseService } from '../database/database.service';
import {
  Timeline,
  SubtitleFormat,
  SubtitleExportOptions,
  SubtitleExportResult,
  Word,
} from '../../../../packages/contracts';
import {
  alignWordsToTimeline,
  groupWordsIntoCues,
  generateSRT,
  generateVTT,
  generateASS,
} from './captions.generator';

@Injectable()
export class CaptionsService {
  constructor(
    private readonly assetsService: AssetsService,
    private readonly db: DatabaseService
  ) {}

  async getCaptions(
    assetId: string,
    customTimeline?: Timeline,
    options?: SubtitleExportOptions
  ): Promise<SubtitleExportResult> {
    const asset = await this.assetsService.getAsset(assetId);
    if (!asset) {
      throw new NotFoundException(`Asset ${assetId} not found`);
    }

    // 1. Get raw word-level transcript from database
    const transcriptRes = await this.assetsService.getTranscript(assetId);
    const words: Word[] = transcriptRes.words || [];

    if (words.length === 0) {
      // Return empty structured result instead of error if not transcribed yet
      return {
        format: options?.format || 'srt',
        filename: `${asset.filename || 'subtitles'}.srt`,
        mimeType: 'text/plain',
        content: '',
        cueCount: 0,
        wordCount: 0,
        totalDurationSec: 0,
        cues: [],
      };
    }

    // 2. Get active timeline (custom from client or current DB state)
    const timeline = customTimeline && customTimeline.clips
      ? customTimeline
      : await this.assetsService.getTimeline(assetId);

    // 3. Align raw words to the rough-cut timeline
    const timelineWords = alignWordsToTimeline(timeline.clips || [], words);

    // 4. Group into readable cues
    const maxWords = options?.maxWordsPerCue || 6;
    const maxChars = options?.maxCharsPerCue || 36;
    const cues = groupWordsIntoCues(timelineWords, maxWords, maxChars);

    const baseName = (asset.filename || 'take_cut')
      .replace(/\.[^/.]+$/, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_');

    const totalDurationSec =
      cues.length > 0 ? cues[cues.length - 1].end : 0;

    const format: SubtitleFormat = options?.format || 'srt';
    let content = '';
    let filename = '';
    let mimeType = '';

    switch (format) {
      case 'srt':
        content = generateSRT(cues);
        filename = `${baseName}_captions.srt`;
        mimeType = 'text/plain';
        break;

      case 'vtt':
        content = generateVTT(cues);
        filename = `${baseName}_captions.vtt`;
        mimeType = 'text/vtt';
        break;

      case 'ass':
        content = generateASS(cues, {
          stylePreset: options?.stylePreset || 'kinetic',
          title: `${asset.filename || 'TakePicker'} Subtitles`,
        });
        filename = `${baseName}_kinetic.ass`;
        mimeType = 'text/x-ssa';
        break;

      case 'json':
        content = JSON.stringify(cues, null, 2);
        filename = `${baseName}_captions.json`;
        mimeType = 'application/json';
        break;

      default:
        throw new BadRequestException(`Unsupported subtitle format: ${format}`);
    }

    return {
      format,
      filename,
      mimeType,
      content,
      cueCount: cues.length,
      wordCount: timelineWords.length,
      totalDurationSec,
      cues,
    };
  }
}
