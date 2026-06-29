/**
 * MTC Network MIDI Receiver (rtpMIDI / AppleMIDI).
 *
 * Sets up an rtpMIDI session, listens for incoming MIDI timecode
 * quarter frames and full frames, assembles them, and emits
 * 'timecode' events.
 */
import { EventEmitter } from 'node:events';
export declare class MTCReceiver extends EventEmitter {
    private session;
    private mtcBuffer;
    private currentFrameRate;
    constructor(port?: number, name?: string);
    private parseQuarterFrame;
    private parseFullFrame;
    private emitAssembledTimecode;
    private updateFrameRate;
    destroy(): void;
}
//# sourceMappingURL=rtpmidi.d.ts.map