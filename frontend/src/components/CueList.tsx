import React, { useEffect, useRef } from 'react';
import type { Cue, CueStateUpdate, CueStatus, DeviceType } from '../types';
import './CueList.css';

interface CueListProps {
  cues: Cue[];
  cueState: CueStateUpdate | null;
  onEditCue: (cue: Cue) => void;
  onDeleteCue: (cueId: string) => void;
}

/** Material icon name for each device type */
const DEVICE_ICONS: Record<DeviceType, string> = {
  avolites: 'tungsten',
  propresenter: 'slideshow',
  atem: 'videocam',
  gld: 'graphic_eq',
};

const DEVICE_ORDER: DeviceType[] = ['avolites', 'propresenter', 'atem', 'gld'];

function formatTimecode(cue: Cue): string {
  const tc = cue.triggerTimecode;
  return [
    String(tc.hours).padStart(2, '0'),
    String(tc.minutes).padStart(2, '0'),
    String(tc.seconds).padStart(2, '0'),
    String(tc.frames).padStart(2, '0'),
  ].join(':');
}



function isDeviceEnabled(cue: Cue, device: DeviceType): boolean {
  switch (device) {
    case 'avolites': return cue.avolites.enabled;
    case 'propresenter': return cue.propresenter.enabled;
    case 'atem': return cue.atem.enabled;
    case 'gld': return cue.gld.enabled;
  }
}

export const CueList: React.FC<CueListProps> = ({
  cues,
  cueState,
  onEditCue,
  onDeleteCue,
}) => {
  const activeRowRef = useRef<HTMLTableRowElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to keep the active cue centered
  useEffect(() => {
    if (activeRowRef.current && containerRef.current) {
      activeRowRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [cueState?.activeCueId]);

  if (cues.length === 0) {
    return (
      <div className="cue-list" ref={containerRef}>
        <div className="cue-list__empty">
          <span className="material-symbols-outlined">playlist_add</span>
          <span>No cues configured</span>
        </div>
      </div>
    );
  }

  // Track which scene dividers we've already rendered
  const renderedScenes = new Set<string>();

  // Determine active cue index for passed/upcoming logic
  const activeCueIndex = cueState?.activeCueId
    ? cues.findIndex((c) => c.id === cueState.activeCueId)
    : -1;

  return (
    <div className="cue-list" ref={containerRef}>
      <table className="cue-list__table">
        <thead>
          <tr>
            <th>#</th>
            <th>Timecode</th>
            <th>Label</th>
            <th>Targets</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {cues.map((cue, index) => {
            const rows: React.ReactNode[] = [];

            // Render scene divider if present and not yet shown
            if (cue.sceneDivider && !renderedScenes.has(cue.sceneDivider)) {
              renderedScenes.add(cue.sceneDivider);
              rows.push(
                <tr className="cue-list__scene-divider" key={`scene-${cue.id}`}>
                  <td colSpan={5}>{cue.sceneDivider}</td>
                </tr>
              );
            }

            // Determine status
            let status: CueStatus;
            if (activeCueIndex >= 0) {
              if (index < activeCueIndex) status = 'passed';
              else if (index === activeCueIndex) status = 'active';
              else status = 'upcoming';
            } else {
              status = 'upcoming';
            }

            const isActive = status === 'active';

            rows.push(
              <tr
                key={cue.id}
                className={`cue-list__row cue-list__row--${status}`}
                ref={isActive ? activeRowRef : undefined}
              >
                <td>
                  <span className="cue-list__number">{cue.number}</span>
                </td>
                <td>
                  <span className="cue-list__timecode mono">{formatTimecode(cue)}</span>
                </td>
                <td>{cue.label}</td>
                <td>
                  <div className="cue-list__targets">
                    {DEVICE_ORDER.map((device) => {
                      const enabled = isDeviceEnabled(cue, device);
                      if (!enabled) return null;
                      return (
                        <span
                          key={device}
                          className={`material-symbols-outlined cue-list__target-icon cue-list__target-icon--enabled`}
                          title={device}
                        >
                          {DEVICE_ICONS[device]}
                        </span>
                      );
                    })}
                  </div>
                </td>
                <td>
                  <div className="cue-list__actions">
                    <button
                      className="cue-list__action-btn"
                      onClick={() => onEditCue(cue)}
                      title="Edit cue"
                      type="button"
                    >
                      <span className="material-symbols-outlined">edit</span>
                    </button>
                    <button
                      className="cue-list__action-btn"
                      onClick={() => onDeleteCue(cue.id)}
                      title="Delete cue"
                      type="button"
                    >
                      <span className="material-symbols-outlined">delete</span>
                    </button>
                  </div>
                </td>
              </tr>
            );

            return rows;
          })}
        </tbody>
      </table>
    </div>
  );
};
