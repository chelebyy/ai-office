import { test } from 'node:test';
import assert from 'node:assert/strict';
import { petRoutine, type PetStep } from '../src/web/fixed-office/pet-behavior.ts';
import {
  GAIT_STANCE,
  PET_LEGS,
  gaitKeyframes,
  pawAt,
  solveLeg,
  walkDuration,
  walkProgress,
} from '../src/web/fixed-office/pet-gait.ts';

test('grounded paws cancel body travel and at least two paws support each phase', () => {
  const stride = 40;
  for (let i = 0; i < 100; i++) {
    const phase = i / 100;
    assert.ok(PET_LEGS.filter((leg) => pawAt(phase + leg.phase, stride, 10).planted).length >= 2);
  }
  for (let phase = 0.02; phase < 0.5; phase += 0.02) {
    const before = pawAt(phase, stride, 10);
    const after = pawAt(phase + 0.05, stride, 10);
    assert.equal(before.y, 0);
    assert.equal(after.y, 0);
    assert.ok(Math.abs(after.x - before.x + (stride / GAIT_STANCE) * 0.05) < 1e-8);
  }
});

test('two-bone joints reach the target with opposite anatomical bend directions', () => {
  for (const bend of [-1, 1] as const)
    for (const dx of [-18, 0, 18]) {
      const pose = solveLeg(dx, 76, bend);
      const a = (pose.upper * Math.PI) / 180;
      const b = ((pose.upper + pose.lower) * Math.PI) / 180;
      assert.ok(Math.abs(-Math.sin(a) * 43 - Math.sin(b) * 42 - dx) < 1e-8);
      assert.ok(Math.abs(Math.cos(a) * 43 + Math.cos(b) * 42 - 76) < 1e-8);
      if (dx === 0) assert.equal(Math.sign(pose.upper), bend);
    }
});

test('walking duration follows distance and scale; movement eases at both ends', () => {
  const step: PetStep = {
    action: 'walk',
    from: [0, 0, 100],
    to: [100, 0, 100],
    facing: 1,
    duration: 1,
  };
  assert.ok(
    Math.abs(walkDuration('cat', { ...step, to: [200, 0, 100] }) / walkDuration('cat', step) - 2) <
      0.001,
  );
  assert.ok(
    walkDuration('cat', { ...step, from: [0, 0, 200], to: [100, 0, 200] }) <
      walkDuration('cat', step),
  );
  assert.equal(walkProgress(0), 0);
  assert.equal(walkProgress(1), 1);
  assert.ok(walkProgress(0.02) < 0.005);
  assert.ok(1 - walkProgress(0.98) < 0.005);
});

test('all walks have coherent facing, restrained diagonals, finite bounded joint curves', () => {
  for (const pet of ['cat', 'dog'] as const)
    for (const round of [0, 1]) {
      for (const step of petRoutine(pet, round).filter((step) => step.action === 'walk')) {
        assert.equal(step.facing, Math.sign(step.to[0] - step.from[0]));
        assert.ok(
          Math.abs(step.to[1] - step.from[1]) <= Math.abs(step.to[0] - step.from[0]) * 1.05,
        );
        for (const leg of PET_LEGS)
          for (const joint of ['upper', 'lower', 'paw'] as const) {
            const frames = gaitKeyframes(step, leg, joint);
            assert.ok(frames.length <= 600);
            assert.equal(frames[0].offset, 0);
            assert.equal(frames.at(-1)?.offset, 1);
            assert.ok(frames.every((frame) => !/NaN|Infinity/.test(frame.transform)));
          }
      }
    }
});
