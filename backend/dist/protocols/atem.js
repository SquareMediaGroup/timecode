/**
 * AtemDriver -- Blackmagic ATEM UDP protocol driver.
 *
 * Implements the ATEM binary UDP protocol on port 9910 with
 * session handshake, heartbeat/ACK, and command serialisation.
 * Supports cut, auto-transition, and macro triggers.
 */
import { EventEmitter } from 'node:events';
import dgram from 'node:dgram';
// ---------------------------------------------------------------------------
// ATEM protocol constants
// ---------------------------------------------------------------------------
const ATEM_PORT = 9910;
/** Flag masks for the 16-bit header flags/length word. */
const FLAG_RELIABLE = 0x08;
const FLAG_SYN = 0x10;
const FLAG_RETX = 0x20;
const FLAG_ACK_REQUEST = 0x01;
const FLAG_ACK_REPLY = 0x80;
const HEADER_LEN = 12;
const HELLO_PACKET_LEN = 20;
/** ATEM command name length is always 4 bytes. */
const CMD_HEADER_LEN = 8; // 2-byte length + 2 padding + 4-byte name
const RECONNECT_INTERVAL_MS = 5000;
const HEARTBEAT_INTERVAL_MS = 1000;
// ---------------------------------------------------------------------------
// Driver
// ---------------------------------------------------------------------------
export class AtemDriver extends EventEmitter {
    host;
    port;
    enabled;
    status = 'disconnected';
    socket = null;
    sessionId = 0;
    localPacketCounter = 0;
    remotePacketCounter = 0;
    connected = false;
    reconnectTimer = null;
    heartbeatTimer = null;
    constructor(config) {
        super();
        this.host = config.host;
        this.port = config.port || ATEM_PORT;
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
        this.sessionId = 0;
        this.localPacketCounter = 0;
        this.remotePacketCounter = 0;
        this.connected = false;
        try {
            this.socket = dgram.createSocket('udp4');
            this.socket.on('message', (msg) => {
                this.handlePacket(msg);
            });
            this.socket.on('error', (err) => {
                console.error('[ATEM] Socket error:', err.message);
                this.setStatus('error');
                this.scheduleReconnect();
            });
            this.socket.on('close', () => {
                this.connected = false;
                this.setStatus('disconnected');
            });
            // Bind to ephemeral port and send hello
            this.socket.bind(0, () => {
                this.sendHello();
            });
        }
        catch (err) {
            console.error('[ATEM] Connection failed:', err);
            this.setStatus('error');
            this.scheduleReconnect();
        }
    }
    async disconnect() {
        this.clearReconnect();
        this.clearHeartbeat();
        this.connected = false;
        if (this.socket) {
            try {
                this.socket.removeAllListeners();
                this.socket.close();
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
        if (!action.enabled || !this.connected)
            return;
        switch (action.triggerType) {
            case 'cut':
                this.sendCut(action.inputSource ?? 1);
                break;
            case 'auto':
                this.sendAuto(action.inputSource ?? 1);
                break;
            case 'macro':
                this.sendMacroRun(action.macroIndex ?? 0);
                break;
        }
    }
    // -- Status ---------------------------------------------------------------
    getStatus() {
        return {
            type: 'atem',
            label: 'Blackmagic ATEM',
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
    // -- ATEM protocol internals ----------------------------------------------
    sendHello() {
        // The hello packet is a 20-byte SYN with a fixed init payload
        const buf = Buffer.alloc(HELLO_PACKET_LEN);
        const flags = FLAG_SYN;
        const flagsAndLen = (flags << 11) | HELLO_PACKET_LEN;
        buf.writeUInt16BE(flagsAndLen, 0);
        // Session ID = 0x1234 for initial request
        buf.writeUInt16BE(0x1234, 2);
        // Bytes 12-19: client hello payload
        buf.writeUInt8(0x01, 12); // connection type: want full state
        buf.writeUInt8(0x00, 13);
        buf.writeUInt16BE(0x6874, 14); // fixed preamble
        buf.writeUInt32BE(0x00000000, 16);
        this.sendRaw(buf);
    }
    handlePacket(msg) {
        if (msg.length < HEADER_LEN)
            return;
        const flagsAndLen = msg.readUInt16BE(0);
        const flags = (flagsAndLen >> 11) & 0x1f;
        const sessionId = msg.readUInt16BE(2);
        const remoteSeq = msg.readUInt16BE(10);
        // Handle SYN response (server hello)
        if (flags & (FLAG_SYN >> 0)) {
            this.sessionId = sessionId;
            // Send SYN ACK
            const ack = this.buildHeader(FLAG_ACK_REPLY, 0);
            this.sendRaw(ack);
            this.connected = true;
            this.setStatus('connected');
            this.clearReconnect();
            this.startHeartbeat();
            return;
        }
        // ACK incoming packets
        if (remoteSeq > this.remotePacketCounter) {
            this.remotePacketCounter = remoteSeq;
        }
        if (flags & FLAG_ACK_REQUEST) {
            const ack = this.buildHeader(FLAG_ACK_REPLY, 0);
            ack.writeUInt16BE(remoteSeq, 4); // ack ID
            this.sendRaw(ack);
        }
    }
    buildHeader(flags, payloadLen) {
        const totalLen = HEADER_LEN + payloadLen;
        const buf = Buffer.alloc(totalLen);
        const flagsAndLen = (flags << 11) | totalLen;
        buf.writeUInt16BE(flagsAndLen, 0);
        buf.writeUInt16BE(this.sessionId, 2);
        buf.writeUInt16BE(0, 4); // ack ID (filled in by caller if needed)
        buf.writeUInt16BE(0, 6); // unknown / retransmit request
        buf.writeUInt16BE(0, 8); // unknown
        buf.writeUInt16BE(0, 10); // local sequence (filled below if reliable)
        return buf;
    }
    sendCommand(cmdName, payload) {
        if (!this.socket || !this.connected)
            return;
        this.localPacketCounter += 1;
        const cmdBuf = Buffer.alloc(CMD_HEADER_LEN + payload.length);
        cmdBuf.writeUInt16BE(CMD_HEADER_LEN + payload.length, 0); // command length
        cmdBuf.writeUInt16BE(0, 2); // padding
        cmdBuf.write(cmdName, 4, 4, 'ascii'); // command name
        payload.copy(cmdBuf, CMD_HEADER_LEN);
        const header = this.buildHeader(FLAG_RELIABLE | FLAG_ACK_REQUEST, cmdBuf.length);
        header.writeUInt16BE(this.localPacketCounter, 10); // local sequence number
        cmdBuf.copy(header, HEADER_LEN);
        this.sendRaw(header);
    }
    sendCut(inputSource) {
        // DCut command: ME index (1 byte) + padding (3 bytes)
        const payload = Buffer.alloc(4);
        payload.writeUInt8(0, 0); // ME 0
        this.sendCommand('DCut', payload);
        // Also set preview input if source specified
        if (inputSource > 0) {
            const pvw = Buffer.alloc(4);
            pvw.writeUInt16BE(inputSource, 2); // source
            this.sendCommand('CPvI', pvw);
        }
    }
    sendAuto(inputSource) {
        // DAut command: ME index (1 byte) + padding (3 bytes)
        const payload = Buffer.alloc(4);
        payload.writeUInt8(0, 0); // ME 0
        this.sendCommand('DAut', payload);
        if (inputSource > 0) {
            const pvw = Buffer.alloc(4);
            pvw.writeUInt16BE(inputSource, 2);
            this.sendCommand('CPvI', pvw);
        }
    }
    sendMacroRun(macroIndex) {
        // MAct command: macro index (2 bytes) + action (1 byte = 0 for run) + padding
        const payload = Buffer.alloc(4);
        payload.writeUInt16BE(macroIndex, 0);
        payload.writeUInt8(0, 2); // action: 0 = run
        this.sendCommand('MAct', payload);
    }
    // -- Transport helpers ----------------------------------------------------
    sendRaw(buf) {
        if (!this.socket)
            return;
        this.socket.send(buf, 0, buf.length, this.port, this.host);
    }
    startHeartbeat() {
        this.clearHeartbeat();
        this.heartbeatTimer = setInterval(() => {
            if (!this.connected) {
                this.clearHeartbeat();
                return;
            }
            // Send an empty ACK as heartbeat
            const ack = this.buildHeader(FLAG_ACK_REPLY, 0);
            ack.writeUInt16BE(this.remotePacketCounter, 4);
            this.sendRaw(ack);
        }, HEARTBEAT_INTERVAL_MS);
    }
    clearHeartbeat() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
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
            console.log('[ATEM] Attempting reconnect...');
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
export default AtemDriver;
//# sourceMappingURL=atem.js.map