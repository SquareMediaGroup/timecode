/**
 * GldDriver -- Allen & Heath GLD TCP MIDI driver.
 *
 * Connects to the GLD mixer on TCP port 51325 and sends MIDI messages
 * for scene recall and channel mute control.
 */
import { EventEmitter } from 'node:events';
import net from 'node:net';
const GLD_DEFAULT_PORT = 51325;
const RECONNECT_INTERVAL_MS = 5000;
// ---------------------------------------------------------------------------
// MIDI helpers
// ---------------------------------------------------------------------------
/**
 * Build a MIDI Program Change message.
 * Status byte: 0xC0 | channel (0-15), data: program (0-127).
 */
function midiProgramChange(channel, program) {
    return Buffer.from([0xc0 | (channel & 0x0f), program & 0x7f]);
}
/**
 * Build a MIDI Note On message.
 * Status byte: 0x90 | channel, note (0-127), velocity (0-127).
 */
function midiNoteOn(channel, note, velocity) {
    return Buffer.from([
        0x90 | (channel & 0x0f),
        note & 0x7f,
        velocity & 0x7f,
    ]);
}
/**
 * Build a MIDI Note Off message.
 * Status byte: 0x80 | channel, note (0-127), velocity 0.
 */
function midiNoteOff(channel, note) {
    return Buffer.from([0x80 | (channel & 0x0f), note & 0x7f, 0x00]);
}
// ---------------------------------------------------------------------------
// Driver
// ---------------------------------------------------------------------------
export class GldDriver extends EventEmitter {
    host;
    port;
    enabled;
    status = 'disconnected';
    socket = null;
    reconnectTimer = null;
    constructor(config) {
        super();
        this.host = config.host;
        this.port = config.port || GLD_DEFAULT_PORT;
        this.enabled = config.enabled ?? true;
    }
    // -- Connection lifecycle -------------------------------------------------
    async connect() {
        if (!this.enabled)
            return;
        if (this.socket) {
            await this.disconnect();
        }
        this.setStatus('connecting');
        try {
            this.socket = new net.Socket();
            this.socket.on('connect', () => {
                console.log('[GLD] TCP connected');
                this.setStatus('connected');
                this.clearReconnect();
            });
            this.socket.on('data', (_data) => {
                // GLD may send status responses; we acknowledge but don't
                // need to act on them for basic scene/mute control.
            });
            this.socket.on('close', () => {
                console.log('[GLD] TCP connection closed');
                this.setStatus('disconnected');
                this.scheduleReconnect();
            });
            this.socket.on('error', (err) => {
                console.error('[GLD] TCP error:', err.message);
                this.setStatus('error');
                this.scheduleReconnect();
            });
            this.socket.on('timeout', () => {
                console.warn('[GLD] TCP connection timed out');
                this.socket?.destroy();
            });
            this.socket.setTimeout(10_000);
            this.socket.connect(this.port, this.host);
        }
        catch (err) {
            console.error('[GLD] Connection failed:', err);
            this.setStatus('error');
            this.scheduleReconnect();
        }
    }
    async disconnect() {
        this.clearReconnect();
        if (this.socket) {
            try {
                this.socket.removeAllListeners();
                this.socket.destroy();
            }
            catch {
                // ignore
            }
            this.socket = null;
        }
        this.setStatus('disconnected');
    }
    // -- Actions --------------------------------------------------------------
    triggerCue(action) {
        if (!action.enabled || this.status !== 'connected' || !this.socket)
            return;
        switch (action.triggerType) {
            case 'recall_scene':
                this.recallScene(action.sceneNumber ?? 1);
                break;
            case 'mute_channel':
                this.setChannelMute(action.channelNumber ?? 1, action.muted ?? true);
                break;
        }
    }
    // -- Status ---------------------------------------------------------------
    getStatus() {
        return {
            type: 'gld',
            label: 'A&H GLD',
            host: this.host,
            port: this.port,
            status: this.status,
            enabled: this.enabled,
        };
    }
    updateConfig(config) {
        if (config.host !== undefined)
            this.host = config.host;
        if (config.port !== undefined)
            this.port = config.port;
        if (config.enabled !== undefined)
            this.enabled = config.enabled;
    }
    // -- MIDI command helpers -------------------------------------------------
    /**
     * Recall a scene by number.
     * The GLD uses MIDI Program Change on channel 0 for scene recall.
     * Scenes are 1-indexed in the UI but 0-indexed over MIDI.
     */
    recallScene(sceneNumber) {
        const program = Math.max(0, sceneNumber - 1) & 0x7f;
        // For scenes beyond 128, use Bank Select (CC 0) + Program Change
        const bank = Math.floor((sceneNumber - 1) / 128);
        if (bank > 0) {
            // CC 0 (Bank Select MSB) on channel 0
            const bankSelect = Buffer.from([0xb0, 0x00, bank & 0x7f]);
            this.sendMidi(bankSelect);
        }
        this.sendMidi(midiProgramChange(0, program));
    }
    /**
     * Mute or unmute a channel.
     * The GLD maps mute to MIDI Note On (mute) / Note Off (unmute)
     * on channel 0, where the note number corresponds to the channel.
     */
    setChannelMute(channelNumber, muted) {
        const note = Math.max(0, channelNumber - 1) & 0x7f;
        if (muted) {
            // Note On with velocity 127 = muted
            this.sendMidi(midiNoteOn(0, note, 127));
        }
        else {
            // Note Off = unmuted
            this.sendMidi(midiNoteOff(0, note));
        }
    }
    sendMidi(data) {
        if (!this.socket || this.socket.destroyed)
            return;
        this.socket.write(data);
    }
    // -- Status & reconnect ---------------------------------------------------
    setStatus(status) {
        if (this.status === status)
            return;
        this.status = status;
        this.emit('status', this.getStatus());
    }
    scheduleReconnect() {
        if (this.reconnectTimer)
            return;
        this.reconnectTimer = setInterval(() => {
            if (this.status === 'connected') {
                this.clearReconnect();
                return;
            }
            console.log('[GLD] Attempting reconnect...');
            this.connect().catch(() => { });
        }, RECONNECT_INTERVAL_MS);
    }
    clearReconnect() {
        if (this.reconnectTimer) {
            clearInterval(this.reconnectTimer);
            this.reconnectTimer = null;
        }
    }
}
export default GldDriver;
//# sourceMappingURL=gld.js.map