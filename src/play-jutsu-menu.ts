export interface PlayMenuPosition {
  x: number;
  y: number;
}

export interface PlayMenuSize {
  width: number;
  height: number;
}

export const PLAY_MENU_EDGE_MARGIN_PX = 8;

export function createInitialPlayMenuPosition(
  world: PlayMenuSize,
  menu: PlayMenuSize,
  margin = PLAY_MENU_EDGE_MARGIN_PX,
): PlayMenuPosition {
  return clampPlayMenuPosition(
    { x: world.width - menu.width - margin, y: world.height - menu.height - margin },
    world,
    menu,
    margin,
  );
}

export function clampPlayMenuPosition(
  position: PlayMenuPosition,
  world: PlayMenuSize,
  menu: PlayMenuSize,
  margin = PLAY_MENU_EDGE_MARGIN_PX,
): PlayMenuPosition {
  const safeMargin = Math.max(0, margin);
  const maxX = Math.max(safeMargin, world.width - menu.width - safeMargin);
  const maxY = Math.max(safeMargin, world.height - menu.height - safeMargin);
  return {
    x: clamp(position.x, safeMargin, maxX),
    y: clamp(position.y, safeMargin, maxY),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
