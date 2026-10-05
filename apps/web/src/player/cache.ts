/**
 * LRU Frame Cache with byte budget and open-frame counter.
 * Guarantees that every VideoFrame is either displayed, cached, or closed.
 */

export interface CachedFrame {
  index: number;
  frame: VideoFrame;
  sizeBytes: number;
  lastAccessed: number;
}

export class FrameCache {
  private cache = new Map<number, CachedFrame>();
  private currentBytes = 0;
  private readonly maxBytes: number;
  private openFrameCount = 0;

  constructor(maxBytes: number = 50 * 1024 * 1024) { // Default 50 MB budget
    this.maxBytes = maxBytes;
  }

  getOpenFrameCount(): number {
    return this.openFrameCount;
  }

  getCurrentBytes(): number {
    return this.currentBytes;
  }

  getFrameCount(): number {
    return this.cache.size;
  }

  has(index: number): boolean {
    return this.cache.has(index);
  }

  get(index: number): VideoFrame | null {
    const item = this.cache.get(index);
    if (!item) return null;
    item.lastAccessed = performance.now();
    return item.frame;
  }

  put(index: number, frame: VideoFrame): void {
    if (this.cache.has(index)) {
      const existing = this.cache.get(index)!;
      existing.lastAccessed = performance.now();
      return;
    }

    // Estimate I420 frame size: width * height * 1.5
    const frameBytes = Math.round(frame.displayWidth * frame.displayHeight * 1.5);

    // Evict older frames if over budget
    while (this.currentBytes + frameBytes > this.maxBytes && this.cache.size > 0) {
      this.evictOldest();
    }

    this.cache.set(index, {
      index,
      frame,
      sizeBytes: frameBytes,
      lastAccessed: performance.now(),
    });

    this.currentBytes += frameBytes;
    this.openFrameCount++;
  }

  private evictOldest(): void {
    let oldestKey: number | null = null;
    let oldestTime = Infinity;

    this.cache.forEach((item, key) => {
      if (item.lastAccessed < oldestTime) {
        oldestTime = item.lastAccessed;
        oldestKey = key;
      }
    });

    if (oldestKey !== null) {
      const item = this.cache.get(oldestKey)!;
      try {
        item.frame.close();
      } catch (e) {
        // Already closed
      }
      this.currentBytes -= item.sizeBytes;
      this.openFrameCount--;
      this.cache.delete(oldestKey);
    }
  }

  clear(): void {
    this.cache.forEach((item) => {
      try {
        item.frame.close();
      } catch (e) {
        // Already closed
      }
    });
    this.cache.clear();
    this.currentBytes = 0;
    this.openFrameCount = 0;
  }
}
