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
import { ExportService } from './export.service';
import {
  Timeline,
  ExportFormat,
  ExportOptions,
} from '../../../../packages/contracts';

@Controller('assets/:assetId/export')
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  @Get(':format')
  async downloadExport(
    @Param('assetId') assetId: string,
    @Param('format') format: ExportFormat,
    @Query('sequenceName') sequenceName: string,
    @Res() res: Response
  ) {
    const result = await this.exportService.exportTimeline(assetId, format, undefined, {
      format,
      sequenceName,
    });

    res.setHeader('Content-Type', result.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.setHeader('Access-Control-Expose-Headers', '*');
    return res.status(HttpStatus.OK).send(result.content);
  }

  @Post(':format')
  async generateExport(
    @Param('assetId') assetId: string,
    @Param('format') format: ExportFormat,
    @Body() body: { timeline?: Timeline; options?: ExportOptions; download?: boolean },
    @Res() res: Response
  ) {
    const result = await this.exportService.exportTimeline(
      assetId,
      format,
      body?.timeline,
      body?.options || { format }
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
