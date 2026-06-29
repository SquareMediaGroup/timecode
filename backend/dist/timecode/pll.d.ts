/**
 * PLLFilter -- Phase-Locked Loop jitter filter for incoming MTC.
 *
 * Smooths jittery MTC packets arriving over Wi-Fi by applying
 * proportional + integral correction. Free-runs at the last known
 * rate if packets stop arriving for longer than the dropout threshold.
 */
import { EventEmitter } from 'node:events';
import type { FrameRate, Timecode } from '../types.js';
export declare function framesToTimecode(totalFrames: number, frameRate: FrameRate): Timecode;
export interface PLLConfig {
    /** Proportional gain (0-1). Higher = faster tracking, more jitter. */
    proportionalGain?: number;
    /** Integral gain (0-1). Corrects steady-state offset. */
    integralGain?: number;
    /** Frame rate used during free-run when no packets arrive. */
    freeRunFrameRate?: FrameRate;
}
export interface PLLOutput {
    timecode: Timecode;
    formatted: string;
    frameRate: FrameRate;
    isFreeRunning: boolean;
}
export declare class PLLFilter extends EventEmitter {
    private readonly kp;
    private readonly ki;
    private readonly freeRunFps;
    /** Smoothed position expressed in fractional frames. */
    private position;
    /** Current frame rate from last received packet. */
    private currentFps;
    /** Accumulated integral error term. */
    private integralError;
    /** Timestamp (ms) of last received MTC packet. */
    private lastPacketTime;
    /** Whether the filter is currently free-running. */
    private freeRunning;
    /** Free-run interval handle. */
    private freeRunTimer;
    /** Last emitted whole-frame number (avoids duplicate emissions). */
    private lastEmittedFrame;
    constructor(config?: PLLConfig);
    /**
     * Feed an incoming MTC timecode packet into the filter.
     * Call this each time a new MTC quarter-frame or full-frame message
     * arrives from the network.
     */
    feed(incoming: Timecode, frameRate: FrameRate): void;
    /**
     * Stop the PLL filter and clean up all timers.
     */
    stop(): void;
    /**
     * Start (or restart) the dropout detection interval.
     * If no packet arrives within DROPOUT_THRESHOLD_MS the filter begins
     * free-running at the last known frame rate.
     */
    private startDropoutWatch;
    private stopFreeRun;
    private emitSmoothed;
}
export default PLLFilter;
//# sourceMappingURL=pll.d.ts.map