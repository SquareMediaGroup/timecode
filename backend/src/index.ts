/**
 * Timecode OS -- Main backend entry point.
 *
 * Boots the Express HTTP server, WebSocket server, mDNS broadcast,
 * and wires together the timecode generator, PLL filter, cue manager,
 * and all protocol drivers.
 */

import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import { createServer } from 'node:http';
import { Server as SocketIOServer } from 'socket.io';
import { Bonjour } from 'bonjour-service';

import { TimecodeGenerator, formatTimecode } from './timecode/generator.js';
import { PLLFilter } from './timecode/pll.js';
import { MTCReceiver } from './timecode/rtpmidi.js';
import { CueManager } from './cues/manager.js';
import { AvolitesDriver } from './protocols/avolites.js';
import { ProPresenterDriver } from './protocols/propresenter.js';
import { AtemDriver } from './protocols/atem.js';
import { GldDriver } from './protocols/gld.js';

import type {
  Cue,
  ClockMode,
  DeviceConnection,
  DeviceStatusUpdate,
  DeviceType,
  FrameRate,
  TimecodeUpdate,
  TransportCommand,
} from './types.js';

// ---------------------------------------------------------------------------
// __dirname polyfill for ESM
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

interface DeviceSettings {
  type: DeviceType;
  host: string;
  port: number;
  enabled: boolean;
}

interface Settings {
  frameRate: FrameRate;
  clockMode: ClockMode;
  devices: DeviceSettings[];
  httpPort: number;
  wsPort: number;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const SETTINGS_PATH = path.join(DATA_DIR, 'settings.json');

const DEFAULT_SETTINGS: Settings = {
  frameRate: 25,
  clockMode: 'internal',
  devices: [
    { type: 'avolites', host: '192.168.1.100', port: 7000, enabled: false },
    { type: 'propresenter', host: '192.168.1.101', port: 1025, enabled: false },
    { type: 'atem', host: '192.168.1.102', port: 9910, enabled: false },
    { type: 'gld', host: '192.168.1.103', port: 51325, enabled: false },
  ],
  httpPort: 3000,
  wsPort: 3001,
};

function loadSettings(): Settings {
  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      const raw = fs.readFileSync(SETTINGS_PATH, 'utf-8');
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    }
  } catch (err) {
    console.warn('[Settings] Failed to load settings, using defaults:', err);
  }
  return { ...DEFAULT_SETTINGS };
}

function saveSettings(settings: Settings): void {
  try {
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Settings] Failed to save settings:', err);
  }
}

// ---------------------------------------------------------------------------
// Driver registry helpers
// ---------------------------------------------------------------------------

type AnyDriver = AvolitesDriver | ProPresenterDriver | AtemDriver | GldDriver;

function createDrivers(settings: Settings): Map<DeviceType, AnyDriver> {
  const map = new Map<DeviceType, AnyDriver>();

  for (const dev of settings.devices) {
    switch (dev.type) {
      case 'avolites':
        map.set('avolites', new AvolitesDriver({ host: dev.host, port: dev.port, enabled: dev.enabled }));
        break;
      case 'propresenter':
        map.set('propresenter', new ProPresenterDriver({ host: dev.host, port: dev.port, enabled: dev.enabled }));
        break;
      case 'atem':
        map.set('atem', new AtemDriver({ host: dev.host, port: dev.port, enabled: dev.enabled }));
        break;
      case 'gld':
        map.set('gld', new GldDriver({ host: dev.host, port: dev.port, enabled: dev.enabled }));
        break;
    }
  }

  return map;
}

