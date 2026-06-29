/**
 * ProPresenterDriver -- ProPresenter 7 WebSocket API driver.
 *
 * Connects to ProPresenter's remote control WebSocket API and sends
 * slide trigger and macro execution commands.
 */
import { EventEmitter } from 'node:events';
import type { DeviceConnection, ProPresenterAction } from '../types.js';
export interface ProPresenterConfig {
    host: string;
    port: number;
    enabled?: boolean;
    password?: string;
}
export declare class ProPresenterDriver extends EventEmitter {
    private host;
    private port;
    private enabled;
    private password;
    private status;
    private ws;
    private reconnectTimer;
    private authenticated;
    constructor(config: ProPresenterConfig);
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    triggerCue(action: ProPresenterAction): void;
    getStatus(): DeviceConnection;
    updateConfig(config: Partial<ProPresenterConfig>): void;
    private sendAuth;
    private handleMessage;
    private sendCommand;
    private setStatus;
    private scheduleReconnect;
    private clearReconnect;
}
export default ProPresenterDriver;
//# sourceMappingURL=propresenter.d.ts.map