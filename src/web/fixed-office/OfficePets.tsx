import { memo, useEffect, useRef, useState } from 'react';
import type { Locale } from '../../shared/contract.ts';
import {
  PET_ASSETS,
  PET_BOWLS,
  petFrames,
  petPath,
  petRoutine,
  petTransform,
  type PetKind,
} from './pet-behavior.ts';
import { PetRig } from './PetRig.tsx';
import { PET_LEGS, gaitKeyframes, legPose } from './pet-gait.ts';
import './office-pets.css';

// Measured opaque bounds in the generated atlases. Register paws to one baseline
// and clip to the individual pose: generated sheets are not a pixel-perfect grid.
const bounds: Record<PetKind, number[][]> = {
  cat: [
    [56, 170, 287, 287],
    [369, 50, 570, 286],
    [642, 65, 905, 287],
    [988, 52, 1229, 291],
    [44, 357, 285, 578],
    [340, 364, 601, 579],
    [652, 356, 912, 579],
    [968, 358, 1226, 578],
    [43, 665, 287, 894],
    [345, 670, 596, 895],
    [659, 669, 909, 894],
    [973, 671, 1223, 895],
    [33, 1032, 303, 1192],
    [330, 944, 607, 1198],
    [650, 944, 914, 1146],
    [987, 963, 1222, 1196],
  ],
  dog: [
    [46, 194, 293, 323],
    [353, 64, 582, 321],
    [641, 88, 931, 323],
    [990, 76, 1238, 327],
    [44, 394, 322, 628],
    [335, 392, 628, 628],
    [641, 404, 938, 625],
    [950, 385, 1227, 628],
    [38, 689, 304, 932],
    [355, 695, 612, 939],
    [648, 694, 916, 934],
    [963, 692, 1222, 932],
    [43, 1031, 309, 1205],
    [342, 976, 593, 1207],
    [659, 1000, 917, 1206],
    [970, 1082, 1225, 1205],
  ],
};

function spriteFrame(pet: PetKind, frame: number) {
  const [left, top, right, bottom] = bounds[pet][frame];
  const cell = 313.5;
  const side = Math.max(0, (1 - (right - left + 8) / cell) * 50);
  return {
    backgroundPosition: `${(((left + right) / 2 / cell - 0.5) / 3) * 100}% ${((bottom / cell - 0.88) / 3) * 100}%`,
    clipPath: `inset(${Math.max(0, (0.88 - (bottom - top + 5) / cell) * 100)}% ${side}% 10% ${side}%)`,
  };
}

