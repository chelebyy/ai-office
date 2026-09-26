import type { PetKind, PetStep } from './pet-behavior.ts';

export const GAIT_STANCE = 0.64;
export const GAIT_DISTANCE = 72;
export const PET_LEGS = [
  { name: 'far-hind', front: false, far: true, phase: 0.5 },
  { name: 'far-front', front: true, far: true, phase: 0.75 },
  { name: 'near-hind', front: false, far: false, phase: 0 },
  { name: 'near-front', front: true, far: false, phase: 0.25 },
] as const;
export type PetLeg = (typeof PET_LEGS)[number];

/** Short acceleration/deceleration, with constant speed through most of a walk. */
export function walkProgress(t: number): number {
  if (t < 0.1) return (t * t) / 0.18;
  if (t > 0.9) return 1 - ((1 - t) * (1 - t)) / 0.18;
  return (t - 0.05) / 0.9;
}

export function walkDistance(step: PetStep): number {
  return Math.hypot(step.to[0] - step.from[0], step.to[1] - step.from[1]);
}

export function walkDuration(pet: PetKind, step: PetStep): number {
  const size = (step.from[2] + step.to[2]) / 2;
  return Math.max(
    800,
    Math.round((walkDistance(step) * 256 * (pet === 'cat' ? 1050 : 1150)) / (size * GAIT_DISTANCE)),
  );
}

export function gaitPlan(step: PetStep) {
  const distance = (walkDistance(step) * 256) / ((step.from[2] + step.to[2]) / 2);
  const cycles = Math.max(1, Math.ceil(distance / GAIT_DISTANCE));
  return { cycles, stride: (distance / cycles) * GAIT_STANCE };
}

/** Stance is linear backwards in local space, cancelling forward root travel.
 * Only the returning paw lifts. Four quarter-cycle offsets keep support on floor. */
export function pawAt(phase: number, stride: number, lift: number) {
  const p = ((phase % 1) + 1) % 1;
  if (p < GAIT_STANCE) return { x: stride * (0.5 - p / GAIT_STANCE), y: 0, planted: true };
  const u = (p - GAIT_STANCE) / (1 - GAIT_STANCE);
  return {
    x: stride * (-0.5 + u * u * (3 - 2 * u)),
    y: -Math.sin(Math.PI * u) * lift,
    planted: false,
  };
}

/** Two-bone inverse kinematics, in the rig's 256-unit view box. */
export function solveLeg(dx: number, dy: number, bend: 1 | -1) {
  const upper = 43;
  const lower = 42;
  const distance = Math.min(upper + lower - 0.01, Math.max(0.01, Math.hypot(dx, dy)));
  const aim = Math.atan2(-dx, dy);
  const angle = Math.acos(
    Math.max(
      -1,
      Math.min(1, (upper * upper + distance * distance - lower * lower) / (2 * upper * distance)),
    ),
  );
  const a = aim + bend * angle;
  const kneeX = -Math.sin(a) * upper;
  const kneeY = Math.cos(a) * upper;
  const b = Math.atan2(-(dx - kneeX), dy - kneeY) - a;
  return { upper: (a * 180) / Math.PI, lower: (b * 180) / Math.PI };
}

export function legPose(step: PetStep, leg: PetLeg, t: number) {
  const { cycles, stride } = gaitPlan(step);
  const progress = step.action === 'walk' ? walkProgress(t) : 0;
  const settling = step.action === 'walk' ? Math.min(1, t / 0.1, (1 - t) / 0.1) : 0;
  const paw = pawAt(
    progress * cycles + leg.phase,
    step.action === 'walk' ? stride : 0,
    10 * settling,
  );
  const hipX = leg.front ? 185 : 91;
  const hipY = (leg.front ? 144 : 146) + (leg.far ? -3 : 0);
  const bob =
    step.action === 'walk' ? Math.sin(progress * cycles * Math.PI * 4) * 1.1 * settling : 0;
  // A small depth component follows diagonal paths, instead of paddling sideways.
  const dx = step.to[0] - step.from[0];
  const dy = step.to[1] - step.from[1];
  const length = Math.max(1, Math.hypot(dx, dy));
  const lateral = step.action === 'walk' ? Math.abs(dx) / length : 1;
  const depth = step.action === 'walk' ? dy / length : 0;
  const footY = 222 + (leg.far ? -3 : 0) + paw.y + paw.x * depth * 0.45;
  const angles = solveLeg(paw.x * lateral, footY - hipY - bob, leg.front ? 1 : -1);
  return {
    ...angles,
    hipX: hipX + (leg.far ? 4 : 0),
    hipY: hipY + bob,
    bob,
  };
}

export function gaitKeyframes(step: PetStep, leg: PetLeg, joint: 'upper' | 'lower' | 'paw') {
  const count = step.action === 'walk' ? Math.max(48, gaitPlan(step).cycles * 48) : 1;
  return Array.from({ length: count + 1 }, (_, i) => {
    const offset = i / count;
    const pose = legPose(step, leg, offset);
    return {
      offset,
      transform:
        joint === 'upper'
          ? `translate(${pose.hipX}px, ${pose.hipY}px) rotate(${pose.upper}deg)`
          : joint === 'lower'
            ? `translate(0px, 43px) rotate(${pose.lower}deg)`
            : `translate(0px, 42px) rotate(${-pose.upper - pose.lower}deg)`,
    };
  });
}
