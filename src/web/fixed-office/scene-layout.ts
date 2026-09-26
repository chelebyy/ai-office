export const ART = {
  width: 1536,
  height: 1024,
  x: 150,
  y: 0,
  widthOfRoom: 1135,
  heightOfRoom: 757,
};
export const SOURCE = '/office/studio-source.png';
export const CLEAN_PLATE = '/office/studio-clean.png';
export type CharacterId = 'main' | 'blue' | 'green' | 'purple';
export type Point = readonly [number, number];
export type Quad = readonly [Point, Point, Point, Point];
export type ScreenCurve = { top: number; bottom: number };

export function screenEdge(quad: Quad, t: number, bottom = false, curve?: ScreenCurve): Point {
  const [a, b] = bottom ? [quad[3], quad[2]] : [quad[0], quad[1]];
  const bow = curve ? (bottom ? curve.bottom : curve.top) : 0;
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t + 4 * t * (1 - t) * bow];
}

export function screenOutline(quad: Quad, curve?: ScreenCurve): Point[] {
  if (!curve) return [...quad];
  const top = Array.from({ length: 13 }, (_, i) => screenEdge(quad, i / 12, false, curve));
  const bottom = Array.from({ length: 13 }, (_, i) => screenEdge(quad, 1 - i / 12, true, curve));
  return [...top, ...bottom];
}

export function screenSlices(quad: Quad, curve: ScreenCurve) {
  return Array.from({ length: 12 }, (_, i) => {
    const from = i / 12;
    // Tiny overlap prevents antialias seams without adding another animation clock.
    const to = Math.min(1, (i + 1) / 12 + 0.0005);
    const corners: Quad = [
      screenEdge(quad, from, false, curve),
      screenEdge(quad, to, false, curve),
      screenEdge(quad, to, true, curve),
      screenEdge(quad, from, true, curve),
    ];
    return { from, to, quad: corners };
  });
}

// Source coordinates keep the room, screens and characters aligned at every desktop size.
// Body patches retain adjacent chair/contact pixels for the B2 still. B3 pose atlases need
// finer independent silhouettes and occlusion masks; these patches are not animation rigs.
export const characters = [
  {
    id: 'main',
    color: '#53d1b3',
    label: [598, 386],
    bounds: [608, 479, 153, 229],
    path: 'M 615 541 Q 612 511 642 490 Q 677 473 705 493 Q 733 511 735 536 L 725 571 L 728 590 L 743 600 L 750 612 L 737 622 L 717 623 L 705 642 L 731 651 L 727 677 L 754 688 Q 765 702 749 706 L 718 703 L 709 682 L 696 667 L 685 677 L 682 704 L 652 714 L 642 704 L 648 682 L 650 654 L 635 634 L 628 600 L 610 569 Z M 627 574 L 764 574 L 764 715 L 627 715 Z',
  },
  {
    id: 'blue',
    color: '#6796ff',
    label: [507, 217],
    bounds: [530, 292, 75, 141],
    path: 'M 550 333 Q 541 309 557 299 Q 578 284 595 306 L 604 326 Q 604 341 583 347 L 579 357 L 560 369 L 547 379 L 541 397 L 552 414 L 551 429 L 536 432 L 528 422 L 534 407 L 532 387 L 538 372 L 529 367 L 530 359 L 542 356 L 550 363 L 557 352 L 556 343 Z M 527 347 L 624 347 L 624 456 L 518 456 Z',
  },
  {
    id: 'green',
    color: '#8dda78',
    label: [846, 207],
    bounds: [796, 257, 72, 123],
    path: 'M 799 280 Q 798 259 818 257 Q 839 254 848 272 L 852 290 Q 850 306 832 309 L 835 316 L 849 324 L 859 318 L 867 325 L 861 331 L 846 334 L 836 329 L 832 344 L 847 350 L 847 365 L 862 370 L 861 379 L 844 379 L 837 371 L 833 354 L 819 350 L 810 324 L 807 306 Z M 786 305 L 873 305 L 873 406 L 785 406 Z',
  },
  {
    id: 'purple',
    color: '#c285ff',
    label: [1122, 341],
    bounds: [1042, 373, 101, 146],
    path: 'M 1049 418 Q 1036 397 1053 382 Q 1073 369 1092 381 Q 1112 388 1110 411 L 1105 431 L 1088 437 L 1097 448 L 1109 457 L 1120 449 L 1128 454 L 1124 465 L 1108 468 L 1090 459 L 1089 474 L 1110 483 L 1121 506 L 1134 509 L 1137 519 L 1116 521 L 1107 512 L 1098 493 L 1077 484 L 1065 457 L 1059 435 Z M 1031 433 L 1145 433 L 1145 537 L 1031 537 Z',
  },
] as const;

