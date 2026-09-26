import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PET_HOME,
  petFrames,
  petPath,
  petRoutine,
  petTransform,
} from '../src/web/fixed-office/pet-behavior.ts';

test('pets return home continuously across varied routines, with water and food stops', () => {
  for (const pet of ['cat', 'dog'] as const)
    for (let round = 0; round < 6; round++) {
      const routine = petRoutine(pet, round);
      assert.deepEqual(routine[0].from, PET_HOME[pet]);
      assert.deepEqual(routine.at(-1)?.to, PET_HOME[pet]);
      assert.ok(routine.some((s) => s.action === 'eat'));
      assert.ok(routine.some((s) => s.action === 'drink'));
      for (const [i, step] of routine.entries()) {
        assert.ok(Number.isFinite(step.duration) && step.duration > 0);
        if (i) assert.deepEqual(step.from, routine[i - 1].to, 'no teleport between actions');
        const path = petPath(step);
        assert.equal(path[0].transform, petTransform(step.from));
        assert.equal(path.at(-1)?.transform, petTransform(step.to));
        for (const frame of path) assert.ok(!/NaN|Infinity/.test(frame.transform));
        assert.ok(
          petFrames(pet, step.action).every((f) => Number.isInteger(f) && f >= 0 && f < 16),
        );
      }
    }
});

test('only the cat visits the desk; floor routes avoid the main desk corridor', () => {
  assert.ok(petRoutine('cat', 0).some((s) => s.action === 'jump' && s.to[0] > 500));
  assert.ok(!petRoutine('cat', 1).some((s) => s.action === 'jump' && s.to[0] > 500));
  for (const step of petRoutine('dog')) {
    assert.notEqual(step.action, 'jump');
    assert.ok(step.from[0] >= 1075 && step.to[0] >= 1075);
    assert.ok(step.from[1] >= 600 && step.to[1] >= 600);
  }
});

test('ambient routines have long, staggered rests after the first introduction', () => {
  assert.notEqual(petRoutine('cat')[0].duration, petRoutine('dog')[0].duration);
  for (const pet of ['cat', 'dog'] as const) {
    const routine = petRoutine(pet, 1);
    assert.ok(routine[0].duration >= 110_000);
    assert.ok(routine[0].duration > routine.slice(1).reduce((sum, s) => sum + s.duration, 0));
  }
});