export function usePetAssets() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    // Reveal the clean plate and both pets atomically. If an image fails, keep
    // the original resting pets rather than leaving empty beds or duplicates.
    const images = Object.values(PET_ASSETS).map((src) => {
      const image = new Image();
      image.src = src;
      return image.decode();
    });
    Promise.all(images)
      .then(() => {
        if (alive) setReady(true);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return ready;
}

const Pet = memo(function Pet({
  pet,
  frozen,
  preview,
}: {
  pet: PetKind;
  frozen: boolean;
  preview: boolean;
}) {
  const [cursor, setCursor] = useState({ round: 0, step: 0 });
  const routine = petRoutine(pet, cursor.round);
  const step = routine[cursor.step];
  const root = useRef<HTMLDivElement>(null);
  const sprite = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const shadow = useRef<HTMLDivElement>(null);
  const animations = useRef<Animation[]>([]);
  const frozenRef = useRef(frozen);
  frozenRef.current = frozen;

  useEffect(() => {
    if (!root.current || !sprite.current || !body.current || !shadow.current) return;
    let alive = true;
    const duration = preview && step.action === 'sleep' ? 1800 : step.duration;
    const movement = root.current.animate(petPath(step), {
      duration,
      fill: 'both',
      easing: 'linear',
    });
    const floor = shadow.current.animate(petPath({ ...step, arc: undefined }), {
      duration,
      fill: 'both',
    });
    const motion: Animation[] = [movement, floor];
    if (step.action === 'walk' || step.action === 'stand') {
      for (const leg of PET_LEGS) {
        for (const joint of ['upper', 'lower', 'paw'] as const) {
          const element = root.current.querySelector<HTMLDivElement>(
            `[data-leg="${leg.name}"][data-joint="${joint}"]`,
          );
          if (element)
            motion.push(
              element.animate(gaitKeyframes(step, leg, joint), { duration, fill: 'both' }),
            );
        }
      }
      const torso = root.current.querySelector<HTMLDivElement>('[data-rig-torso]');
      if (torso) {
        const samples = gaitKeyframes(step, PET_LEGS[0], 'upper');
        motion.push(
          torso.animate(
            samples.map(({ offset }) => ({
              offset,
              transform: `translateY(${legPose(step, PET_LEGS[0], offset).bob}px)`,
            })),
            { duration, fill: 'both' },
          ),
        );
      }
    } else {
      const frames = petFrames(pet, step.action);
      motion.push(
        sprite.current.animate(
          [...frames, frames[frames.length - 1]].map((frame, i) => ({
            ...spriteFrame(pet, frame),
            offset: i / frames.length,
            easing: 'steps(1, end)',
          })),
          {
            duration: step.action === 'jump' ? duration : 1100,
            iterations: step.action === 'jump' ? 1 : Infinity,
            fill: 'both',
          },
        ),
      );
      motion.push(
        body.current.animate(
          [
            { transform: 'scaleY(1)' },
            { transform: `scaleY(${step.action === 'sleep' ? 0.978 : 0.994})` },
            { transform: 'scaleY(1)' },
          ],
          { duration: pet === 'cat' ? 3200 : 4100, iterations: Infinity, easing: 'ease-in-out' },
        ),
      );
    }
    animations.current = motion;
    if (frozenRef.current) animations.current.forEach((a) => a.pause());
    void movement.finished
      .then(() => {
        if (!alive) return;
        setCursor(
          cursor.step + 1 < routine.length
            ? { ...cursor, step: cursor.step + 1 }
            : { round: cursor.round + 1, step: 0 },
        );
      })
      .catch(() => {
        /* cancellation on unmount or phase replacement */
      });
    return () => {
      alive = false;
      animations.current.forEach((a) => a.cancel());
      animations.current = [];
    };
    // Scene updates and room selection must not restart a pet's routine.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pet, cursor, preview]);

  useEffect(() => {
    animations.current.forEach((a) => (frozen ? a.pause() : a.play()));
  }, [frozen]);

  return (
    <>
      <div
        ref={shadow}
        className="fo-pet-position fo-pet-floor"
        style={{ transform: petTransform(step.from) }}
        data-action={step.action}
      >
        <span className="fo-pet-shadow" />
      </div>
      <div
        ref={root}
        className="fo-pet-position"
        style={{ transform: petTransform(step.from) }}
        data-pet={pet}
        data-action={step.action}
        data-step={cursor.step}
        data-round={cursor.round}
      >
        <div className="fo-pet-facing" style={{ transform: `scaleX(${step.facing})` }}>
          <div ref={body} className="fo-pet-body">
            <div
              ref={sprite}
              className="fo-pet-sprite"
              style={{
                display: step.action === 'walk' || step.action === 'stand' ? 'none' : undefined,
                backgroundImage: `url("${PET_ASSETS[pet]}")`,
                ...spriteFrame(pet, petFrames(pet, step.action)[0]),
              }}
            />
            {(step.action === 'walk' || step.action === 'stand') && (
              <PetRig pet={pet} step={step} />
            )}
          </div>
        </div>
      </div>
    </>
  );
});

/** All moving pixels are small independent HTML layers, outside the office SVG. */
export const OfficePets = memo(function OfficePets({
  frozen,
  locale,
}: {
  frozen: boolean;
  locale: Locale;
}) {
  const [preview] = useState(() => new URLSearchParams(location.search).get('pets') === 'preview');
  return (
    <div className="fo-pets" data-testid="office-pets" data-frozen={frozen} aria-hidden="true">
      {PET_BOWLS.map((bowl) => (
        <svg
          key={`${bowl.pet}-${bowl.kind}`}
          className="fo-pet-bowl"
          viewBox="0 0 64 40"
          style={{
            left: `${(bowl.x - 150) / 11.35}%`,
            top: `${bowl.y / 7.57}%`,
            width: `${bowl.size / 11.35}%`,
          }}
        >
          <ellipse cx="32" cy="31" rx="29" ry="7" fill="#130c08" opacity=".38" />
          <path
            d="M5 15 Q7 35 32 36 Q57 35 59 15"
            fill={bowl.kind === 'water' ? '#486b70' : '#9c6650'}
            stroke="#372d28"
            strokeWidth="2"
          />
          <ellipse cx="32" cy="15" rx="27" ry="11" fill="#d0bca3" />
          <ellipse
            cx="32"
            cy="15"
            rx="22"
            ry="7.5"
            fill={bowl.kind === 'water' ? '#4e919c' : '#443022'}
          />
          {bowl.kind === 'water' ? (
            <path
              d="M16 13 Q28 8 43 13 M29 18 L45 16"
              fill="none"
              stroke="#d5e6dd"
              strokeWidth="1.5"
              opacity=".7"
            />
          ) : (
            [0, 1, 2, 3, 4, 5, 6, 7].map((n) => (
              <ellipse
                key={n}
                cx={18 + (n % 4) * 9}
                cy={12 + Math.floor(n / 4) * 6}
                rx="4"
                ry="2.5"
                fill={n % 2 ? '#b27a43' : '#8e5a31'}
              />
            ))
          )}
        </svg>
      ))}
      <Pet pet="cat" frozen={frozen} preview={preview} />
      <Pet pet="dog" frozen={frozen} preview={preview} />
      {preview && (
        <div className="fo-pet-preview">
          {locale === 'tr'
            ? 'Evcil hayvan önizlemesi · kısa dinlenme'
            : 'Pet preview · short rests'}
        </div>
      )}
    </div>
  );
});
