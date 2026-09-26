import { memo } from 'react';
import { PET_ASSETS, type PetKind, type PetStep } from './pet-behavior.ts';
import { PET_LEGS, legPose, type PetLeg } from './pet-gait.ts';

// Actual source rectangles, not assumed grid cells. The original RGBA textures
// remain intact; each small HTML layer selects one reusable fur-covered joint.
const PARTS = {
  cat: [
    [72, 80, 488, 360],
    [726, 134, 162, 306],
    [1224, 154, 186, 290],
    [164, 590, 224, 340],
    [688, 618, 210, 304],
    [1080, 576, 396, 352],
  ],
  dog: [
    [36, 36, 606, 414],
    [752, 54, 210, 396],
    [1186, 88, 244, 354],
    [154, 534, 288, 424],
    [642, 570, 268, 380],
    [1074, 566, 424, 374],
  ],
};

function Part({
  pet,
  part,
  x,
  y,
  width,
  height,
  section,
}: {
  pet: PetKind;
  part: number;
  x: number;
  y: number;
  width: number;
  height: number;
  section?: 'shin' | 'paw';
}) {
  const rect = [...PARTS[pet][part]];
  if (section === 'shin') rect[3] *= 0.8;
  if (section === 'paw') {
    rect[1] += rect[3] * 0.74;
    rect[3] *= 0.26;
  }
  return (
    <div
      className="fo-pet-rig-part"
      style={{
        left: x,
        top: y,
        width,
        height,
        backgroundImage: `url("${PET_ASSETS[`${pet}Rig`]}")`,
        backgroundSize: `${(1536 / rect[2]) * width}px ${(1024 / rect[3]) * height}px`,
        backgroundPosition: `${(-rect[0] / rect[2]) * width}px ${(-rect[1] / rect[3]) * height}px`,
      }}
    />
  );
}

function Leg({ pet, step, leg }: { pet: PetKind; step: PetStep; leg: PetLeg }) {
  const pose = legPose(step, leg, 0);
  const upperPart = leg.front ? 1 : 3;
  const lowerPart = leg.front ? 2 : 4;
  // Preserve the texture's proportions: fixed narrow widths made the walking
  // legs visibly thinner than the resting poses. Shin and paw share one scale.
  const upperWidth = (PARTS[pet][upperPart][2] / PARTS[pet][upperPart][3]) * 60;
  const lowerHeight = 43 / 0.8;
  const lowerWidth = (PARTS[pet][lowerPart][2] / PARTS[pet][lowerPart][3]) * lowerHeight;
  const lowerX = (-3 / 7) * lowerWidth;
  const pawHeight = lowerHeight * 0.26;
  return (
    <div className={leg.far ? 'fo-pet-rig-far' : undefined}>
      <div
        data-leg={leg.name}
        data-joint="upper"
        style={{ transform: `translate(${pose.hipX}px, ${pose.hipY}px) rotate(${pose.upper}deg)` }}
      >
        <Part
          pet={pet}
          part={upperPart}
          x={-upperWidth / 2}
          y={-10}
          width={upperWidth}
          height={60}
        />
        <div
          data-leg={leg.name}
          data-joint="lower"
          style={{ transform: `translate(0px, 43px) rotate(${pose.lower}deg)` }}
        >
          <Part
            pet={pet}
            part={lowerPart}
            section="shin"
            x={lowerX}
            y={-9}
            width={lowerWidth}
            height={43}
          />
          <div
            data-leg={leg.name}
            data-joint="paw"
            style={{ transform: `translate(0px, 42px) rotate(${-pose.upper - pose.lower}deg)` }}
          >
            <Part
              pet={pet}
              part={lowerPart}
              section="paw"
              x={lowerX}
              y={3 - pawHeight}
              width={lowerWidth}
              height={pawHeight}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export const PetRig = memo(function PetRig({ pet, step }: { pet: PetKind; step: PetStep }) {
  return (
    <div className="fo-pet-rig" aria-hidden="true">
      {PET_LEGS.filter((leg) => leg.far).map((leg) => (
        <Leg key={leg.name} pet={pet} step={step} leg={leg} />
      ))}
      {PET_LEGS.filter((leg) => !leg.far).map((leg) => (
        <Leg key={leg.name} pet={pet} step={step} leg={leg} />
      ))}
      <div data-rig-torso="true">
        <Part pet={pet} part={5} x={25} y={93} width={72} height={67} />
        <Part pet={pet} part={0} x={64} y={64} width={170} height={121} />
      </div>
    </div>
  );
});
