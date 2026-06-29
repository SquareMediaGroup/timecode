import { useState, useCallback, useMemo } from 'react';
import { useSocket } from './hooks/useSocket';
import { useTheme } from './hooks/useTheme';
import { StatusBar } from './components/StatusBar';
import { TimecodeDisplay } from './components/TimecodeDisplay';
import { TransportControls } from './components/TransportControls';
import { CueList } from './components/CueList';
import { CueEditor } from './components/CueEditor';
import { SettingsPanel } from './components/SettingsPanel';
import type { Cue, Timecode } from './types';
import './App.css';

type ViewMode = 'show' | 'programming';

function formatTimecodeFromObj(tc: Timecode): string {
  const h = String(tc.hours).padStart(2, '0');
  const m = String(tc.minutes).padStart(2, '0');
  const s = String(tc.seconds).padStart(2, '0');
  const f = String(tc.frames).padStart(2, '0');
  return `${h}:${m}:${s}:${f}`;
}

function App() {
  /* ---------------------------------------------------------------------- */
  /* State                                                                   */
  /* ---------------------------------------------------------------------- */
  const [viewMode, setViewMode] = useState<ViewMode>('show');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [cueEditorOpen, setCueEditorOpen] = useState(false);
  const [editingCue, setEditingCue] = useState<Cue | null>(null);

  /* ---------------------------------------------------------------------- */
  /* Hooks                                                                   */
  /* ---------------------------------------------------------------------- */
  const { theme, toggleTheme } = useTheme();
  const {
    timecodeUpdate,
    cues,
    cueState,
    deviceStatuses,
    isConnected,
    sendTransportCommand,
    sendClockMode,
    sendFrameRate,
  } = useSocket();

  /* ---------------------------------------------------------------------- */
  /* Derived values                                                          */
  /* ---------------------------------------------------------------------- */
  const clockMode = timecodeUpdate?.clockMode ?? 'internal';
  const transportState = timecodeUpdate?.transportState ?? 'stopped';
  const frameRate = timecodeUpdate?.frameRate ?? 25;
  const formattedTimecode = timecodeUpdate?.formatted ?? '00:00:00:00';

  const nextCue = useMemo(() => {
    if (!cueState?.nextCueId) return null;
    return cues.find((c) => c.id === cueState.nextCueId) ?? null;
  }, [cues, cueState?.nextCueId]);



  /* ---------------------------------------------------------------------- */
  /* Callbacks                                                               */
  /* ---------------------------------------------------------------------- */
  const handleToggleViewMode = useCallback(() => {
    setViewMode((prev) => (prev === 'show' ? 'programming' : 'show'));
  }, []);

  const handleOpenSettings = useCallback(() => {
    setSettingsOpen(true);
  }, []);

  const handleCloseSettings = useCallback(() => {
    setSettingsOpen(false);
  }, []);

  const handleOpenNewCue = useCallback(() => {
    setEditingCue(null);
    setCueEditorOpen(true);
  }, []);

  const handleEditCue = useCallback((cue: Cue) => {
    setEditingCue(cue);
    setCueEditorOpen(true);
  }, []);

  const handleCloseCueEditor = useCallback(() => {
    setCueEditorOpen(false);
    setEditingCue(null);
  }, []);

  const handleSaveCue = useCallback((cue: Cue) => {
    // TODO: Send to backend via WebSocket or API
    console.log('Save cue:', cue);
    setCueEditorOpen(false);
    setEditingCue(null);
  }, []);

  /* ---------------------------------------------------------------------- */
  /* Render                                                                  */
  /* ---------------------------------------------------------------------- */
  return (
    <div className={`app app--${viewMode}`}>
      {/* -- Disconnected banner ----------------------------------------- */}
      {!isConnected && (
        <div className="app__disconnected">
          <span className="material-symbols-outlined">cloud_off</span>
          Disconnected from server
        </div>
      )}

      {/* -- Status Bar -------------------------------------------------- */}
      <StatusBar
        devices={deviceStatuses}
        clockMode={clockMode}
        theme={theme}
        onToggleTheme={toggleTheme}
        viewMode={viewMode}
        onToggleViewMode={handleToggleViewMode}
        onSettingsOpen={handleOpenSettings}
      />

      {/* -- Main Content ------------------------------------------------ */}
      <div className="app__content">
        {/* Timecode Display (both modes) */}
        <div className="app__timecode-wrap">
          <TimecodeDisplay
            formatted={formattedTimecode}
            frameRate={frameRate}
            cueState={cueState}
            cues={cues}
          />
        </div>

        {/* Show Mode: Next Cue strip */}
        {viewMode === 'show' && (
          <div className="app__next-cue-strip">
            <span className="material-symbols-outlined">skip_next</span>
            {nextCue ? (
              <>
                <span>Next:</span>
                <span className="app__next-cue-label">
                  Cue {nextCue.number} &mdash; {nextCue.label}
                </span>
                <span className="app__next-cue-tc">
                  {formatTimecodeFromObj(nextCue.triggerTimecode)}
                </span>
                {cueState?.nextCueCountdown != null && (
                  <span className="app__next-cue-countdown">
                    {cueState.nextCueCountdown.toFixed(1)}s
                  </span>
                )}
              </>
            ) : (
              <span className="app__next-cue-none">No upcoming cues</span>
            )}
          </div>
        )}

        {/* Programming Mode: Cue List */}
        {viewMode === 'programming' && (
          <div className="app__cue-list-wrap">
            <CueList
              cues={cues}
              cueState={cueState}
              onEditCue={handleEditCue}
              onDeleteCue={() => {}}
            />

            {/* Floating Add Button */}
            <button
              className="app__fab"
              onClick={handleOpenNewCue}
              title="Add cue"
              type="button"
            >
              <span className="material-symbols-outlined">add</span>
            </button>
          </div>
        )}
      </div>

      {/* -- Transport Controls (internal clock only) -------------------- */}
      <div className="app__transport-wrap">
        <TransportControls
          transportState={transportState}
          clockMode={clockMode}
          onTransportCommand={sendTransportCommand}
        />
      </div>

      {/* -- Settings Panel Overlay -------------------------------------- */}
      {settingsOpen && (
        <div className="app__overlay">
          <div
            className="app__overlay-backdrop"
            onClick={handleCloseSettings}
          />
          <div className="app__overlay-content">
            <SettingsPanel
              clockMode={clockMode}
              frameRate={frameRate}
              onClockModeChange={sendClockMode}
              onFrameRateChange={sendFrameRate}
              onClose={handleCloseSettings}
            />
          </div>
        </div>
      )}

      {/* -- Cue Editor Overlay ------------------------------------------ */}
      {cueEditorOpen && (
        <div className="app__overlay">
          <div
            className="app__overlay-backdrop"
            onClick={handleCloseCueEditor}
          />
          <div className="app__overlay-content">
            <CueEditor
              cue={editingCue}
              onClose={handleCloseCueEditor}
              onSave={handleSaveCue}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
