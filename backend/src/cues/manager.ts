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
import type {
  Cue,
  CueStateUpdate,
  FrameRate,
  Timecode,
} from '../types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function timecodeToFrames(tc: Timecode, frameRate: FrameRate): number {
  const fps = Math.round(frameRate);
  let total =
    tc.hours * 3600 * fps +
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

function compareCues(a: Cue, b: Cue): number {
  // Sort by timecode ascending. Use a generic frame rate (30) for ordering
  // since the relative order is the same regardless of fps.
  return timecodeToFrames(a.triggerTimecode, 30) - timecodeToFrames(b.triggerTimecode, 30);
}

// ---------------------------------------------------------------------------
// Database schema
// ---------------------------------------------------------------------------

interface CueDB {
  cues: Cue[];
}

// ---------------------------------------------------------------------------
// Manager
// ---------------------------------------------------------------------------

export class CueManager extends EventEmitter {
  private db!: Low<CueDB>;
  private readonly dbPath: string;

  /** ID of the last triggered cue. */
  private activeCueId: string | null = null;
  /** ID of the next upcoming cue. */
  private nextCueId: string | null = null;
  /** Frame countdown to the next cue. */
  private nextCueCountdown: number | null = null;
  /** Set of cue IDs already triggered in this run (prevents re-fire). */
  private triggeredIds = new Set<string>();

  constructor(dbPath: string) {
    super();
    this.dbPath = dbPath;
  }

  // -- Lifecycle ------------------------------------------------------------

  async init(): Promise<void> {
    const adapter = new JSONFile<CueDB>(this.dbPath);
    this.db = new Low(adapter, { cues: [] });
    await this.db.read();
  }

  // -- CRUD -----------------------------------------------------------------

  async addCue(data: Omit<Cue, 'id'>): Promise<Cue> {
    const cue: Cue = { ...data, id: crypto.randomUUID() };
    this.db.data.cues.push(cue);
    this.db.data.cues.sort(compareCues);
    await this.db.write();
    return cue;
  }

  async updateCue(id: string, updates: Partial<Cue>): Promise<Cue | null> {
    const idx = this.db.data.cues.findIndex((c) => c.id === id);
    if (idx === -1) return null;

    this.db.data.cues[idx] = { ...this.db.data.cues[idx], ...updates, id };
    this.db.data.cues.sort(compareCues);
    await this.db.write();
    return this.db.data.cues.find((c) => c.id === id) ?? null;
  }

  async deleteCue(id: string): Promise<boolean> {
    const before = this.db.data.cues.length;
    this.db.data.cues = this.db.data.cues.filter((c) => c.id !== id);
    if (this.db.data.cues.length === before) return false;
    await this.db.write();
    return true;
  }

  getCues(): Cue[] {
    return [...this.db.data.cues].sort(compareCues);
  }

  getCueById(id: string): Cue | undefined {
    return this.db.data.cues.find((c) => c.id === id);
  }

  // -- Trigger checking -----------------------------------------------------

  /**
   * Call once per frame tick. Compares the current timecode position
   * against all cue trigger points and fires matching cues.
   */
  checkFrame(currentTimecode: Timecode, frameRate: FrameRate): void {
    const currentFrame = timecodeToFrames(currentTimecode, frameRate);
    const cues = this.getCues();

    let newActiveCueId = this.activeCueId;
    let newNextCueId: string | null = null;
    let newCountdown: number | null = null;

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
    if (
      newActiveCueId !== this.activeCueId ||
      newNextCueId !== this.nextCueId ||
      newCountdown !== this.nextCueCountdown
    ) {
      this.activeCueId = newActiveCueId;
      this.nextCueId = newNextCueId;
      this.nextCueCountdown = newCountdown;

      const stateUpdate: CueStateUpdate = {
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
  resetTriggers(): void {
    this.triggeredIds.clear();
    this.activeCueId = null;
    this.nextCueId = null;
    this.nextCueCountdown = null;
  }
}

export default CueManager;
