import type { Point } from './scene-layout.ts';

export type RobotId = 'blue' | 'green' | 'purple';
export const ROBOT_IDS: RobotId[] = ['blue', 'green', 'purple'];
type Part = {
  path: string;
  clearPath?: string;
  pivot: Point;
  asset?: { src: string; x: number; y: number; width: number; height: number };
};
type Rig = {
  box: { x: number; y: number; width: number; height: number };
  head: Part;
  hand: Part;
  /** Original neck/shoulder pixels that must remain with the static body. */
  neckPath?: string;
};

// Fine source-pixel masks, separate from the broad B2 chair/body patches.
// Only the head and visible forearm move. Chairs, feet and torsos stay fixed.
export const robotRigs: Record<RobotId, Rig> = {
  blue: {
    box: { x: 520, y: 280, width: 100, height: 170 },
    head: {
      clearPath:
        'M 550 333 Q 541 309 557 299 Q 578 284 595 306 L 604 326 Q 604 341 583 347 L 571 348 L 556 343 Z',
      path: 'M 546 336 C 541 333 541 324 545 319 C 544 308 550 299 559 296 L 566 292 L 575 294 C 586 293 595 302 597 312 C 603 317 602 328 598 333 C 593 342 583 347 573 349 C 561 349 551 343 546 336 Z',
      pivot: [574, 344],
      asset: {
        src: '/office/robot-heads/blue-head-r11.webp',
        x: 550,
        y: 304,
        width: 48,
        height: 44,
      },
    },
    hand: {
      path: 'M 530 358 Q 534 356 538 360 L 544 367 L 551 365 L 555 372 Q 548 381 541 373 L 532 367 Q 527 365 530 358 Z',
      pivot: [551, 370],
    },
  },
  green: {
    box: { x: 785, y: 245, width: 95, height: 165 },
    neckPath: 'M 824 303 L 831 305 L 836 314 L 829 318 L 822 312 Z',
    head: {
      clearPath:
        'M 799 280 Q 798 259 818 257 Q 839 254 848 272 L 852 290 Q 850 306 832 309 L 819 308 L 807 302 Z',
      path: 'M 801 301 C 796 297 796 283 800 279 C 800 267 808 258 819 256 C 833 255 843 263 848 275 L 851 282 C 856 285 855 297 851 302 C 846 310 835 314 824 312 C 813 312 805 307 801 301 Z',
      pivot: [825, 306],
      asset: {
        src: '/office/robot-heads/green-head-r11.webp',
        x: 807,
        y: 264,
        width: 46,
        height: 44,
      },
    },
    hand: {
      path: 'M 837 322 L 848 325 L 855 320 Q 861 316 866 322 L 867 326 L 860 332 Q 850 340 839 331 Z',
      pivot: [841, 329],
    },
  },
  purple: {
    box: { x: 1025, y: 365, width: 125, height: 175 },
    head: {
      clearPath:
        'M 1049 418 Q 1036 397 1053 382 Q 1073 369 1092 381 Q 1112 388 1110 411 L 1105 431 L 1088 437 L 1071 437 L 1059 429 Z',
      path: 'M 1047 420 C 1040 412 1041 399 1047 391 C 1052 381 1064 375 1077 377 C 1092 377 1104 387 1108 399 C 1112 405 1113 416 1108 423 C 1106 431 1096 435 1087 435 C 1072 436 1056 430 1047 420 Z',
      pivot: [1081, 433],
    },
    hand: {
      path: 'M 1094 454 C 1097 457 1102 458 1105 455 L 1108 451 C 1110 448 1114 448 1117 450 C 1120 452 1121 454 1121 457 L 1119 457 L 1118 459 L 1116 458 L 1114 456 C 1113 462 1109 465 1103 467 C 1098 469 1093 466 1091 463 Z',
      pivot: [1096, 461],
    },
  },
};

export function partMask(id: RobotId, part: 'head' | 'hand') {
  const { box } = robotRigs[id];
  return `url("data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box.x} ${box.y} ${box.width} ${box.height}"><path fill="white" d="${robotRigs[id][part].path}"/></svg>`,
  )}")`;
}
