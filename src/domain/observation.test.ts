import { classifyObservation, cueSpatiality, responseTiming } from './observation';
import { cue, NONE, obs, ORIENT_EYES } from '../test/fixtures';

describe('observation classification & cue provenance (acceptance 3, 4)', () => {
  it('orientation with no cues is spontaneous', () => {
    expect(classifyObservation([], obs(ORIENT_EYES))).toBe('spontaneous');
    expect(responseTiming([], obs(ORIENT_EYES))).toBe('no_cues_given');
  });

  it('a familiar name called after target appearance is NOT silently recorded as spontaneous', () => {
    const cues = [cue('first_name', 1)];
    expect(classifyObservation(cues, obs(ORIENT_EYES))).toBe('after_nonspatial_cue');
    expect(responseTiming(cues, obs(ORIENT_EYES))).toBe('after_cue');
  });

  it('name + "look left" is a spatial cue; name alone is non-spatial', () => {
    expect(cueSpatiality('first_name')).toBe('nonspatial');
    expect(cueSpatiality('nickname')).toBe('nonspatial');
    expect(cueSpatiality('name_plus_left')).toBe('spatial');
    expect(classifyObservation([cue('name_plus_left')], obs(ORIENT_EYES))).toBe('after_spatial_cue');
  });

  it('mixed name then visual cue counts as spatially cued', () => {
    expect(classifyObservation([cue('nickname', 1), cue('visual', 2)], obs(ORIENT_EYES))).toBe('after_spatial_cue');
  });

  it('only an explicit caregiver assertion makes a cued trial "before first cue"', () => {
    const cues = [cue('visual')];
    const o = obs(ORIENT_EYES, { caregiverSaysBeforeFirstCue: true });
    expect(responseTiming(cues, o)).toBe('before_first_cue');
    expect(classifyObservation(cues, o)).toBe('spontaneous');
  });

  it('no response, uncertain and fatigue stay distinct and never become a gaze event', () => {
    expect(classifyObservation([], obs(NONE))).toBe('no_response_observed');
    expect(classifyObservation([], obs({ kind: 'cannot_determine', reason: 'fatigue' }))).toBe('cannot_determine');
    expect(classifyObservation([], obs({ kind: 'oriented', modality: 'unclear_kind' }))).toBe('cannot_determine');
    expect(classifyObservation([], obs(ORIENT_EYES, { flags: { fatigue: true, discomfort: false, poorVisibility: false, lostEngagement: false } }))).toBe('cannot_determine');
  });

  it('head turn and eye shift are stored as different modalities', () => {
    const head = obs({ kind: 'oriented', modality: 'head' });
    const eyes = obs({ kind: 'oriented', modality: 'eyes' });
    expect(head.outcome).not.toEqual(eyes.outcome);
    expect(head.outcome.kind === 'oriented' && head.outcome.modality).toBe('head');
  });
});
