import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  Res,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { CaptionsService } from './captions.service';
import {
  Timeline,
  SubtitleFormat,
  SubtitleStylePreset,
  SubtitleExportOptions,
} from '../../../../packages/contracts';

@Controller('assets/:assetId/captions')
export class CaptionsController {
  constructor(private readonly captionsService: CaptionsService) {}

  @Get()
  async getCaptionsData(
    @Param('assetId') assetId: string,
    @Query('format') format?: SubtitleFormat,
    @Query('style') style?: SubtitleStylePreset
  ) {
    return this.captionsService.getCaptions(assetId, undefined, {
      format: format || 'json',
      stylePreset: style || 'kinetic',
    });
  }

  @Get(':format')
  async downloadCaptions(
    @Param('assetId') assetId: string,
    @Param('format') format: SubtitleFormat,
    @Query('style') style: SubtitleStylePreset,
    @Res() res: Response
  ) {
    const result = await this.captionsService.getCaptions(assetId, undefined, {
      format,
      stylePreset: style,
    });

    res.setHeader('Content-Type', result.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.setHeader('Access-Control-Expose-Headers', '*');
    return res.status(HttpStatus.OK).send(result.content);
  }

  @Post(':format')
  async generateCustomCaptions(
    @Param('assetId') assetId: string,
    @Param('format') format: SubtitleFormat,
    @Body() body: { timeline?: Timeline; options?: SubtitleExportOptions; download?: boolean },
    @Res() res: Response
  ) {
    const options: SubtitleExportOptions = {
      ...body?.options,
      format,
    };

    const result = await this.captionsService.getCaptions(
      assetId,
      body?.timeline,
      options
    );

    if (body?.download) {
      res.setHeader('Content-Type', result.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      res.setHeader('Access-Control-Expose-Headers', '*');
      return res.status(HttpStatus.OK).send(result.content);
    }

    return res.status(HttpStatus.OK).json({
      ok: true,
      ...result,
    });
  }
}
