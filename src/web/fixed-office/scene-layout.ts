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

export const monitors: { id: string; actor: CharacterId; quad: Quad; wall?: boolean }[] = [
  {
    id: 'wall',
    actor: 'main',
    wall: true,
    quad: [
      [190, 28],
      [783, 53],
      [781, 243],
      [191, 281],
    ],
  },
  {
    id: 'main-left',
    actor: 'main',
    quad: [
      [520, 483],
      [593, 468],
      [593, 532],
      [522, 551],
    ],
  },
  {
    id: 'main-center',
    actor: 'main',
    quad: [
      [602, 461],
      [751, 455],
      [750, 532],
      [603, 538],
    ],
  },
  {
    id: 'main-right',
    actor: 'main',
    quad: [
      [761, 463],
      [889, 495],
      [885, 574],
      [759, 532],
    ],
  },
  {
    id: 'blue-left',
    actor: 'blue',
    quad: [
      [489, 300],
      [539, 289],
      [540, 337],
      [490, 345],
    ],
  },
  {
    id: 'blue-center',
    actor: 'blue',
    quad: [
      [544, 289],
      [592, 286],
      [592, 331],
      [544, 336],
    ],
  },
  {
    id: 'blue-inner',
    actor: 'blue',
    quad: [
      [596, 289],
      [645, 292],
      [645, 333],
      [596, 330],
    ],
  },
  {
    id: 'blue-right',
    actor: 'blue',
    quad: [
      [653, 294],
      [695, 303],
      [693, 345],
      [653, 334],
    ],
  },
  {
    id: 'green-left',
    actor: 'green',
    quad: [
      [795, 264],
      [856, 267],
      [856, 307],
      [795, 300],
    ],
  },
  {
    id: 'green-center',
    actor: 'green',
    quad: [
      [860, 270],
      [914, 280],
      [914, 318],
      [858, 309],
    ],
  },
  {
    id: 'green-right',
    actor: 'green',
    quad: [
      [919, 284],
      [957, 294],
      [955, 326],
      [918, 315],
    ],
  },
  {
    id: 'purple-left',
    actor: 'purple',
    quad: [
      [1008, 367],
      [1062, 365],
      [1060, 410],
      [1007, 414],
    ],
  },
  {
    id: 'purple-center',
    actor: 'purple',
    quad: [
      [1074, 366],
      [1170, 389],
      [1165, 435],
      [1071, 410],
    ],
  },
  {
    id: 'purple-right',
    actor: 'purple',
    quad: [
      [1178, 393],
      [1224, 411],
      [1217, 452],
      [1175, 435],
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
