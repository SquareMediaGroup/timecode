/**
 * ProPresenterDriver -- ProPresenter 7 WebSocket API driver.
 *
 * Connects to ProPresenter's remote control WebSocket API and sends
 * slide trigger and macro execution commands.
 */

import { EventEmitter } from 'node:events';
import WebSocket from 'ws';
import type {
  ConnectionStatus,
  DeviceConnection,
  ProPresenterAction,
} from '../types.js';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface ProPresenterConfig {
  host: string;
  port: number;
  enabled?: boolean;
  password?: string;
}

const RECONNECT_INTERVAL_MS = 5000;

// ---------------------------------------------------------------------------
// Driver
// ---------------------------------------------------------------------------

export class ProPresenterDriver extends EventEmitter {
  private host: string;
  private port: number;
  private enabled: boolean;
  private password: string | undefined;
  private status: ConnectionStatus = 'disconnected';

  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setInterval> | null = null;
  private authenticated = false;

  constructor(config: ProPresenterConfig) {
    super();
    this.host = config.host;
    this.port = config.port || 1025;
    this.enabled = config.enabled ?? true;
    this.password = config.password;
  }

  // -- Connection lifecycle -------------------------------------------------

  async connect(): Promise<void> {
    if (!this.enabled) return;
    if (this.ws) {
      await this.disconnect();
    }

    this.setStatus('connecting');

    const url = `ws://${this.host}:${this.port}/remote`;

    try {
      this.ws = new WebSocket(url);

      this.ws.on('open', () => {
        console.log('[ProPresenter] WebSocket connected');
        if (this.password) {
          this.sendAuth();
        } else {
          this.setStatus('connected');
          this.authenticated = true;
        }
      });

      this.ws.on('message', (data: WebSocket.RawData) => {
        this.handleMessage(data.toString());
      });

      this.ws.on('close', () => {
        console.log('[ProPresenter] WebSocket closed');
        this.authenticated = false;
        this.setStatus('disconnected');
        this.scheduleReconnect();
      });

      this.ws.on('error', (err: Error) => {
        console.error('[ProPresenter] WebSocket error:', err.message);
        this.authenticated = false;
        this.setStatus('error');
        this.scheduleReconnect();
      });
    } catch (err) {
      console.error('[ProPresenter] Connection failed:', err);
      this.setStatus('error');
      this.scheduleReconnect();
    }
  }

  async disconnect(): Promise<void> {
    this.clearReconnect();
    this.authenticated = false;

    if (this.ws) {
      try {
        this.ws.removeAllListeners();
        this.ws.close();
      } catch {
        // ignore
      }
      this.ws = null;
    }

    this.setStatus('disconnected');
  }

  // -- Actions --------------------------------------------------------------

  triggerCue(action: ProPresenterAction): void {
    if (!action.enabled || this.status !== 'connected' || !this.authenticated) return;

    if (action.triggerType === 'slide_index' && action.slideIndex !== undefined) {
      this.sendCommand({
        action: 'presentationTriggerIndex',
        slideIndex: action.slideIndex,
        presentationPath: '', // current presentation
      });
    } else if (action.triggerType === 'macro' && action.macroId) {
      this.sendCommand({
        action: 'macroTrigger',
        macroId: action.macroId,
      });
    }
  }

  // -- Status ---------------------------------------------------------------

  getStatus(): DeviceConnection {
    return {
      type: 'propresenter',
      label: 'ProPresenter 7',
      host: this.host,
      port: this.port,
      status: this.status,
      enabled: this.enabled,
    };
  }

  updateConfig(config: Partial<ProPresenterConfig>): void {
    if (config.host !== undefined) this.host = config.host;
    if (config.port !== undefined) this.port = config.port;
    if (config.enabled !== undefined) this.enabled = config.enabled;
    if (config.password !== undefined) this.password = config.password;
  }

  // -- Internal -------------------------------------------------------------

  private sendAuth(): void {
    this.sendCommand({
      action: 'authenticate',
      protocol: '740',
      password: this.password ?? '',
    });
  }

  private handleMessage(raw: string): void {
    try {
      const msg = JSON.parse(raw);

      if (msg.action === 'authenticate') {
        if (msg.authenticated === true || msg.authenticated === 1) {
          console.log('[ProPresenter] Authenticated successfully');
          this.authenticated = true;
          this.setStatus('connected');
        } else {
          console.error('[ProPresenter] Authentication failed:', msg.error);
          this.setStatus('error');
        }
      }
    } catch {
      // Non-JSON messages are ignored
    }
  }

  private sendCommand(payload: Record<string, unknown>): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify(payload));
  }

  private setStatus(status: ConnectionStatus): void {
    if (this.status === status) return;
    this.status = status;
    this.emit('status', this.getStatus());
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setInterval(() => {
      if (this.status === 'connected') {
        this.clearReconnect();
        return;
      }
      console.log('[ProPresenter] Attempting reconnect...');
      this.connect().catch(() => {});
    }, RECONNECT_INTERVAL_MS);
  }

  private clearReconnect(): void {
    if (this.reconnectTimer) {
      clearInterval(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}

export default ProPresenterDriver;
