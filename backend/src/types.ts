/**
 * Shared types for the Timecode OS system.
 * Used by both the backend engine and the React frontend.
 */

// ---------------------------------------------------------------------------
// Timecode
// ---------------------------------------------------------------------------

/** SMPTE frame rates */
export type FrameRate = 24 | 25 | 29.97 | 30;

/** A single timecode value broken into components */
export interface Timecode {
  hours: number;
  minutes: number;
  seconds: number;
  frames: number;
}

/** Clock source mode */
export type ClockMode = 'internal' | 'mtc';

/** Transport state of the internal master clock */
export type TransportState = 'stopped' | 'playing' | 'paused';

// ---------------------------------------------------------------------------
// Device Connection
// ---------------------------------------------------------------------------

export type DeviceType = 'avolites' | 'propresenter' | 'atem' | 'gld';

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'error';

export interface DeviceConnection {
  type: DeviceType;
  label: string;
  host: string;
  port: number;
  status: ConnectionStatus;
  enabled: boolean;
}

// ---------------------------------------------------------------------------
// Avolites Actions
// ---------------------------------------------------------------------------

export type AvolitesProtocol = 'osc' | 'artnet_timecode';

export interface AvolitesAction {
  enabled: boolean;
  protocol: AvolitesProtocol;
  /** OSC path (e.g. "/cue/list/1/trigger/10") */
  oscPath?: string;
  /** OSC value argument */
  oscValue?: string | number;
  /** Art-Net cuelist number (for Art-Net Timecode sync) */
  artnetCuelist?: number;
}

// ---------------------------------------------------------------------------
// ProPresenter Actions
// ---------------------------------------------------------------------------

export type ProPresenterTriggerType = 'slide_index' | 'macro';

export interface ProPresenterAction {
  enabled: boolean;
  triggerType: ProPresenterTriggerType;
  /** Slide index within the current playlist */
  slideIndex?: number;
  /** Macro UUID or name */
  macroId?: string;
}

// ---------------------------------------------------------------------------
// Blackmagic ATEM Actions
// ---------------------------------------------------------------------------

export type AtemTriggerType = 'cut' | 'auto' | 'macro';

export interface AtemAction {
  enabled: boolean;
  triggerType: AtemTriggerType;
  /** Input source number for cut/auto */
  inputSource?: number;
  /** Macro index for macro triggers */
  macroIndex?: number;
}

// ---------------------------------------------------------------------------
// Allen & Heath GLD Actions
// ---------------------------------------------------------------------------

export type GldTriggerType = 'recall_scene' | 'mute_channel';

export interface GldAction {
  enabled: boolean;
  triggerType: GldTriggerType;
  /** Scene number for recall */
  sceneNumber?: number;
  /** Channel number for mute toggle */
  channelNumber?: number;
  /** Mute state (true = muted) */
  muted?: boolean;
}

// ---------------------------------------------------------------------------
// Cue
// ---------------------------------------------------------------------------

export interface Cue {
  id: string;
  /** Sequential cue number for display */
  number: number;
  /** Human-readable label */
  label: string;
  /** Trigger timecode (HH:MM:SS:FF) */
  triggerTimecode: Timecode;
  /** Optional scene divider label (e.g. "Song 1", "Sermon") */
  sceneDivider?: string;
  /** Device-specific actions */
  avolites: AvolitesAction;
  propresenter: ProPresenterAction;
  atem: AtemAction;
  gld: GldAction;
}

export type CueStatus = 'passed' | 'active' | 'upcoming';

// ---------------------------------------------------------------------------
// WebSocket Events (Backend -> Frontend)
// ---------------------------------------------------------------------------

export interface TimecodeUpdate {
  timecode: Timecode;
  formatted: string;
  clockMode: ClockMode;
  transportState: TransportState;
  frameRate: FrameRate;
}

export interface CueStateUpdate {
  activeCueId: string | null;
  nextCueId: string | null;
  nextCueCountdown: number | null;
}

export interface DeviceStatusUpdate {
  devices: DeviceConnection[];
}

// ---------------------------------------------------------------------------
// WebSocket Events (Frontend -> Backend)
// ---------------------------------------------------------------------------

export type TransportCommand = 'play' | 'pause' | 'stop' | 'reset';

export interface SetClockMode {
  mode: ClockMode;
}
