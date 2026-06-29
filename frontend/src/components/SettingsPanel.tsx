import React, { useState, useEffect } from 'react';
import type { DeviceType, FrameRate, ClockMode } from '../types';
import './SettingsPanel.css';

interface DeviceSettings {
  host: string;
  port: number;
  enabled: boolean;
}

interface SettingsData {
  devices: Record<DeviceType, DeviceSettings>;
  frameRate: FrameRate;
  clockMode: ClockMode;
}

interface SettingsPanelProps {
  clockMode: ClockMode;
  frameRate: FrameRate;
  onClockModeChange: (mode: ClockMode) => void;
  onFrameRateChange: (rate: FrameRate) => void;
  onClose: () => void;
}

const DEVICE_CONFIG: { type: DeviceType; label: string; icon: string; defaultPort: number }[] = [
  { type: 'avolites', label: 'Avolites', icon: 'tungsten', defaultPort: 7000 },
  { type: 'propresenter', label: 'ProPresenter', icon: 'slideshow', defaultPort: 1025 },
  { type: 'atem', label: 'ATEM', icon: 'videocam', defaultPort: 9910 },
  { type: 'gld', label: 'GLD', icon: 'graphic_eq', defaultPort: 51325 },
];

function defaultSettings(frameRate: FrameRate, clockMode: ClockMode): SettingsData {
  const devices: Record<string, DeviceSettings> = {};
  for (const cfg of DEVICE_CONFIG) {
    devices[cfg.type] = { host: '192.168.1.100', port: cfg.defaultPort, enabled: false };
  }
  return {
    devices: devices as Record<DeviceType, DeviceSettings>,
    frameRate,
    clockMode,
  };
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  clockMode,
  frameRate,
  onClockModeChange,
  onFrameRateChange,
  onClose,
}) => {
  const [settings, setSettings] = useState<SettingsData>(() =>
    defaultSettings(frameRate, clockMode),
  );

  useEffect(() => {
    setSettings((prev) => ({
      ...prev,
      frameRate,
      clockMode,
    }));
  }, [frameRate, clockMode]);

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const updateDevice = (type: DeviceType, updates: Partial<DeviceSettings>) => {
    setSettings((prev) => ({
      ...prev,
      devices: {
        ...prev.devices,
        [type]: { ...prev.devices[type], ...updates },
      },
    }));
  };

  const handleSave = async () => {
    try {
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      onClockModeChange(settings.clockMode);
      onFrameRateChange(settings.frameRate);
      onClose();
    } catch (err) {
      console.error('Failed to save settings:', err);
    }
  };

  return (
    <div className="settings-panel__overlay" onClick={handleOverlayClick}>
      <div className="settings-panel">
        <div className="settings-panel__header">
          <span className="settings-panel__title">Settings</span>
          <button
            className="settings-panel__close-btn"
            onClick={onClose}
            type="button"
            title="Close"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="settings-panel__body">
          {/* Device connections */}
          <div className="settings-panel__section">
            <span className="settings-panel__section-title">Device Connections</span>

            {DEVICE_CONFIG.map((cfg) => {
              const device = settings.devices[cfg.type];
              return (
                <div className="settings-panel__device-card" key={cfg.type}>
                  <div className="settings-panel__device-card-header">
                    <span className="settings-panel__device-card-label">
                      <span className="material-symbols-outlined">{cfg.icon}</span>
                      {cfg.label}
                    </span>
                    <button
                      type="button"
                      className={`settings-panel__toggle ${device.enabled ? 'settings-panel__toggle--on' : ''}`}
                      onClick={() => updateDevice(cfg.type, { enabled: !device.enabled })}
                      title={device.enabled ? 'Disable' : 'Enable'}
                    />
                  </div>
                  <div className="settings-panel__device-fields">
                    <div className="settings-panel__field-group">
                      <label className="settings-panel__label">Host IP</label>
                      <input
                        className="input input-mono"
                        type="text"
                        placeholder="192.168.1.100"
                        value={device.host}
                        onChange={(e) => updateDevice(cfg.type, { host: e.target.value })}
                      />
                    </div>
                    <div className="settings-panel__field-group settings-panel__field-group--port">
                      <label className="settings-panel__label">Port</label>
                      <input
                        className="input input-mono"
                        type="number"
                        min={1}
                        max={65535}
                        value={device.port}
                        onChange={(e) => updateDevice(cfg.type, { port: parseInt(e.target.value) || cfg.defaultPort })}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* General settings */}
          <div className="settings-panel__section">
            <span className="settings-panel__section-title">General</span>
            <div className="settings-panel__general-row">
              <div className="settings-panel__field-group">
                <label className="settings-panel__label">Frame Rate</label>
                <select
                  className="select"
                  value={settings.frameRate}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      frameRate: parseFloat(e.target.value) as FrameRate,
                    }))
                  }
                >
                  <option value={24}>24 FPS</option>
                  <option value={25}>25 FPS</option>
                  <option value={29.97}>29.97 FPS</option>
                  <option value={30}>30 FPS</option>
                </select>
              </div>
              <div className="settings-panel__field-group">
                <label className="settings-panel__label">Clock Mode</label>
                <select
                  className="select"
                  value={settings.clockMode}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      clockMode: e.target.value as ClockMode,
                    }))
                  }
                >
                  <option value="internal">Internal</option>
                  <option value="mtc">MTC</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="settings-panel__footer">
          <button className="btn" onClick={onClose} type="button">
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleSave} type="button">
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>save</span>
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
};
