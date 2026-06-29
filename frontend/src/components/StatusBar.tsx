import React from 'react';
import type { DeviceConnection, ClockMode, DeviceType } from '../types';
import './StatusBar.css';

interface StatusBarProps {
  devices: DeviceConnection[];
  clockMode: ClockMode;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  viewMode: 'show' | 'programming';
  onToggleViewMode: () => void;
  onSettingsOpen?: () => void;
  projectLabel?: string;
}

const DEVICE_ORDER: DeviceType[] = ['avolites', 'propresenter', 'atem', 'gld'];

const DEVICE_LABELS: Record<DeviceType, string> = {
  avolites: 'Avolites',
  propresenter: 'ProPresenter',
  atem: 'ATEM',
  gld: 'GLD',
};

function getStatusDotClass(device: DeviceConnection | undefined): string {
  if (!device) return 'status-dot status-dot--disconnected';
  return `status-dot status-dot--${device.status}`;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  devices,
  clockMode,
  theme,
  onToggleTheme,
  viewMode,
  onToggleViewMode,
  onSettingsOpen,
  projectLabel,
}) => {
  const deviceMap = new Map(devices.map((d) => [d.type, d]));
  const syncLabel = clockMode === 'internal' ? 'INTERNAL' : 'MTC SYNC';

  return (
    <header className="status-bar">
      <div className="status-bar__left">
        <span className="status-bar__brand">TIMECODE</span>
        {projectLabel && (
          <span className="status-bar__project">{projectLabel}</span>
        )}
      </div>

      <div className="status-bar__center">
        {DEVICE_ORDER.map((type) => {
          const device = deviceMap.get(type);
          return (
            <div className="status-bar__device" key={type}>
              <span className={getStatusDotClass(device)} />
              <span>{DEVICE_LABELS[type]}</span>
            </div>
          );
        })}
      </div>

      <div className="status-bar__right">
        <span className="status-bar__sync-pill">
          <span className="material-symbols-outlined">
            {clockMode === 'internal' ? 'schedule' : 'sync'}
          </span>
          {syncLabel}
        </span>

        {onSettingsOpen && (
          <button
            className="status-bar__toggle-btn"
            onClick={onSettingsOpen}
            title="Settings"
            type="button"
          >
            <span className="material-symbols-outlined">settings</span>
          </button>
        )}

        <button
          className="status-bar__toggle-btn"
          onClick={onToggleTheme}
          title="Toggle theme"
          type="button"
        >
          <span className="material-symbols-outlined">
            {theme === 'light' ? 'dark_mode' : 'light_mode'}
          </span>
        </button>

        <button
          className={`status-bar__toggle-btn ${viewMode === 'programming' ? 'status-bar__toggle-btn--active' : ''}`}
          onClick={onToggleViewMode}
          title={viewMode === 'show' ? 'Switch to Programming mode' : 'Switch to Show mode'}
          type="button"
        >
          <span className="material-symbols-outlined">
            {viewMode === 'show' ? 'edit_note' : 'tv'}
          </span>
        </button>
      </div>
    </header>
  );
};