export const monitors: {
  id: string;
  actor: CharacterId;
  quad: Quad;
  wall?: boolean;
  curve?: ScreenCurve;
}[] = [
  {
    id: 'wall',
    actor: 'main',
    wall: true,
    quad: [
      [184, 25],
      [779, 60],
      [777, 236],
      [191, 281],
    ],
  },
  {
    id: 'main-left',
    actor: 'main',
    quad: [
      [519, 482],
      [592, 463],
      [592, 531.5],
      [520, 550],
    ],
  },
  {
    id: 'main-center',
    actor: 'main',
    curve: { top: -3.4, bottom: -3.6 },
    quad: [
      [601.5, 463],
      [747.5, 456],
      [747.5, 530],
      [601.5, 531],
    ],
  },
  {
    id: 'main-right',
    actor: 'main',
    quad: [
      [758, 457],
      [888.5, 494],
      [883.5, 572],
      [756.5, 531],
    ],
  },
  {
    id: 'blue-left',
    actor: 'blue',
    quad: [
      [490, 301],
      [538.5, 293],
      [539, 335.5],
      [490, 343],
    ],
  },
  {
    id: 'blue-center',
    actor: 'blue',
    quad: [
      [544, 291],
      [591, 288],
      [591, 330],
      [544, 334.5],
    ],
  },
  {
    id: 'blue-inner',
    actor: 'blue',
    quad: [
      [596, 287],
      [645, 290],
      [645, 332],
      [596, 330],
    ],
  },
  {
    id: 'blue-right',
    actor: 'blue',
    quad: [
      [651, 292],
      [693, 303],
      [691, 342],
      [651, 332],
    ],
  },
  {
    id: 'green-left',
    actor: 'green',
    quad: [
      [796, 263],
      [855, 265],
      [854, 302],
      [795, 296],
    ],
  },
  {
    id: 'green-center',
    actor: 'green',
    quad: [
      [861, 266.5],
      [913, 273],
      [911.5, 312],
      [860, 303],
    ],
  },
  {
    id: 'green-right',
    actor: 'green',
    quad: [
      [918, 275],
      [957, 285.5],
      [955, 324],
      [917, 313],
    ],
  },
  {
    id: 'purple-left',
    actor: 'purple',
    quad: [
      [1007, 367],
      [1062, 364],
      [1059, 409],
      [1006, 413],
    ],
  },
  {
    id: 'purple-center',
    actor: 'purple',
    // Inner bezel corners in CLEAN_PLATE, which reconstructs the old label area.
    quad: [
      [1074, 363],
      [1162, 379],
      [1157, 431],
      [1072, 410],
    ],
  },
  {
    id: 'purple-right',
    actor: 'purple',
    // The right display recedes more steeply than the center display. Match its
    // full inner surface, including the lower-right corner, rather than an inset
    // rectangle that leaves a widening black wedge along the bezel.
    quad: [
      [1166, 378.6],
      [1219, 400.5],
      [1212, 453],
      [1161, 432.6],
    ],
  },
];

export function screenMatrix(quad: Quad, width: number, height: number) {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = quad;
  const dx1 = x1 - x2,
    dx2 = x3 - x2,
    dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2,
    dy2 = y3 - y2,
    dy3 = y0 - y1 + y2 - y3;
  const determinant = dx1 * dy2 - dx2 * dy1;
  if (Math.abs(determinant) < 0.000001 || width <= 0 || height <= 0)
    throw new Error('Invalid screen geometry');
  const g = (dx3 * dy2 - dx2 * dy3) / determinant,
    h = (dx1 * dy3 - dx3 * dy1) / determinant;
  return [
    (x1 - x0 + g * x1) / width,
    (y1 - y0 + g * y1) / width,
    0,
    g / width,
    (x3 - x0 + h * x3) / height,
    (y3 - y0 + h * y3) / height,
    0,
    h / height,
    0,
    0,
    1,
    0,
    x0,
    y0,
    0,
    1,
  ];
}

export const foreground =
  'M 461 588 L 601 624 L 603 641 L 459 606 Z M 736 625 L 999 623 L 991 649 L 814 714 L 735 682 Z';
