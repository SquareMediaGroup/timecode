/**
 * GldDriver -- Allen & Heath GLD TCP MIDI driver.
 *
 * Connects to the GLD mixer on TCP port 51325 and sends MIDI messages
 * for scene recall and channel mute control.
 */
import { EventEmitter } from 'node:events';
import type { DeviceConnection, GldAction } from '../types.js';
export interface GldConfig {
    host: string;
    port: number;
    enabled?: boolean;
}
export declare class GldDriver extends EventEmitter {
    private host;
    private port;
    private enabled;
    private status;
    private socket;
    private reconnectTimer;
    constructor(config: GldConfig);
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    triggerCue(action: GldAction): void;
    getStatus(): DeviceConnection;
    updateConfig(config: Partial<GldConfig>): void;
    /**
     * Recall a scene by number.
     * The GLD uses MIDI Program Change on channel 0 for scene recall.
     * Scenes are 1-indexed in the UI but 0-indexed over MIDI.
     */
    private recallScene;
    /**
     * Mute or unmute a channel.
     * The GLD maps mute to MIDI Note On (mute) / Note Off (unmute)
     * on channel 0, where the note number corresponds to the channel.
     */
    private setChannelMute;
    private sendMidi;
    private setStatus;
    private scheduleReconnect;
    private clearReconnect;
}
export default GldDriver;
//# sourceMappingURL=gld.d.ts.map