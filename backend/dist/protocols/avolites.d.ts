/**
 * AvolitesDriver -- Avolites Titan OSC + Art-Net Timecode driver.
 *
 * Supports two protocols:
 *   - OSC: Send cue triggers via UDP OSC messages.
 *   - Art-Net Timecode: Continuously stream SMPTE timecode as
 *     Art-Net OpTimeCode packets (OpCode 0x9700).
 */
import { EventEmitter } from 'node:events';
import type { AvolitesAction, DeviceConnection, FrameRate, Timecode } from '../types.js';
export interface AvolitesConfig {
    host: string;
    port: number;
    enabled?: boolean;
    artNetPort?: number;
}
export declare class AvolitesDriver extends EventEmitter {
    private host;
    private port;
    private artNetPort;
    private enabled;
    private status;
    private oscPort;
    private artNetSocket;
    private reconnectTimer;
    constructor(config: AvolitesConfig);
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    triggerCue(action: AvolitesAction): void;
    /**
     * Send a single Art-Net Timecode packet. Call this on every frame tick
     * when Art-Net timecode sync is active.
     */
    sendArtNetTimecode(tc: Timecode, frameRate: FrameRate): void;
    getStatus(): DeviceConnection;
    updateConfig(config: Partial<AvolitesConfig>): void;
    private setStatus;
    private scheduleReconnect;
    private clearReconnect;
}
export default AvolitesDriver;
//# sourceMappingURL=avolites.d.ts.map