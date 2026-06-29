import React from 'react';
import type { TransportState, TransportCommand, ClockMode } from '../types';
import './TransportControls.css';

interface TransportControlsProps {
  transportState: TransportState;
  clockMode: ClockMode;
  onTransportCommand: (command: TransportCommand) => void;
}

export const TransportControls: React.FC<TransportControlsProps> = ({
  transportState,
  clockMode,
  onTransportCommand,
}) => {
  if (clockMode !== 'internal') {
    return null;
  }

  const isPlaying = transportState === 'playing';
  const isStopped = transportState === 'stopped';

  return (
    <div className="transport-controls">
      <button
        className="transport-btn"
        onClick={() => onTransportCommand('reset')}
        title="Reset to 00:00:00:00"
        type="button"
      >
        <span className="material-symbols-outlined">skip_previous</span>
      </button>

      <button
        className={`transport-btn ${isPlaying ? 'transport-btn--active' : ''}`}
        onClick={() => onTransportCommand(isPlaying ? 'pause' : 'play')}
        title={isPlaying ? 'Pause' : 'Play'}
        type="button"
      >
        <span className="material-symbols-outlined">
          {isPlaying ? 'pause' : 'play_arrow'}
        </span>
      </button>

      <button
        className={`transport-btn ${isStopped ? 'transport-btn--stop-active' : ''}`}
        onClick={() => onTransportCommand('stop')}
        title="Stop"
        type="button"
      >
        <span className="material-symbols-outlined">stop</span>
      </button>
    </div>
  );
};
