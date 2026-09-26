import { walkDuration, walkProgress } from './pet-gait.ts';

/** Ambient scene choreography. Coordinates use the original 1536 × 1024 artwork.
 * These are decorative pets, independent of agent/session activity. */
export type PetKind = 'cat' | 'dog';
export type PetAction = 'sleep' | 'sit' | 'stand' | 'stretch' | 'walk' | 'drink' | 'eat' | 'jump';
export type PetPoint = readonly [x: number, y: number, size: number];
export type PetStep = {
  action: PetAction;
  duration: number;
  from: PetPoint;
  to: PetPoint;
  facing: 1 | -1;
  arc?: number;
};

export const PET_ASSETS = {
  plate: '/office/pets/empty-resting-spots-v1.png',
  cat: '/office/pets/cat-atlas-v1.png',
  dog: '/office/pets/dog-atlas-v1.png',
  catRig: '/office/pets/cat-rig-v2.png',
  dogRig: '/office/pets/dog-rig-v2.png',
};
export const PET_HOME: Record<PetKind, PetPoint> = {
  cat: [217, 449, 82],
  dog: [1167, 699, 174],
};

// Each pet has its own bowls. Routes stay in the open floor corridors; the cat's
// desk landing is left of Cheleby, with enough room for its paws behind the rim.
export const PET_BOWLS = [
  { pet: 'cat', kind: 'food', x: 397, y: 526, size: 27 },
  { pet: 'cat', kind: 'water', x: 424, y: 538, size: 27 },
  { pet: 'dog', kind: 'food', x: 1158, y: 601, size: 37 },
  { pet: 'dog', kind: 'water', x: 1201, y: 621, size: 37 },
] as const;

/** Finite steps avoid a polling timer and let the browser pause the entire act. */
export function petRoutine(pet: PetKind, round = 0): PetStep[] {
  const steps: PetStep[] = [];
  let position = PET_HOME[pet];
  let facing: 1 | -1 = pet === 'cat' ? 1 : -1;
  const act = (action: PetAction, duration: number, to = position, arc?: number) => {
    if (to[0] !== position[0]) facing = to[0] > position[0] ? 1 : -1;
    const step = { action, duration, from: position, to, facing, arc };
    if (action === 'walk') step.duration = walkDuration(pet, step);
    steps.push(step);
    position = to;
  };
  const turn = (direction: 1 | -1) => {
    facing = direction;
    act('stand', 750);
  };
  // No simultaneous mechanical loop: their rest periods and destinations differ.
  act(
    'sleep',
    (round === 0 ? (pet === 'cat' ? 24_000 : 62_000) : pet === 'cat' ? 110_000 : 145_000) +
      (round % 3) * 17_000,
  );
  act('sit', 2400);
  act('stretch', 1800);
  if (pet === 'cat') {
    act('jump', 950, [320, 505, 88], 34);
    act('walk', 2600, [365, 526, 88]);
    act('eat', 6200);
    act('walk', 1700, [391, 538, 88]);
    act('drink', 5600);
    act('sit', 3500);
    act('walk', 3200, [310, 593, 92]);
    turn(1);
    act('walk', 4200, [409, 659, 97]);
    if (round % 2 === 0) {
      act('stand', 1400);
      act('jump', 1100, [542, 590, 87], 32);
      act('sit', 22_000);
      act('stretch', 2000);
      turn(-1);
      act('jump', 1150, [409, 659, 97], 24);
    } else {
      act('walk', 3600, [350, 657, 102]);
      act('sit', 10_000);
      act('walk', 3600, [409, 659, 97]);
    }
    act('walk', 3800, [300, 587, 92]);
    act('stand', 900);
    act('walk', 2200, [364, 548, 88]);
    turn(-1);
    act('walk', 2300, [320, 505, 88]);
    act('stand', 900);
    act('jump', 1000, PET_HOME.cat, 40);
    turn(1);
  } else {
    act('walk', 4800, [1075, 654, 156]);
    act('sit', 4200);
    turn(1);
    act('walk', 3100, [1185, 628, 146]);
    turn(-1);
    act('walk', 2000, [1105, 601, 142]);
    turn(1);
    act('eat', 7400);
    act('walk', 2800, [1148, 621, 142]);
    act('drink', 6800);
    act('sit', 5400);
    turn(-1);
    act('walk', 2900, [1080, 651, 151]);
    act('stretch', 2200);
    act('sit', 8500);
    turn(1);
    act('walk', 5200, PET_HOME.dog);
    act('stand', 1000);
  }
  return steps;
}

export function petTransform(point: PetPoint): string {
  const [x, y, size] = point;
  return `translate(${(x - 150) / 11.35}cqw, ${y / 11.35}cqw) translate(-50%, -88%) scale(${size / 128})`;
}

/** Separate keyframes for the hop keep the floor shadow on the floor. */
export function petPath(step: PetStep): { transform: string; offset: number }[] {
  const count = step.action === 'walk' ? 60 : step.arc ? 12 : 1;
  return Array.from({ length: count + 1 }, (_, i) => {
    const offset = i / count;
    const t = step.action === 'walk' ? walkProgress(offset) : offset;
    return {
      offset,
      transform: petTransform([
        step.from[0] + (step.to[0] - step.from[0]) * t,
        step.from[1] + (step.to[1] - step.from[1]) * t - (step.arc ?? 0) * 4 * t * (1 - t),
        step.from[2] + (step.to[2] - step.from[2]) * t,
      ]),
    };
  });
}

export function petFrames(pet: PetKind, action: PetAction): number[] {
  switch (action) {
    case 'sleep':
      return [0];
    case 'sit':
      return [1];
    case 'stand':
      return [2];
    case 'stretch':
      return [3];
    case 'walk':
      return [4, 5, 6, 7];
    case 'eat':
      return [8, 9, 10, 9];
    case 'drink':
      return [8, 9, 10, 11];
    case 'jump':
      return pet === 'cat' ? [12, 13, 14, 15] : [2];
  }
}
