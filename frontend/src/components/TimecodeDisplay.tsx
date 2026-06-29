import React from 'react';
import type { Cue, CueStateUpdate, FrameRate } from '../types';
import './TimecodeDisplay.css';

interface TimecodeDisplayProps {
  formatted: string;
  frameRate: FrameRate;
  cueState: CueStateUpdate | null;
  cues: Cue[];
}

function padTimecodeSegment(value: string): string {
  return value.padStart(2, '0');
}

function formatTimecodeSegments(formatted: string): { segments: string[]; separators: string[] } {
  const parts = formatted.split(/([:.;])/);
  const segments: string[] = [];
  const separators: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0) {
      segments.push(padTimecodeSegment(parts[i]));
    } else {
      separators.push(parts[i]);
    }
  }
  return { segments, separators };
}

export const TimecodeDisplay: React.FC<TimecodeDisplayProps> = ({
  formatted,
  frameRate,
  cueState,
  cues,
}) => {
  const display = formatted || '00:00:00:00';
  const { segments, separators } = formatTimecodeSegments(display);

  const nextCue = cueState?.nextCueId
    ? cues.find((c) => c.id === cueState.nextCueId)
    : null;

  const countdown = cueState?.nextCueCountdown;
  const progressPercent =
    countdown !== null && countdown !== undefined && countdown > 0
      ? Math.max(0, Math.min(100, 100 - (countdown / 30) * 100))
      : 0;

  const fpsLabel = frameRate === 29.97 ? '29.97 FPS' : `${frameRate} FPS`;

  return (
    <div className="timecode-display">
      <span className="timecode-display__fps-badge">{fpsLabel}</span>

      <div className="timecode-display__clock mono" aria-label={`Timecode: ${display}`}>
        {segments.map((seg, i) => (
          <React.Fragment key={i}>
            <span>{seg}</span>
            {separators[i] && (
              <span className="timecode-display__clock-separator">{separators[i]}</span>
            )}
          </React.Fragment>
        ))}
      </div>

      <div className="timecode-display__progress-wrap">
        <div className="timecode-display__progress-track">
          <div
            className="timecode-display__progress-fill"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {nextCue ? (
        <div className="timecode-display__next-cue">
          <span>Next: </span>
          <span className="timecode-display__next-cue-label">
            Cue {nextCue.number} - {nextCue.label}
          </span>
          {countdown !== null && countdown !== undefined && (
            <span className="timecode-display__next-cue-countdown">
              in {countdown.toFixed(1)}s
            </span>
          )}
        </div>
      ) : (
        <div className="timecode-display__idle">No upcoming cues</div>
      )}
    </div>
  );
};
