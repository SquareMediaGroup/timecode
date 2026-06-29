/**
 * TimecodeGenerator -- Internal master timecode clock.
 *
 * Uses process.hrtime.bigint() for sub-millisecond accuracy.
 * Supports 24, 25, 29.97 (drop-frame), and 30 fps.
 * Emits 'frame' on each new frame and 'transport' on state change.
 */

import { EventEmitter } from 'node:events';
import type {
  FrameRate,
  Timecode,
  TransportState,
  TimecodeUpdate,
  ClockMode,
} from '../types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert a total-frame count into HH:MM:SS:FF components.
 * Handles 29.97 drop-frame counting where frames 0 and 1 are skipped
 * at the start of each minute, except every 10th minute.
 */
function framesToTimecode(totalFrames: number, frameRate: FrameRate): Timecode {
  let f = Math.max(0, Math.floor(totalFrames));

  if (frameRate === 29.97) {
    // Drop-frame algorithm (SMPTE 12M)
    const d = Math.floor(f / 17982);
    const m = f % 17982;
    const adjustment = m < 2 ? 0 : Math.floor((m - 2) / 1798) * 2 + 2;
    f += 18 * d + adjustment;
  }

  const fps = Math.round(frameRate); // 24,25,30
  const frames = f % fps;
  const totalSeconds = Math.floor(f / fps);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60) % 24;

  return { hours, minutes, seconds, frames };
}

/**
 * Convert a Timecode object back to a total-frame count.
 */
function timecodeToFrames(tc: Timecode, frameRate: FrameRate): number {
  const fps = Math.round(frameRate);
  let total =
    tc.hours * 3600 * fps +
    tc.minutes * 60 * fps +
    tc.seconds * fps +
    tc.frames;

  if (frameRate === 29.97) {
    // Reverse the drop-frame adjustment
    const totalMinutes = tc.hours * 60 + tc.minutes;
    const dropFrames = 2 * (totalMinutes - Math.floor(totalMinutes / 10));
    total -= dropFrames;
  }

  return total;
}

/**
 * Format a Timecode object to the standard "HH:MM:SS:FF" string.
 * Uses a semicolon separator for 29.97 drop-frame.
 */
export function formatTimecode(tc: Timecode, frameRate: FrameRate): string {
  const sep = frameRate === 29.97 ? ';' : ':';
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${pad(tc.hours)}:${pad(tc.minutes)}:${pad(tc.seconds)}${sep}${pad(tc.frames)}`;
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

export class TimecodeGenerator extends EventEmitter {
  private frameRate: FrameRate = 25;
  private state: TransportState = 'stopped';
  private totalFrames = 0;
  private lastFrameEmitted = -1;

  /** High-res origin captured on play */
  private originNs: bigint = 0n;
  /** Frame count at the moment play was pressed */
  private originFrames = 0;

  private tickTimer: ReturnType<typeof setInterval> | null = null;

  // -- Transport controls ---------------------------------------------------

  play(): void {
    if (this.state === 'playing') return;
    this.originNs = process.hrtime.bigint();
    this.originFrames = this.totalFrames;
    this.state = 'playing';
    this.startTick();
    this.emitTransport();
  }

  pause(): void {
    if (this.state !== 'playing') return;
    this.stopTick();
    this.state = 'paused';
    this.emitTransport();
  }

  stop(): void {
    if (this.state === 'stopped') return;
    this.stopTick();
    this.totalFrames = 0;
    this.lastFrameEmitted = -1;
    this.state = 'stopped';
    this.emitTransport();
    this.emitFrame();
  }

  reset(): void {
    const wasPlaying = this.state === 'playing';
    this.stopTick();
    this.totalFrames = 0;
    this.lastFrameEmitted = -1;
    this.state = 'stopped';
    this.emitTransport();
    this.emitFrame();
    if (wasPlaying) {
      this.play();
    }
  }

  // -- Configuration --------------------------------------------------------

  setFrameRate(fps: FrameRate): void {
    this.frameRate = fps;
    if (this.state === 'playing') {
      // Re-anchor so timing stays consistent
      this.originNs = process.hrtime.bigint();
      this.originFrames = this.totalFrames;
    }
    this.emitFrame();
  }

  getFrameRate(): FrameRate {
    return this.frameRate;
  }

  setTimecode(tc: Timecode): void {
    this.totalFrames = timecodeToFrames(tc, this.frameRate);
    this.lastFrameEmitted = -1;
    if (this.state === 'playing') {
      this.originNs = process.hrtime.bigint();
      this.originFrames = this.totalFrames;
    }
    this.emitFrame();
  }

  getCurrentTimecode(): Timecode {
    return framesToTimecode(this.totalFrames, this.frameRate);
  }

  getState(): TransportState {
    return this.state;
  }

  // -- Internal tick loop ---------------------------------------------------

  private startTick(): void {
    if (this.tickTimer) return;
    this.tickTimer = setInterval(() => this.tick(), 1);
  }

  private stopTick(): void {
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
  }

  private tick(): void {
    if (this.state !== 'playing') return;

    const nowNs = process.hrtime.bigint();
    const elapsedNs = nowNs - this.originNs;

    // Effective frame rate for timing calculation
    const effectiveFps = this.frameRate === 29.97 ? 30000 / 1001 : this.frameRate;
    const nsPerFrame = BigInt(Math.round(1e9 / effectiveFps));

    const elapsedFrames = Number(elapsedNs / nsPerFrame);
    this.totalFrames = this.originFrames + elapsedFrames;

    if (this.totalFrames !== this.lastFrameEmitted) {
      this.lastFrameEmitted = this.totalFrames;
      this.emitFrame();
    }
  }

  // -- Event helpers --------------------------------------------------------

  private emitFrame(): void {
    const tc = this.getCurrentTimecode();
    const update: TimecodeUpdate = {
      timecode: tc,
      formatted: formatTimecode(tc, this.frameRate),
      clockMode: 'internal' as ClockMode,
      transportState: this.state,
      frameRate: this.frameRate,
    };
    this.emit('frame', update);
  }

  private emitTransport(): void {
    this.emit('transport', this.state);
  }

  // -- Cleanup --------------------------------------------------------------

  destroy(): void {
    this.stopTick();
    this.removeAllListeners();
  }
}

export default TimecodeGenerator;
