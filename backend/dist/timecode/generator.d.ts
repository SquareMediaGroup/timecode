/**
 * TimecodeGenerator -- Internal master timecode clock.
 *
 * Uses process.hrtime.bigint() for sub-millisecond accuracy.
 * Supports 24, 25, 29.97 (drop-frame), and 30 fps.
 * Emits 'frame' on each new frame and 'transport' on state change.
 */
import { EventEmitter } from 'node:events';
import type { FrameRate, Timecode, TransportState } from '../types.js';
/**
 * Format a Timecode object to the standard "HH:MM:SS:FF" string.
 * Uses a semicolon separator for 29.97 drop-frame.
 */
export declare function formatTimecode(tc: Timecode, frameRate: FrameRate): string;
export declare class TimecodeGenerator extends EventEmitter {
    private frameRate;
    private state;
    private totalFrames;
    private lastFrameEmitted;
    /** High-res origin captured on play */
    private originNs;
    /** Frame count at the moment play was pressed */
    private originFrames;
    private tickTimer;
    play(): void;
    pause(): void;
    stop(): void;
    reset(): void;
    setFrameRate(fps: FrameRate): void;
    getFrameRate(): FrameRate;
    setTimecode(tc: Timecode): void;
    getCurrentTimecode(): Timecode;
    getState(): TransportState;
    private startTick;
    private stopTick;
    private tick;
    private emitFrame;
    private emitTransport;
    destroy(): void;
}
export default TimecodeGenerator;
//# sourceMappingURL=generator.d.ts.map