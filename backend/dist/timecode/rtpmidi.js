/**
 * MTC Network MIDI Receiver (rtpMIDI / AppleMIDI).
 *
 * Sets up an rtpMIDI session, listens for incoming MIDI timecode
 * quarter frames and full frames, assembles them, and emits
 * 'timecode' events.
 */
import { EventEmitter } from 'node:events';
// @ts-ignore
import rtpmidi from 'rtpmidi';
export class MTCReceiver extends EventEmitter {
    session;
    mtcBuffer = new Array(8).fill(0);
    currentFrameRate = 25;
    constructor(port = 5004, name = 'Timecode OS') {
        super();
        this.session = rtpmidi.manager.createSession({
            localName: name,
            bonjourName: name,
            port,
        });
        // Listen for incoming MIDI messages
        this.session.on('message', (deltaTime, msg) => {
            if (!msg || msg.length === 0)
                return;
            // Quarter frame (0xF1)
            if (msg[0] === 0xF1 && msg.length === 2) {
                this.parseQuarterFrame(msg[1]);
            }
            // Full frame SysEx (0xF0 0x7F 0x7F 0x01 0x01 hr mn sc fr 0xF7)
            else if (msg.length === 10 &&
                msg[0] === 0xF0 &&
                msg[1] === 0x7F &&
                msg[3] === 0x01 &&
                msg[4] === 0x01) {
                this.parseFullFrame(msg);
            }
        });
        this.session.on('ready', () => {
            this.emit('connected');
        });
        this.session.on('error', (err) => {
            console.error('[MTCReceiver] Session error:', err);
        });
    }
    parseQuarterFrame(data) {
        const type = (data >> 4) & 0x07;
        const value = data & 0x0F;
        this.mtcBuffer[type] = value;
        // Type 7 is the last piece (Hours MSB & Rate)
        if (type === 7) {
            this.emitAssembledTimecode();
        }
    }
    parseFullFrame(msg) {
        const hoursRateByte = msg[5];
        const minutes = msg[6];
        const seconds = msg[7];
        const frames = msg[8];
        this.updateFrameRate((hoursRateByte >> 5) & 0x03);
        const hours = hoursRateByte & 0x1F;
        this.emit('timecode', { hours, minutes, seconds, frames }, this.currentFrameRate);
    }
    emitAssembledTimecode() {
        const frames = (this.mtcBuffer[1] << 4) | this.mtcBuffer[0];
        const seconds = (this.mtcBuffer[3] << 4) | this.mtcBuffer[2];
        const minutes = (this.mtcBuffer[5] << 4) | this.mtcBuffer[4];
        const hoursRateByte = (this.mtcBuffer[7] << 4) | this.mtcBuffer[6];
        const hours = hoursRateByte & 0x1F;
        this.updateFrameRate((hoursRateByte >> 5) & 0x03);
        this.emit('timecode', { hours, minutes, seconds, frames }, this.currentFrameRate);
    }
    updateFrameRate(rateBits) {
        switch (rateBits) {
            case 0:
                this.currentFrameRate = 24;
                break;
            case 1:
                this.currentFrameRate = 25;
                break;
            case 2:
                this.currentFrameRate = 29.97;
                break;
            case 3:
                this.currentFrameRate = 30;
                break;
        }
    }
    destroy() {
        this.removeAllListeners();
        // rtpmidi manager allows removing sessions
        // @ts-ignore
        rtpmidi.manager.removeSession(this.session);
    }
}
//# sourceMappingURL=rtpmidi.js.map