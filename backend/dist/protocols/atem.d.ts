/**
 * AtemDriver -- Blackmagic ATEM UDP protocol driver.
 *
 * Implements the ATEM binary UDP protocol on port 9910 with
 * session handshake, heartbeat/ACK, and command serialisation.
 * Supports cut, auto-transition, and macro triggers.
 */
import { EventEmitter } from 'node:events';
import type { AtemAction, DeviceConnection } from '../types.js';
export interface AtemConfig {
    host: string;
    port: number;
    enabled?: boolean;
}
export declare class AtemDriver extends EventEmitter {
    private host;
    private port;
    private enabled;
    private status;
    private socket;
    private sessionId;
    private localPacketCounter;
    private remotePacketCounter;
    private connected;
    private reconnectTimer;
    private heartbeatTimer;
    constructor(config: AtemConfig);
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    triggerCue(action: AtemAction): void;
    getStatus(): DeviceConnection;
    updateConfig(config: Partial<AtemConfig>): void;
    private sendHello;
    private handlePacket;
    private buildHeader;
    private sendCommand;
    private sendCut;
    private sendAuto;
    private sendMacroRun;
    private sendRaw;
    private startHeartbeat;
    private clearHeartbeat;
    private setStatus;
    private scheduleReconnect;
    private clearReconnect;
}
export default AtemDriver;
//# sourceMappingURL=atem.d.ts.map