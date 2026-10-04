import {
  Controller,
  Options,
  Post,
  Head,
  Patch,
  Delete,
  Param,
  Req,
  Res,
  Headers,
  BadRequestException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { UploadsService } from './uploads.service';

const TUS_VERSION = '1.0.0';
const TUS_EXTENSIONS = 'creation,checksum,expiration,termination';
const TUS_MAX_SIZE = '10737418240'; // 10 GB

function parseTusMetadata(metadataHeader?: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!metadataHeader) return result;

  const pairs = metadataHeader.split(',');
  for (const pair of pairs) {
    const [key, base64Val] = pair.trim().split(' ');
    if (key) {
      if (base64Val) {
        try {
          result[key] = Buffer.from(base64Val, 'base64').toString('utf8');
        } catch {
          result[key] = '';
        }
      } else {
        result[key] = '';
      }
    }
  }
  return result;
}

@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Options()
  handleOptionsRoot(@Res() res: Response) {
    res.setHeader('Tus-Resumable', TUS_VERSION);
    res.setHeader('Tus-Version', TUS_VERSION);
    res.setHeader('Tus-Extension', TUS_EXTENSIONS);
    res.setHeader('Tus-Max-Size', TUS_MAX_SIZE);
    res.setHeader('Access-Control-Expose-Headers', '*');
    return res.status(HttpStatus.NO_CONTENT).end();
  }

  @Options(':id')
  handleOptionsId(@Res() res: Response) {
    res.setHeader('Tus-Resumable', TUS_VERSION);
    res.setHeader('Tus-Version', TUS_VERSION);
    res.setHeader('Tus-Extension', TUS_EXTENSIONS);
    res.setHeader('Tus-Max-Size', TUS_MAX_SIZE);
    res.setHeader('Access-Control-Expose-Headers', '*');
    return res.status(HttpStatus.NO_CONTENT).end();
  }

  @Post()
  async handlePost(
    @Headers('upload-length') uploadLength: string,
    @Headers('upload-metadata') uploadMetadata: string,
    @Res() res: Response
  ) {
    if (!uploadLength) {
      throw new BadRequestException('Header "Upload-Length" is required');
    }

    const size = parseInt(uploadLength, 10);
    if (isNaN(size) || size <= 0) {
      throw new BadRequestException('Invalid "Upload-Length" header');
    }

    const metadata = parseTusMetadata(uploadMetadata);
    const upload = await this.uploadsService.createUpload(size, metadata);

    res.setHeader('Location', `/uploads/${upload.id}`);
    res.setHeader('Upload-Offset', '0');
    res.setHeader('Tus-Resumable', TUS_VERSION);
    res.setHeader('Access-Control-Expose-Headers', '*');
    return res.status(HttpStatus.CREATED).end();
  }

  @Head(':id')
  async handleHead(
    @Param('id') id: string,
    @Res() res: Response
  ) {
    const upload = await this.uploadsService.getUpload(id);

    res.setHeader('Upload-Offset', String(upload.currentOffset));
    res.setHeader('Upload-Length', String(upload.size));
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Tus-Resumable', TUS_VERSION);
    res.setHeader('Access-Control-Expose-Headers', '*');
    return res.status(HttpStatus.OK).end();
  }

  @Patch(':id')
  async handlePatch(
    @Param('id') id: string,
    @Headers('upload-offset') offsetHeader: string,
    @Headers('upload-checksum') checksumHeader: string,
    @Req() req: Request,
    @Res() res: Response
  ) {
    if (offsetHeader === undefined) {
      throw new BadRequestException('Header "Upload-Offset" is required');
    }

    const clientOffset = parseInt(offsetHeader, 10);
    if (isNaN(clientOffset) || clientOffset < 0) {
      throw new BadRequestException('Invalid "Upload-Offset" header');
    }

    const result = await this.uploadsService.handlePatch(
      id,
      clientOffset,
      req,
      checksumHeader
    );

    res.setHeader('Upload-Offset', String(result.newOffset));
    res.setHeader('Tus-Resumable', TUS_VERSION);
    res.setHeader('Access-Control-Expose-Headers', '*');

    if (result.isComplete && result.assetId) {
      res.setHeader('Asset-Id', result.assetId);
    }
    return res.status(HttpStatus.NO_CONTENT).end();
  }

  @Delete(':id')
  async handleDelete(
    @Param('id') id: string,
    @Res() res: Response
  ) {
    await this.uploadsService.terminateUpload(id);
    res.setHeader('Tus-Resumable', TUS_VERSION);
    return res.status(HttpStatus.NO_CONTENT).end();
  }
}
