import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

describe('property failure replay', () => {
  it('replays a synthetic counterexample from its reported seed and path', () => {
    const property = fc.property(
      fc.constant('synthetic-counterexample'),
      (value: string) => value === 'ok',
    );
    const initial = fc.check(property, { seed: 13_050_001, numRuns: 1 });
    expect(initial.failed).toBe(true);
    expect(initial.counterexample).toEqual(['synthetic-counterexample']);

    const replay = fc.check(property, {
      seed: initial.seed,
      path: initial.counterexamplePath ?? undefined,
      numRuns: 1,
    });
    expect(replay.failed).toBe(true);
    expect(replay.counterexample).toEqual(initial.counterexample);
  });
});