function getDeviceStatuses(drivers: Map<DeviceType, AnyDriver>): DeviceConnection[] {
  const statuses: DeviceConnection[] = [];
  for (const driver of drivers.values()) {
    statuses.push(driver.getStatus());
  }
  return statuses;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  // Ensure data directory
  fs.mkdirSync(DATA_DIR, { recursive: true });

  // Load settings
  let settings = loadSettings();
  saveSettings(settings); // Persist defaults if first run

  // -- Timecode engine ------------------------------------------------------

  const generator = new TimecodeGenerator();
  generator.setFrameRate(settings.frameRate);

  const pll = new PLLFilter({ freeRunFrameRate: settings.frameRate });

  // -- Network MTC Receiver -------------------------------------------------
  
  const mtcReceiver = new MTCReceiver(5004, 'Timecode OS');
  mtcReceiver.on('timecode', (tc, frameRate) => {
    if (settings.clockMode === 'mtc') {
      pll.feed(tc, frameRate);
    }
  });

  // -- Cue manager ----------------------------------------------------------

  const cueManager = new CueManager(path.join(DATA_DIR, 'cues.json'));
  await cueManager.init();

  // -- Protocol drivers -----------------------------------------------------

  const drivers = createDrivers(settings);

  // -- Express HTTP server --------------------------------------------------

  const app = express();
  app.use(cors());
  app.use(express.json());

  // Serve frontend static files
  const frontendDir = path.join(__dirname, '../../frontend/dist');
  if (fs.existsSync(frontendDir)) {
    app.use(express.static(frontendDir));
  }

  // --- REST: Cues ----------------------------------------------------------

  app.get('/api/cues', (_req, res) => {
    res.json(cueManager.getCues());
  });

  app.post('/api/cues', async (req, res) => {
    try {
      const cue = await cueManager.addCue(req.body);
      res.status(201).json(cue);
      broadcastCueList();
    } catch (err) {
      res.status(400).json({ error: String(err) });
    }
  });

  app.put('/api/cues/:id', async (req, res) => {
    try {
      const updated = await cueManager.updateCue(req.params.id, req.body);
      if (!updated) {
        res.status(404).json({ error: 'Cue not found' });
        return;
      }
      res.json(updated);
      broadcastCueList();
    } catch (err) {
      res.status(400).json({ error: String(err) });
    }
  });

  app.delete('/api/cues/:id', async (req, res) => {
    const deleted = await cueManager.deleteCue(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: 'Cue not found' });
      return;
    }
    res.status(204).send();
    broadcastCueList();
  });

  // --- REST: Settings ------------------------------------------------------

  app.get('/api/settings', (_req, res) => {
    res.json(settings);
  });

  app.put('/api/settings', async (req, res) => {
    try {
      const newSettings: Settings = { ...settings, ...req.body };
      settings = newSettings;
      saveSettings(settings);

      // Apply frame rate
      generator.setFrameRate(settings.frameRate);

      // Reconnect drivers if device config changed
      for (const devConfig of settings.devices) {
        const driver = drivers.get(devConfig.type);
        if (driver) {
          driver.updateConfig({ host: devConfig.host, port: devConfig.port, enabled: devConfig.enabled });
          await driver.disconnect();
          if (devConfig.enabled) {
            await driver.connect();
          }
        }
      }

      res.json(settings);
      broadcastDeviceStatus();
    } catch (err) {
      res.status(400).json({ error: String(err) });
    }
  });

  // --- REST: Devices -------------------------------------------------------

  app.get('/api/devices', (_req, res) => {
    res.json(getDeviceStatuses(drivers));
  });

  // SPA fallback
  app.get('*', (_req, res) => {
    const indexPath = path.join(frontendDir, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).json({ error: 'Frontend not built' });
    }
  });

  // -- Socket.IO server ----------------------------------------------------

  const httpServer = createServer(app);
  const io = new SocketIOServer(httpServer, {
    cors: { origin: '*' },
    transports: ['websocket'],
  });

  function broadcast(event: string, data: unknown): void {
    io.emit(event, data);
  }

  function broadcastCueList(): void {
    broadcast('cueList', cueManager.getCues());
  }

  function broadcastDeviceStatus(): void {
    const update: DeviceStatusUpdate = { devices: getDeviceStatuses(drivers) };
    broadcast('deviceStatus', update);
  }

  io.on('connection', (socket) => {
    // Send initial state to the newly connected client
    const tcUpdate = buildTimecodeUpdate();
    socket.emit('timecode', tcUpdate);
    socket.emit('cueList', cueManager.getCues());
    socket.emit('deviceStatus', { devices: getDeviceStatuses(drivers) } as DeviceStatusUpdate);

    // Transport commands
    socket.on('transportCommand', (data: { command: TransportCommand }) => {
      switch (data.command) {
        case 'play':
          generator.play();
          break;
        case 'pause':
          generator.pause();
          break;
        case 'stop':
          generator.stop();
          cueManager.resetTriggers();
          break;
        case 'reset':
          generator.reset();
          cueManager.resetTriggers();
          break;
      }
    });

    // Clock mode
    socket.on('setClockMode', (data: { mode: ClockMode }) => {
      settings.clockMode = data.mode;
      saveSettings(settings);
    });

    // Frame rate
    socket.on('setFrameRate', (data: { rate: FrameRate }) => {
      settings.frameRate = data.rate;
      generator.setFrameRate(data.rate);
      saveSettings(settings);
    });

    // Manual timecode set
    socket.on('setTimecode', (timecode: { hours: number; minutes: number; seconds: number; frames: number }) => {
      generator.setTimecode(timecode);
    });
  });

  function buildTimecodeUpdate(): TimecodeUpdate {
    const tc = generator.getCurrentTimecode();
    return {
      timecode: tc,
      formatted: formatTimecode(tc, generator.getFrameRate()),
      clockMode: settings.clockMode,
      transportState: generator.getState(),
      frameRate: generator.getFrameRate(),
    };
  }

  // -- Event wiring ---------------------------------------------------------

  // Timecode frames -> broadcast + cue checking
  generator.on('frame', (update: TimecodeUpdate) => {
    broadcast('timecode', update);
    cueManager.checkFrame(update.timecode, update.frameRate);
  });

  // Cue triggers -> fire device actions
  cueManager.on('cue:trigger', (cue: Cue) => {
    console.log(`[Cue] Triggered: #${cue.number} "${cue.label}"`);

    const avolitesDriver = drivers.get('avolites') as AvolitesDriver | undefined;
    if (avolitesDriver && cue.avolites.enabled) {
      avolitesDriver.triggerCue(cue.avolites);
    }

    const ppDriver = drivers.get('propresenter') as ProPresenterDriver | undefined;
    if (ppDriver && cue.propresenter.enabled) {
      ppDriver.triggerCue(cue.propresenter);
    }

    const atemDriver = drivers.get('atem') as AtemDriver | undefined;
    if (atemDriver && cue.atem.enabled) {
      atemDriver.triggerCue(cue.atem);
    }

    const gldDriver = drivers.get('gld') as GldDriver | undefined;
    if (gldDriver && cue.gld.enabled) {
      gldDriver.triggerCue(cue.gld);
    }
  });

  // Cue state changes -> broadcast
  cueManager.on('cue:state', (state) => {
    broadcast('cueState', state);
  });

  // Device status changes -> broadcast
  for (const driver of drivers.values()) {
    driver.on('status', () => {
      broadcastDeviceStatus();
    });
  }

  // -- Connect enabled devices ----------------------------------------------

  for (const devConfig of settings.devices) {
    if (devConfig.enabled) {
      const driver = drivers.get(devConfig.type);
      if (driver) {
        driver.connect().catch((err) => {
          console.error(`[${devConfig.type}] Initial connect failed:`, err);
        });
      }
    }
  }

  // -- mDNS broadcast -------------------------------------------------------

  const bonjour = new Bonjour();
  bonjour.publish({
    name: 'Timecode OS',
    type: 'http',
    port: settings.httpPort,
  });

  // -- Start HTTP + Socket.IO server ---------------------------------------

  httpServer.listen(settings.httpPort, () => {
    console.log('');
    console.log('  Timecode OS v1.0.0 -- Backend Ready');
    console.log('  -----------------------------------');
    console.log(`  HTTP + WS : http://0.0.0.0:${settings.httpPort}`);
    console.log(`  mDNS      : Timecode OS (_http._tcp)`);
    console.log('');
  });

  // -- Graceful shutdown ----------------------------------------------------

  async function shutdown(signal: string): Promise<void> {
    console.log(`\n[Shutdown] Received ${signal}, shutting down...`);

    generator.destroy();
    pll.stop();
    mtcReceiver.destroy();

    for (const driver of drivers.values()) {
      await driver.disconnect();
    }

    io.close();
    httpServer.close();
    bonjour.destroy();

    console.log('[Shutdown] Complete.');
    process.exit(0);
  }

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

main().catch((err) => {
  console.error('[Fatal] Failed to start Timecode OS:', err);
  process.exit(1);
});
