// Keyboard and pointer input. Held keys give a steering direction; one-shot
// presses (start or restart, pause, mute) are queued as bit flags and taken once
// by the loop, so a press between two frames is never lost and never counted
// twice. The mouse steers the paddle directly; the keyboard steers it while a
// direction key is held.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;

const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const MUTE = new Set(['KeyM']);

/**
 * `toField` converts a pointer's client coordinates to playfield coordinates
 * (the renderer owns the scale and the letterbox offset).
 */
export function createInput(target, toField) {
  let left = false;
  let right = false;
  let actions = 0;
  let mouseX = null;

  window.addEventListener('keydown', (event) => {
    if (LEFT.has(event.code)) left = true;
    else if (RIGHT.has(event.code)) right = true;
    else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (MUTE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (LEFT.has(event.code)) left = false;
    else if (RIGHT.has(event.code)) right = false;
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    left = false;
    right = false;
  });
  target.addEventListener('pointermove', (event) => {
    mouseX = toField(event.clientX, event.clientY).x;
  });
  target.addEventListener('pointerdown', (event) => {
    mouseX = toField(event.clientX, event.clientY).x;
    actions |= ACTION_CONFIRM;
  });

  return {
    /** -1 for left, 1 for right, 0 for neither or both. */
    direction() {
      return (right ? 1 : 0) - (left ? 1 : 0);
    },
    /** The paddle's mouse target in field coordinates, or null when untouched. */
    mouseTarget() {
      return mouseX;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
