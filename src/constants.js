export const GRID = 26;
export const STEP_MS = 105;
export const FIRST_FOOD = { x: 13, y: 13 };

export function isTouchForced() {
  return new URLSearchParams(location.search).get("touch") === "1";
}
