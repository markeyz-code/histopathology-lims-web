import {
  allowedNextStates,
  canCaseTransition,
  canTransition,
  checkTransition,
  inferScanTarget,
  stationTarget,
} from '@lims/shared';

describe('physical custody state machine', () => {
  it('walks a block from accession to archive', () => {
    expect(canTransition('BLOCK', 'ACCESSIONED', 'GROSSED')).toBe(true);
    expect(canTransition('BLOCK', 'GROSSED', 'PROCESSING')).toBe(true);
    expect(canTransition('BLOCK', 'PROCESSING', 'EMBEDDED')).toBe(true);
    expect(canTransition('BLOCK', 'EMBEDDED', 'CUT')).toBe(true);
    expect(canTransition('BLOCK', 'CUT', 'REPORTED')).toBe(true);
    expect(canTransition('BLOCK', 'REPORTED', 'ARCHIVED')).toBe(true);
    expect(canTransition('BLOCK', 'ARCHIVED', 'CUT')).toBe(false);
  });

  it('rejects a backwards or skipped transition with a useful reason', () => {
    const result = checkTransition('BLOCK', 'CUT', 'PROCESSING');
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('Cut cannot move to Processing');
    expect(result.reason).toContain('Reported');
  });

  it('supports the slide review, recut and report cycle', () => {
    expect(canTransition('SLIDE', 'ACCESSIONED', 'CUT')).toBe(true);
    expect(canTransition('SLIDE', 'CUT', 'STAINED')).toBe(true);
    expect(canTransition('SLIDE', 'STAINED', 'WITH_PATHOLOGIST')).toBe(true);
    expect(canTransition('SLIDE', 'WITH_PATHOLOGIST', 'RECUT_REQUESTED')).toBe(true);
    expect(canTransition('SLIDE', 'RECUT_REQUESTED', 'CUT')).toBe(true);
    expect(canTransition('SLIDE', 'WITH_PATHOLOGIST', 'REPORTED')).toBe(true);
    expect(canTransition('SLIDE', 'REPORTED', 'ARCHIVED')).toBe(true);
    expect(canTransition('SLIDE', 'REPORTED', 'RECUT_REQUESTED')).toBe(false);
  });

  it('permits rejection from the appropriate states and then recovery', () => {
    expect(canTransition('SPECIMEN', 'ACCESSIONED', 'REJECTED')).toBe(true);
    expect(canTransition('SPECIMEN', 'GROSSED', 'ARCHIVED')).toBe(true);
    expect(canTransition('SLIDE', 'CUT', 'REJECTED')).toBe(true);
    expect(canTransition('SLIDE', 'REJECTED', 'STAINED')).toBe(true);
  });

  it('derives the target event from the station and current state', () => {
    expect(stationTarget('BLOCK', 'PROCESSING')).toBe('PROCESSING');
    expect(inferScanTarget('BLOCK', 'PROCESSING', 'GROSSED')).toBe('PROCESSING');
    expect(inferScanTarget('BLOCK', 'PROCESSING', 'ACCESSIONED')).toBeNull();
    expect(inferScanTarget('BLOCK', 'MICROTOMY', 'EMBEDDED')).toBe('CUT');
    expect(inferScanTarget('SLIDE', 'STAINING', 'CUT')).toBe('STAINED');
    expect(inferScanTarget('SLIDE', 'STAINING', 'RECUT_REQUESTED')).toBeNull();
    expect(inferScanTarget('SLIDE', 'MICROTOMY', 'RECUT_REQUESTED')).toBe('CUT');
    expect(inferScanTarget('SLIDE', 'PATHOLOGIST', 'STAINED')).toBe('WITH_PATHOLOGIST');
    expect(inferScanTarget('SLIDE', 'ARCHIVE', 'REPORTED')).toBe('ARCHIVED');
  });

  it('does not allow an entity at a station that does not handle it', () => {
    expect(stationTarget('SLIDE', 'PROCESSING')).toBeNull();
    expect(stationTarget('SPECIMEN', 'STAINING')).toBeNull();
    expect(inferScanTarget('SPECIMEN', 'EMBEDDING', 'GROSSED')).toBeNull();
    expect(allowedNextStates('SPECIMEN', 'ACCESSIONED')).toEqual(['GROSSED', 'REJECTED']);
  });

  it('enforces the case state machine separately from physical states', () => {
    expect(canCaseTransition('RECEIVED', 'IN_PROGRESS')).toBe(true);
    expect(canCaseTransition('IN_PROGRESS', 'PENDING_REVIEW')).toBe(true);
    expect(canCaseTransition('PENDING_REVIEW', 'REPORTED')).toBe(true);
    expect(canCaseTransition('REPORTED', 'AMENDED')).toBe(true);
    expect(canCaseTransition('RECEIVED', 'REPORTED')).toBe(false);
    expect(canCaseTransition('AMENDED', 'REPORTED')).toBe(false);
  });
});
