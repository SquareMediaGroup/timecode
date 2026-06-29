import React, { useState, useEffect } from 'react';
import type {
  Cue,
  Timecode,
  AvolitesAction,
  AvolitesProtocol,
  ProPresenterAction,
  ProPresenterTriggerType,
  AtemAction,
  AtemTriggerType,
  GldAction,
  GldTriggerType,
} from '../types';
import './CueEditor.css';

interface CueEditorProps {
  cue: Cue | null;
  onClose: () => void;
  onSave: (cue: Cue) => void;
}

function defaultTimecode(): Timecode {
  return { hours: 0, minutes: 0, seconds: 0, frames: 0 };
}

function defaultCue(): Cue {
  return {
    id: crypto.randomUUID(),
    number: 1,
    label: '',
    triggerTimecode: defaultTimecode(),
    avolites: { enabled: false, protocol: 'osc' },
    propresenter: { enabled: false, triggerType: 'slide_index' },
    atem: { enabled: false, triggerType: 'cut' },
    gld: { enabled: false, triggerType: 'recall_scene' },
  };
}

function formatTimecodeInput(tc: Timecode): string {
  return [
    String(tc.hours).padStart(2, '0'),
    String(tc.minutes).padStart(2, '0'),
    String(tc.seconds).padStart(2, '0'),
    String(tc.frames).padStart(2, '0'),
  ].join(':');
}

function parseTimecodeInput(value: string): Timecode {
  const parts = value.split(':').map(Number);
  return {
    hours: parts[0] || 0,
    minutes: parts[1] || 0,
    seconds: parts[2] || 0,
    frames: parts[3] || 0,
  };
}

