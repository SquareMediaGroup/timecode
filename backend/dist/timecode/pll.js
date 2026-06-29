/**
 * PLLFilter -- Phase-Locked Loop jitter filter for incoming MTC.
 *
 * Smooths jittery MTC packets arriving over Wi-Fi by applying
 * proportional + integral correction. Free-runs at the last known
 * rate if packets stop arriving for longer than the dropout threshold.
 */
import { EventEmitter } from 'node:events';
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function timecodeToFrames(tc, frameRate) {
    const fps = Math.round(frameRate);
    let total = tc.hours * 3600 * fps +
        tc.minutes * 60 * fps +
        tc.seconds * fps +
        tc.frames;
    if (frameRate === 29.97) {
        const totalMinutes = tc.hours * 60 + tc.minutes;
        const dropFrames = 2 * (totalMinutes - Math.floor(totalMinutes / 10));
        total -= dropFrames;
    }
    return total;
}
export function framesToTimecode(totalFrames, frameRate) {
    let f = Math.max(0, Math.floor(totalFrames));
    if (frameRate === 29.97) {
        const d = Math.floor(f / 17982);
        const m = f % 17982;
        const adjustment = m < 2 ? 0 : Math.floor((m - 2) / 1798) * 2 + 2;
        f += 18 * d + adjustment;
    }
    const fps = Math.round(frameRate);
    const frames = f % fps;
    const totalSeconds = Math.floor(f / fps);
    const seconds = totalSeconds % 60;
    const totalMinutes = Math.floor(totalSeconds / 60);
    const minutes = totalMinutes % 60;
    const hours = Math.floor(totalMinutes / 60) % 24;
    return { hours, minutes, seconds, frames };
}
function formatTimecode(tc, frameRate) {
    const sep = frameRate === 29.97 ? ';' : ':';
    const pad = (n, w = 2) => String(n).padStart(w, '0');
    return `${pad(tc.hours)}:${pad(tc.minutes)}:${pad(tc.seconds)}${sep}${pad(tc.frames)}`;
}
// ---------------------------------------------------------------------------
// PLL Filter
// ---------------------------------------------------------------------------
/** Dropout threshold in milliseconds. If no packet arrives within this
 *  window the filter switches to free-running mode. */
const DROPOUT_THRESHOLD_MS = 500;
export class PLLFilter extends EventEmitter {
    kp;
    ki;
    freeRunFps;
    /** Smoothed position expressed in fractional frames. */
    position = 0;
    /** Current frame rate from last received packet. */
    currentFps;
    /** Accumulated integral error term. */
    integralError = 0;
    /** Timestamp (ms) of last received MTC packet. */
    lastPacketTime = 0;
    /** Whether the filter is currently free-running. */
    freeRunning = false;
    /** Free-run interval handle. */
    freeRunTimer = null;
    /** Last emitted whole-frame number (avoids duplicate emissions). */
    lastEmittedFrame = -1;
    constructor(config = {}) {
        super();
        this.kp = config.proportionalGain ?? 0.3;
        this.ki = config.integralGain ?? 0.05;
        this.freeRunFps = config.freeRunFrameRate ?? 25;
        this.currentFps = this.freeRunFps;
    }
    // -- Public API -----------------------------------------------------------
    /**
     * Feed an incoming MTC timecode packet into the filter.
     * Call this each time a new MTC quarter-frame or full-frame message
     * arrives from the network.
     */
    feed(incoming, frameRate) {
        this.currentFps = frameRate;
        this.lastPacketTime = Date.now();
        const incomingFrames = timecodeToFrames(incoming, frameRate);
        const error = incomingFrames - this.position;
        // Proportional correction
        this.position += this.kp * error;
        // Integral correction (drift compensation)
        this.integralError += error;
        this.position += this.ki * this.integralError;
        // Clamp integral to prevent windup
        const maxIntegral = Math.round(frameRate) * 2; // 2 seconds worth
        this.integralError = Math.max(-maxIntegral, Math.min(maxIntegral, this.integralError));
        if (this.freeRunning) {
            this.freeRunning = false;
            this.stopFreeRun();
        }
        this.startDropoutWatch();
        this.emitSmoothed();
    }
    /**
     * Stop the PLL filter and clean up all timers.
     */
    stop() {
        this.stopFreeRun();
        this.removeAllListeners();
    }
    // -- Internal -------------------------------------------------------------
    /**
     * Start (or restart) the dropout detection interval.
     * If no packet arrives within DROPOUT_THRESHOLD_MS the filter begins
     * free-running at the last known frame rate.
     */
    startDropoutWatch() {
        // The free-run timer doubles as the dropout watcher.
        // If it is already running we leave it alone.
        if (this.freeRunTimer)
            return;
        const effectiveFps = this.currentFps === 29.97 ? 30000 / 1001 : this.currentFps;
        const intervalMs = 1000 / effectiveFps;
        this.freeRunTimer = setInterval(() => {
            const elapsed = Date.now() - this.lastPacketTime;
            if (elapsed >= DROPOUT_THRESHOLD_MS) {
                // Dropout detected -- advance by one frame per tick
                if (!this.freeRunning) {
                    this.freeRunning = true;
                }
            }
            if (this.freeRunning) {
                this.position += 1;
                this.emitSmoothed();
            }
        }, intervalMs);
    }
    stopFreeRun() {
        if (this.freeRunTimer) {
            clearInterval(this.freeRunTimer);
            this.freeRunTimer = null;
        }
    }
    emitSmoothed() {
        const wholeFrame = Math.floor(this.position);
        if (wholeFrame === this.lastEmittedFrame)
            return;
        this.lastEmittedFrame = wholeFrame;
        const tc = framesToTimecode(wholeFrame, this.currentFps);
        const output = {
            timecode: tc,
            formatted: formatTimecode(tc, this.currentFps),
            frameRate: this.currentFps,
            isFreeRunning: this.freeRunning,
        };
        this.emit('smoothed', output);
    }
}
export default PLLFilter;
//# sourceMappingURL=pll.js.map