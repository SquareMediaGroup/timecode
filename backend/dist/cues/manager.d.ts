/**
 * CueManager -- Cue database and frame-accurate trigger engine.
 *
 * Persists cues to a JSON file via lowdb and checks each frame tick
 * to determine whether a cue should fire.
 */
import { EventEmitter } from 'node:events';
import type { Cue, FrameRate, Timecode } from '../types.js';
export declare function timecodeToFrames(tc: Timecode, frameRate: FrameRate): number;
export declare class CueManager extends EventEmitter {
    private db;
    private readonly dbPath;
    /** ID of the last triggered cue. */
    private activeCueId;
    /** ID of the next upcoming cue. */
    private nextCueId;
    /** Frame countdown to the next cue. */
    private nextCueCountdown;
    /** Set of cue IDs already triggered in this run (prevents re-fire). */
    private triggeredIds;
    constructor(dbPath: string);
    init(): Promise<void>;
    addCue(data: Omit<Cue, 'id'>): Promise<Cue>;
    updateCue(id: string, updates: Partial<Cue>): Promise<Cue | null>;
    deleteCue(id: string): Promise<boolean>;
    getCues(): Cue[];
    getCueById(id: string): Cue | undefined;
    /**
     * Call once per frame tick. Compares the current timecode position
     * against all cue trigger points and fires matching cues.
     */
    checkFrame(currentTimecode: Timecode, frameRate: FrameRate): void;
    /**
     * Reset trigger tracking. Call when transport is stopped or rewound
     * so cues can fire again on the next pass.
     */
    resetTriggers(): void;
}
export default CueManager;
//# sourceMappingURL=manager.d.ts.map