export const CueEditor: React.FC<CueEditorProps> = ({
  cue,
  onClose,
  onSave,
}) => {
  const [formData, setFormData] = useState<Cue>(defaultCue());
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    avolites: false,
    propresenter: false,
    atem: false,
    gld: false,
  });

  useEffect(() => {
    setFormData(cue ? { ...cue } : defaultCue());
  }, [cue]);

  const isEditing = !!cue;

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleSave = () => {
    onSave(formData);
    onClose();
  };

  const updateField = <K extends keyof Cue>(key: K, value: Cue[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const updateAvolites = (updates: Partial<AvolitesAction>) => {
    setFormData((prev) => ({
      ...prev,
      avolites: { ...prev.avolites, ...updates },
    }));
  };

  const updateProPresenter = (updates: Partial<ProPresenterAction>) => {
    setFormData((prev) => ({
      ...prev,
      propresenter: { ...prev.propresenter, ...updates },
    }));
  };

  const updateAtem = (updates: Partial<AtemAction>) => {
    setFormData((prev) => ({
      ...prev,
      atem: { ...prev.atem, ...updates },
    }));
  };

  const updateGld = (updates: Partial<GldAction>) => {
    setFormData((prev) => ({
      ...prev,
      gld: { ...prev.gld, ...updates },
    }));
  };

  return (
    <div className="cue-editor__overlay" onClick={handleOverlayClick}>
      <div className="cue-editor__panel">
        <div className="cue-editor__header">
          <span className="cue-editor__title">
            {isEditing ? `Edit Cue ${formData.number}` : 'New Cue'}
          </span>
          <button
            className="btn btn-icon cue-editor__close"
            onClick={onClose}
            type="button"
            title="Close"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="cue-editor__body">
          {/* Core fields */}
          <div className="cue-editor__field-row">
            <div className="cue-editor__field-group">
              <label className="cue-editor__label">Cue Number</label>
              <input
                className="input"
                type="number"
                min={1}
                value={formData.number}
                onChange={(e) => updateField('number', parseInt(e.target.value) || 1)}
              />
            </div>
            <div className="cue-editor__field-group">
              <label className="cue-editor__label">Trigger Timecode</label>
              <input
                className="input input-mono"
                type="text"
                placeholder="00:00:00:00"
                value={formatTimecodeInput(formData.triggerTimecode)}
                onChange={(e) => updateField('triggerTimecode', parseTimecodeInput(e.target.value))}
              />
            </div>
          </div>

          <div className="cue-editor__field-group">
            <label className="cue-editor__label">Label</label>
            <input
              className="input"
              type="text"
              placeholder="Cue label"
              value={formData.label}
              onChange={(e) => updateField('label', e.target.value)}
            />
          </div>

          <div className="cue-editor__field-group">
            <label className="cue-editor__label">Scene Divider (optional)</label>
            <input
              className="input"
              type="text"
              placeholder="e.g. Song 1, Sermon"
              value={formData.sceneDivider || ''}
              onChange={(e) => updateField('sceneDivider', e.target.value || undefined)}
            />
          </div>

          {/* --- Avolites --------------------------------------------------- */}
          <div className="cue-editor__device-section">
            <div className="cue-editor__device-header" onClick={() => toggleSection('avolites')}>
              <div className="cue-editor__device-header-left">
                <span className="material-symbols-outlined">tungsten</span>
                <span>Avolites</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  type="button"
                  className={`cue-editor__device-toggle ${formData.avolites.enabled ? 'cue-editor__device-toggle--on' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    updateAvolites({ enabled: !formData.avolites.enabled });
                  }}
                  title={formData.avolites.enabled ? 'Disable' : 'Enable'}
                />
                <div className={`cue-editor__device-chevron ${expandedSections.avolites ? 'cue-editor__device-chevron--open' : ''}`}>
                  <span className="material-symbols-outlined">expand_more</span>
                </div>
              </div>
            </div>
            {expandedSections.avolites && (
              <div className="cue-editor__device-body">
                <div className="cue-editor__field-group">
                  <label className="cue-editor__label">Protocol</label>
                  <select
                    className="select"
                    value={formData.avolites.protocol}
                    onChange={(e) => updateAvolites({ protocol: e.target.value as AvolitesProtocol })}
                  >
                    <option value="osc">OSC</option>
                    <option value="artnet_timecode">Art-Net Timecode</option>
                  </select>
                </div>
                {formData.avolites.protocol === 'osc' && (
                  <>
                    <div className="cue-editor__field-group">
                      <label className="cue-editor__label">OSC Path</label>
                      <input
                        className="input input-mono"
                        type="text"
                        placeholder="/cue/list/1/trigger/10"
                        value={formData.avolites.oscPath || ''}
                        onChange={(e) => updateAvolites({ oscPath: e.target.value })}
                      />
                    </div>
                    <div className="cue-editor__field-group">
                      <label className="cue-editor__label">OSC Value</label>
                      <input
                        className="input"
                        type="text"
                        placeholder="Value"
                        value={formData.avolites.oscValue ?? ''}
                        onChange={(e) => updateAvolites({ oscValue: e.target.value })}
                      />
                    </div>
                  </>
                )}
                {formData.avolites.protocol === 'artnet_timecode' && (
                  <div className="cue-editor__field-group">
                    <label className="cue-editor__label">Art-Net Cuelist</label>
                    <input
                      className="input"
                      type="number"
                      min={0}
                      value={formData.avolites.artnetCuelist ?? ''}
                      onChange={(e) => updateAvolites({ artnetCuelist: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* --- ProPresenter ----------------------------------------------- */}
          <div className="cue-editor__device-section">
            <div className="cue-editor__device-header" onClick={() => toggleSection('propresenter')}>
              <div className="cue-editor__device-header-left">
                <span className="material-symbols-outlined">slideshow</span>
                <span>ProPresenter</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  type="button"
                  className={`cue-editor__device-toggle ${formData.propresenter.enabled ? 'cue-editor__device-toggle--on' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    updateProPresenter({ enabled: !formData.propresenter.enabled });
                  }}
                  title={formData.propresenter.enabled ? 'Disable' : 'Enable'}
                />
                <div className={`cue-editor__device-chevron ${expandedSections.propresenter ? 'cue-editor__device-chevron--open' : ''}`}>
                  <span className="material-symbols-outlined">expand_more</span>
                </div>
              </div>
            </div>
            {expandedSections.propresenter && (
              <div className="cue-editor__device-body">
                <div className="cue-editor__field-group">
                  <label className="cue-editor__label">Trigger Type</label>
                  <select
                    className="select"
                    value={formData.propresenter.triggerType}
                    onChange={(e) => updateProPresenter({ triggerType: e.target.value as ProPresenterTriggerType })}
                  >
                    <option value="slide_index">Slide Index</option>
                    <option value="macro">Macro</option>
                  </select>
                </div>
                {formData.propresenter.triggerType === 'slide_index' && (
                  <div className="cue-editor__field-group">
                    <label className="cue-editor__label">Slide Index</label>
                    <input
                      className="input"
                      type="number"
                      min={0}
                      value={formData.propresenter.slideIndex ?? ''}
                      onChange={(e) => updateProPresenter({ slideIndex: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                )}
                {formData.propresenter.triggerType === 'macro' && (
                  <div className="cue-editor__field-group">
                    <label className="cue-editor__label">Macro ID</label>
                    <input
                      className="input"
                      type="text"
                      placeholder="UUID or name"
                      value={formData.propresenter.macroId || ''}
                      onChange={(e) => updateProPresenter({ macroId: e.target.value })}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* --- ATEM ------------------------------------------------------- */}
          <div className="cue-editor__device-section">
            <div className="cue-editor__device-header" onClick={() => toggleSection('atem')}>
              <div className="cue-editor__device-header-left">
                <span className="material-symbols-outlined">videocam</span>
                <span>ATEM</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  type="button"
                  className={`cue-editor__device-toggle ${formData.atem.enabled ? 'cue-editor__device-toggle--on' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    updateAtem({ enabled: !formData.atem.enabled });
                  }}
                  title={formData.atem.enabled ? 'Disable' : 'Enable'}
                />
                <div className={`cue-editor__device-chevron ${expandedSections.atem ? 'cue-editor__device-chevron--open' : ''}`}>
                  <span className="material-symbols-outlined">expand_more</span>
                </div>
              </div>
            </div>
            {expandedSections.atem && (
              <div className="cue-editor__device-body">
                <div className="cue-editor__field-group">
                  <label className="cue-editor__label">Trigger Type</label>
                  <select
                    className="select"
                    value={formData.atem.triggerType}
                    onChange={(e) => updateAtem({ triggerType: e.target.value as AtemTriggerType })}
                  >
                    <option value="cut">Cut</option>
                    <option value="auto">Auto</option>
                    <option value="macro">Macro</option>
                  </select>
                </div>
                {(formData.atem.triggerType === 'cut' || formData.atem.triggerType === 'auto') && (
                  <div className="cue-editor__field-group">
                    <label className="cue-editor__label">Input Source</label>
                    <input
                      className="input"
                      type="number"
                      min={1}
                      value={formData.atem.inputSource ?? ''}
                      onChange={(e) => updateAtem({ inputSource: parseInt(e.target.value) || 1 })}
                    />
                  </div>
                )}
                {formData.atem.triggerType === 'macro' && (
                  <div className="cue-editor__field-group">
                    <label className="cue-editor__label">Macro Index</label>
                    <input
                      className="input"
                      type="number"
                      min={0}
                      value={formData.atem.macroIndex ?? ''}
                      onChange={(e) => updateAtem({ macroIndex: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* --- GLD -------------------------------------------------------- */}
          <div className="cue-editor__device-section">
            <div className="cue-editor__device-header" onClick={() => toggleSection('gld')}>
              <div className="cue-editor__device-header-left">
                <span className="material-symbols-outlined">graphic_eq</span>
                <span>GLD</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  type="button"
                  className={`cue-editor__device-toggle ${formData.gld.enabled ? 'cue-editor__device-toggle--on' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    updateGld({ enabled: !formData.gld.enabled });
                  }}
                  title={formData.gld.enabled ? 'Disable' : 'Enable'}
                />
                <div className={`cue-editor__device-chevron ${expandedSections.gld ? 'cue-editor__device-chevron--open' : ''}`}>
                  <span className="material-symbols-outlined">expand_more</span>
                </div>
              </div>
            </div>
            {expandedSections.gld && (
              <div className="cue-editor__device-body">
                <div className="cue-editor__field-group">
                  <label className="cue-editor__label">Trigger Type</label>
                  <select
                    className="select"
                    value={formData.gld.triggerType}
                    onChange={(e) => updateGld({ triggerType: e.target.value as GldTriggerType })}
                  >
                    <option value="recall_scene">Recall Scene</option>
                    <option value="mute_channel">Mute Channel</option>
                  </select>
                </div>
                {formData.gld.triggerType === 'recall_scene' && (
                  <div className="cue-editor__field-group">
                    <label className="cue-editor__label">Scene Number</label>
                    <input
                      className="input"
                      type="number"
                      min={1}
                      value={formData.gld.sceneNumber ?? ''}
                      onChange={(e) => updateGld({ sceneNumber: parseInt(e.target.value) || 1 })}
                    />
                  </div>
                )}
                {formData.gld.triggerType === 'mute_channel' && (
                  <>
                    <div className="cue-editor__field-group">
                      <label className="cue-editor__label">Channel Number</label>
                      <input
                        className="input"
                        type="number"
                        min={1}
                        value={formData.gld.channelNumber ?? ''}
                        onChange={(e) => updateGld({ channelNumber: parseInt(e.target.value) || 1 })}
                      />
                    </div>
                    <div className="cue-editor__checkbox-field">
                      <input
                        type="checkbox"
                        id="gld-muted"
                        checked={formData.gld.muted ?? false}
                        onChange={(e) => updateGld({ muted: e.target.checked })}
                      />
                      <label htmlFor="gld-muted">Muted</label>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="cue-editor__footer">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSave}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>save</span>
            {isEditing ? 'Save Changes' : 'Add Cue'}
          </button>
        </div>
      </div>
    </div>
  );
};
