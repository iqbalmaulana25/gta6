// Keyboard and mouse, read as state the simulation polls each step: held keys by code, the
// mouse position in screen pixels and its buttons, plus edge-triggered actions (interact,
// pause, confirm) that fire once per press however long the key stays down.

export const ACTION_INTERACT = 1;
export const ACTION_PAUSE = 2;
export const ACTION_CONFIRM = 4;
export const ACTION_SAVE = 8;

const ACTION_KEYS = {
  KeyE: ACTION_INTERACT,
  Escape: ACTION_PAUSE,
  KeyP: ACTION_PAUSE,
  Enter: ACTION_CONFIRM,
  Space: ACTION_CONFIRM,
  F5: ACTION_SAVE,
};

export function createInput(canvas) {
  const keys = new Set();
  const mouse = { x: 0, y: 0, down: false, rightDown: false };
  let pendingActions = 0;

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    keys.add(event.code);
    const action = ACTION_KEYS[event.code];
    if (action) {
      pendingActions |= action;
      if (action === ACTION_PAUSE || action === ACTION_SAVE) event.preventDefault();
    }
    if (event.code === 'Space') event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    keys.delete(event.code);
  });
  window.addEventListener('blur', () => {
    keys.clear();
    mouse.down = false;
    mouse.rightDown = false;
  });
  canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = event.clientX - rect.left;
    mouse.y = event.clientY - rect.top;
  });
  canvas.addEventListener('mousedown', (event) => {
    if (event.button === 0) {
      mouse.down = true;
      pendingActions |= ACTION_CONFIRM;
    }
    if (event.button === 2) mouse.rightDown = true;
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) mouse.down = false;
    if (event.button === 2) mouse.rightDown = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    keys,
    mouse,
    /** True while any of the given key codes is held. */
    held(...codes) {
      return codes.some((code) => keys.has(code));
    },
    /** The actions pressed since the last call; clears them. */
    takeActions() {
      const actions = pendingActions;
      pendingActions = 0;
      return actions;
    },
    /** Movement axes from the keys: x and y each in -1..1 (unnormalised). */
    moveAxes() {
      let x = 0;
      let y = 0;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
      if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
      return { x, y };
    },
  };
}
