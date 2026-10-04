import { Readable } from 'node:stream';

export interface FileStat {
  size: number;
}

export interface StorageService {
  create(key: string, size: number): Promise<void>;
  append(
    key: string,
    offset: number,
    stream: Readable,
    expectedSha256?: string
  ): Promise<{ bytesWritten: number; newOffset: number; checksumMatched: boolean }>;
  stat(key: string): Promise<FileStat | null>;
  open(key: string): Readable;
  move(fromKey: string, toKey: string): Promise<void>;
  remove(key: string): Promise<void>;
  truncate(key: string, offset: number): Promise<void>;
}
