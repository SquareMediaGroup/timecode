/**
 * AvolitesDriver -- Avolites Titan OSC + Art-Net Timecode driver.
 *
 * Supports two protocols:
 *   - OSC: Send cue triggers via UDP OSC messages.
 *   - Art-Net Timecode: Continuously stream SMPTE timecode as
 *     Art-Net OpTimeCode packets (OpCode 0x9700).
 */
import { EventEmitter } from 'node:events';
import dgram from 'node:dgram';
import osc from 'osc';
// ---------------------------------------------------------------------------
// Art-Net Timecode packet builder
// ---------------------------------------------------------------------------
const ARTNET_HEADER = Buffer.from('Art-Net\0');
const ARTNET_OP_TIMECODE_LO = 0x00;
const ARTNET_OP_TIMECODE_HI = 0x97;
const ARTNET_PROT_VER_HI = 0x00;
const ARTNET_PROT_VER_LO = 0x0e; // version 14
function frameRateToArtNetType(fps) {
    switch (fps) {
        case 24:
            return 0;
        case 25:
            return 1;
        case 29.97:
            return 2; // drop-frame
        case 30:
            return 3;
        default:
            return 1;
    }
}
function buildArtNetTimecodePacket(tc, frameRate) {
    const buf = Buffer.alloc(19);
    ARTNET_HEADER.copy(buf, 0); // bytes 0-7: "Art-Net\0"
    buf[8] = ARTNET_OP_TIMECODE_LO; // OpCode low byte
    buf[9] = ARTNET_OP_TIMECODE_HI; // OpCode high byte
    buf[10] = ARTNET_PROT_VER_HI; // ProtVer high byte
    buf[11] = ARTNET_PROT_VER_LO; // ProtVer low byte
    buf[12] = 0; // Filler 1
    buf[13] = 0; // Filler 2
    buf[14] = tc.frames; // Frames
    buf[15] = tc.seconds; // Seconds
    buf[16] = tc.minutes; // Minutes
    buf[17] = tc.hours; // Hours
    buf[18] = frameRateToArtNetType(frameRate); // Type
    return buf;
}
const RECONNECT_INTERVAL_MS = 5000;
export class AvolitesDriver extends EventEmitter {
    host;
    port; // OSC port (default 7000)
    artNetPort; // Art-Net port (default 6454)
    enabled;
    status = 'disconnected';
    oscPort = null;
    artNetSocket = null;
    reconnectTimer = null;
    constructor(config) {
        super();
        this.host = config.host;
        this.port = config.port || 7000;
        this.artNetPort = config.artNetPort ?? 6454;
        this.enabled = config.enabled ?? true;
    }
    // -- Connection lifecycle -------------------------------------------------
    async connect() {
        if (!this.enabled)
            return;
        this.setStatus('connecting');
        try {
            // OSC UDP port
            this.oscPort = new osc.UDPPort({
                localAddress: '0.0.0.0',
                localPort: 0, // ephemeral
                remoteAddress: this.host,
                remotePort: this.port,
                metadata: true,
            });
            this.oscPort.on('ready', () => {
                this.setStatus('connected');
            });
            this.oscPort.on('error', (err) => {
                console.error('[Avolites] OSC error:', err.message);
                this.setStatus('error');
                this.scheduleReconnect();
            });
            this.oscPort.open();
            // Art-Net UDP socket (separate, reusable)
            this.artNetSocket = dgram.createSocket('udp4');
            this.artNetSocket.on('error', (err) => {
                console.error('[Avolites] Art-Net socket error:', err.message);
            });
        }
        catch (err) {
            console.error('[Avolites] Connection failed:', err);
            this.setStatus('error');
            this.scheduleReconnect();
        }
    }
    async disconnect() {
        this.clearReconnect();
        if (this.oscPort) {
            try {
                this.oscPort.close();
            }
            catch {
                // ignore
            }
            this.oscPort = null;
        }
        if (this.artNetSocket) {
            try {
                this.artNetSocket.close();
            }
            catch {
                // ignore
            }
            this.artNetSocket = null;
        }
        this.setStatus('disconnected');
    }
    // -- Actions --------------------------------------------------------------
    triggerCue(action) {
        if (!action.enabled || this.status !== 'connected')
            return;
        if (action.protocol === 'osc' && action.oscPath && this.oscPort) {
            const args = [];
            if (action.oscValue !== undefined) {
                const type = typeof action.oscValue === 'number' ? 'f' : 's';
                args.push({ type, value: action.oscValue });
            }
            this.oscPort.send({ address: action.oscPath, args });
        }
        // Art-Net timecode streaming is handled via sendArtNetTimecode()
    }
    /**
     * Send a single Art-Net Timecode packet. Call this on every frame tick
     * when Art-Net timecode sync is active.
     */
    sendArtNetTimecode(tc, frameRate) {
        if (!this.artNetSocket)
            return;
        const packet = buildArtNetTimecodePacket(tc, frameRate);
        this.artNetSocket.send(packet, 0, packet.length, this.artNetPort, this.host);
    }
    // -- Status ---------------------------------------------------------------
    getStatus() {
        return {
            type: 'avolites',
            label: 'Avolites Titan',
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
        if (config.artNetPort !== undefined)
            this.artNetPort = config.artNetPort;
        if (config.enabled !== undefined)
            this.enabled = config.enabled;
    }
    // -- Internal -------------------------------------------------------------
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
            console.log('[Avolites] Attempting reconnect...');
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
export default AvolitesDriver;
//# sourceMappingURL=avolites.js.map