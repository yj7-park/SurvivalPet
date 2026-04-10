export type SkinId = 0 | 1 | 2;

export interface WalkOffset {
  leftY: number;
  rightY: number;
  bodyY: number;
}

// Per-frame leg/body offsets for the 4 walk frames
export const WALK_FRAMES: WalkOffset[] = [
  { leftY: 0,  rightY: 0,  bodyY: 0  }, // 0: idle
  { leftY: -3, rightY: +3, bodyY: 0  }, // 1: walk_1
  { leftY: 0,  rightY: 0,  bodyY: -1 }, // 2: walk_2 (body lifts slightly)
  { leftY: +3, rightY: -3, bodyY: 0  }, // 3: walk_3
];
