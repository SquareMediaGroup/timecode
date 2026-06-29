/**
 * CueManager -- Cue database and frame-accurate trigger engine.
 *
 * Persists cues to a JSON file via lowdb and checks each frame tick
 * to determine whether a cue should fire.
 */
import { EventEmitter } from 'node:events';
import crypto from 'node:crypto';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
export function timecodeToFrames(tc, frameRate) {
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
function compareCues(a, b) {
    // Sort by timecode ascending. Use a generic frame rate (30) for ordering
    // since the relative order is the same regardless of fps.
    return timecodeToFrames(a.triggerTimecode, 30) - timecodeToFrames(b.triggerTimecode, 30);
}
// ---------------------------------------------------------------------------
// Manager
// ---------------------------------------------------------------------------
export class CueManager extends EventEmitter {
    db;
    dbPath;
    /** ID of the last triggered cue. */
    activeCueId = null;
    /** ID of the next upcoming cue. */
    nextCueId = null;
    /** Frame countdown to the next cue. */
    nextCueCountdown = null;
    /** Set of cue IDs already triggered in this run (prevents re-fire). */
    triggeredIds = new Set();
    constructor(dbPath) {
        super();
        this.dbPath = dbPath;
    }
    // -- Lifecycle ------------------------------------------------------------
    async init() {
        const adapter = new JSONFile(this.dbPath);
        this.db = new Low(adapter, { cues: [] });
        await this.db.read();
    }
    // -- CRUD -----------------------------------------------------------------
    async addCue(data) {
        const cue = { ...data, id: crypto.randomUUID() };
        this.db.data.cues.push(cue);
        this.db.data.cues.sort(compareCues);
        await this.db.write();
        return cue;
    }
    async updateCue(id, updates) {
        const idx = this.db.data.cues.findIndex((c) => c.id === id);
        if (idx === -1)
            return null;
        this.db.data.cues[idx] = { ...this.db.data.cues[idx], ...updates, id };
        this.db.data.cues.sort(compareCues);
        await this.db.write();
        return this.db.data.cues.find((c) => c.id === id) ?? null;
    }
    async deleteCue(id) {
        const before = this.db.data.cues.length;
        this.db.data.cues = this.db.data.cues.filter((c) => c.id !== id);
        if (this.db.data.cues.length === before)
            return false;
        await this.db.write();
        return true;
    }
    getCues() {
        return [...this.db.data.cues].sort(compareCues);
    }
    getCueById(id) {
        return this.db.data.cues.find((c) => c.id === id);
    }
    // -- Trigger checking -----------------------------------------------------
    /**
     * Call once per frame tick. Compares the current timecode position
     * against all cue trigger points and fires matching cues.
     */
    checkFrame(currentTimecode, frameRate) {
        const currentFrame = timecodeToFrames(currentTimecode, frameRate);
        const cues = this.getCues();
        let newActiveCueId = this.activeCueId;
        let newNextCueId = null;
        let newCountdown = null;
        for (const cue of cues) {
            const cueFrame = timecodeToFrames(cue.triggerTimecode, frameRate);
            // Exact match -- trigger this cue
            if (cueFrame === currentFrame && !this.triggeredIds.has(cue.id)) {
                this.triggeredIds.add(cue.id);
                newActiveCueId = cue.id;
                this.emit('cue:trigger', cue);
            }
            // Find the next upcoming cue (first cue whose frame is strictly ahead)
            if (cueFrame > currentFrame && newNextCueId === null) {
                newNextCueId = cue.id;
                newCountdown = cueFrame - currentFrame;
            }
        }
        // Emit state update only when something changed
        if (newActiveCueId !== this.activeCueId ||
            newNextCueId !== this.nextCueId ||
            newCountdown !== this.nextCueCountdown) {
            this.activeCueId = newActiveCueId;
            this.nextCueId = newNextCueId;
            this.nextCueCountdown = newCountdown;
            const stateUpdate = {
                activeCueId: this.activeCueId,
                nextCueId: this.nextCueId,
                nextCueCountdown: this.nextCueCountdown,
            };
            this.emit('cue:state', stateUpdate);
        }
    }
    /**
     * Reset trigger tracking. Call when transport is stopped or rewound
     * so cues can fire again on the next pass.
     */
    resetTriggers() {
        this.triggeredIds.clear();
        this.activeCueId = null;
        this.nextCueId = null;
        this.nextCueCountdown = null;
    }
}
export default CueManager;
//# sourceMappingURL=manager.js.map