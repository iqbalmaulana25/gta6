// Boot, the loop and the save file. The world advances in fixed 1/60 s steps (several in a
// slow frame, none in a fast one) while the renderer paints what is there; screens — title,
// play, paused, how-to, busted, wasted, story complete — are states over the same living
// city, which idles behind the title menu with its traffic running.
//
// ?seed=N fixes the city. ?shot=title|cover|foot|marina (with &seed=N) stages that scene
// instead of running the loop, paints it twice and sets window.__shotReady for a screenshot.

import { SAVE_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createGame, EVENT_BUSTED, EVENT_WASTED, starsOf, updateGame } from './entities.js';
import { attachMissions, failMission, restoreMissions, updateMissions } from './missions.js';
import { ACTION_CONFIRM, ACTION_INTERACT, ACTION_PAUSE, ACTION_SAVE, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_BUSTED, SCREEN_COMPLETE, SCREEN_HOWTO, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { createHud } from './hud.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;
const FINE = 150;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const renderer = createRenderer(canvas);
const hud = createHud(canvas);
const audio = createAudio();

function fitCanvas() {
  const dpr = Math.min(1.5, window.devicePixelRatio || 1);
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
}
fitCanvas();
window.addEventListener('resize', fitCanvas);

function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function wireHooks(state) {
  state.hooks.onSound = (name) => {
    if (name === 'shot') audio.shot();
    else if (name === 'punch') audio.punch();
    else if (name === 'hurt') audio.hurt();
    else if (name === 'crash') audio.crash(false);
    else if (name === 'pickup') audio.pickup();
    else if (name === 'cash') audio.cash();
    else if (name === 'mission') audio.mission();
    else if (name === 'fail') audio.fail();
    else if (name === 'ui') audio.ui();
  };
  state.hooks.onPackage = () => {
    state.player.money += 50;
    state.missions.banner = {
      title: 'Golden palm found',
      sub: `${state.packagesFound.size} of 20 — +$50`,
      t: 3,
    };
  };
  state.hooks.onMissionComplete = (def) => {
    saveGame(state);
    if (def.id === 'solano-score') state.pendingComplete = true;
  };
}

function saveGame(state) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      money: state.player.money,
      missionIndex: state.missions.nextIndex,
      packages: [...state.packagesFound],
      x: Math.round(state.player.x),
      y: Math.round(state.player.y),
      health: Math.round(state.player.health),
    }));
  } catch {
    // Storage can be off (private windows): progress then lasts this visit only.
  }
}

function newGame(saved) {
  const state = createGame(createRandom(seed));
  attachMissions(state);
  wireHooks(state);
  if (saved) {
    state.player.money = saved.money ?? state.player.money;
    state.player.x = saved.x ?? state.player.x;
    state.player.y = saved.y ?? state.player.y;
    state.player.health = saved.health ?? state.player.health;
    for (const id of saved.packages ?? []) {
      state.packagesFound.add(id);
      const pack = state.city.packages[id];
      if (pack) pack.taken = true;
    }
    restoreMissions(state, saved);
  }
  renderer.camera.x = state.player.x;
  renderer.camera.y = state.player.y;
  renderer.camera.locked = false;
  return state;
}

function runShot(name) {
  const state = newGame(null);
  const scene = stageShot(name, state);
  renderer.camera.x = state.player.x;
  renderer.camera.y = state.player.y;
  renderer.camera.locked = true;
  let painted = 0;
  function paint() {
    renderer.drawWorld(state, scene.screen);
    hud.draw(state, scene.screen, { hasSave: Boolean(readSave()) });
    painted += 1;
    if (painted < 3) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let state = newGame(null);
  let screen = SCREEN_TITLE;
  let accumulator = 0;
  let last = performance.now();
  let completeTimer = -1;

  function announce(message) {
    status.textContent = message;
  }

  function startRun(saved) {
    state = newGame(saved);
    screen = SCREEN_PLAY;
    audio.wake();
    audio.music(true);
    announce(saved ? 'Welcome back to Port Solano.' : 'Solano Heat. See Lena at Café Azul.');
  }

  function respawn(atHospital) {
    const lm = atHospital ? state.city.landmarks.hospital : state.city.landmarks.policeStation;
    state.player.x = lm.doorX;
    state.player.y = lm.doorY + 24;
    state.player.car = null;
    state.player.health = 65;
    state.player.dead = false;
    state.player.bustMeter = 0;
    state.player.money = Math.max(0, state.player.money - FINE);
    state.wanted.heat = 0;
    renderer.camera.x = state.player.x;
    renderer.camera.y = state.player.y;
    screen = SCREEN_PLAY;
  }

  function handleActions() {
    const actions = input.takeActions();
    const keys = input.keys;
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_CONFIRM) startRun(null);
      else if (keys.has('KeyC') && readSave()) startRun(readSave());
      else if (keys.has('KeyH')) screen = SCREEN_HOWTO;
      return { interact: false };
    }
    if (screen === SCREEN_HOWTO) {
      if ((actions & (ACTION_PAUSE | ACTION_CONFIRM)) || keys.has('KeyH')) screen = SCREEN_TITLE;
      return { interact: false };
    }
    if (screen === SCREEN_OVER || screen === SCREEN_BUSTED) {
      if (actions & ACTION_CONFIRM) respawn(screen === SCREEN_OVER);
      return { interact: false };
    }
    if (screen === SCREEN_COMPLETE) {
      if (actions & ACTION_CONFIRM) screen = SCREEN_PLAY;
      return { interact: false };
    }
    if (actions & ACTION_PAUSE) {
      screen = screen === SCREEN_PAUSED ? SCREEN_PLAY : SCREEN_PAUSED;
      announce(screen === SCREEN_PAUSED ? 'Paused.' : 'Playing.');
      return { interact: false };
    }
    if (screen === SCREEN_PAUSED) {
      if (actions & ACTION_SAVE) {
        saveGame(state);
        state.missions.banner = { title: 'Game saved', sub: 'Port Solano will remember this', t: 2.4 };
      }
      return { interact: false };
    }
    if (actions & ACTION_SAVE) {
      saveGame(state);
      state.missions.banner = { title: 'Game saved', sub: 'Port Solano will remember this', t: 2.4 };
    }
    return { interact: Boolean(actions & ACTION_INTERACT) };
  }

  function stepFrame(actions) {
    // The mouse aims in world space, through the camera.
    const { scale } = renderer.viewSize();
    state.aim = {
      x: renderer.camera.x + (input.mouse.x * (canvas.width / window.innerWidth) - canvas.width / 2) / scale,
      y: renderer.camera.y + (input.mouse.y * (canvas.height / window.innerHeight) - canvas.height / 2) / scale,
    };
    state.inputDown = input.mouse.down;
    if (screen === SCREEN_TITLE || screen === SCREEN_HOWTO) {
      updateGame(state, input, { interact: false }, STEP);
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    const event = updateGame(state, input, actions, STEP);
    updateMissions(state, STEP);
    if (event === EVENT_WASTED) {
      failMission(state, 'You woke up in hospital.');
      screen = SCREEN_OVER;
      audio.fail();
      announce('Wasted.');
    } else if (event === EVENT_BUSTED) {
      failMission(state, 'The PD took you in.');
      screen = SCREEN_BUSTED;
      audio.fail();
      announce('Busted.');
    }
    if (state.pendingComplete && completeTimer < 0) completeTimer = 4.5;
    if (completeTimer > 0) {
      completeTimer -= STEP;
      if (completeTimer <= 0) {
        state.pendingComplete = false;
        screen = SCREEN_COMPLETE;
      }
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = handleActions();
    if (screen === SCREEN_PLAY || screen === SCREEN_TITLE || screen === SCREEN_HOWTO) {
      while (accumulator >= STEP) {
        stepFrame(actions);
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
      if (screen === SCREEN_PAUSED) updateMissions(state, 0);
    }
    renderer.updateCamera(state, Math.min(0.05, accumulator + STEP));
    renderer.drawWorld(state, screen);
    hud.draw(state, screen, { hasSave: Boolean(readSave()) });
    // Engine and siren follow the world.
    const p = state.player;
    if (screen === SCREEN_PLAY && p.car) {
      const kind = p.car.kind;
      const top = kind === 'sport' ? 468 : kind === 'police' ? 402 : 342;
      audio.engine(Math.abs(p.car.speed) / top, true);
    } else {
      audio.engine(0, false);
    }
    const policeNear = state.cars.some((c) => c.driver === 'police' && !c.dead
      && Math.hypot(c.x - p.x, c.y - p.y) < 620);
    audio.siren(screen === SCREEN_PLAY && starsOf(state) > 0 && policeNear);
    if (screen !== SCREEN_PLAY && screen !== SCREEN_TITLE) audio.siren(false);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Solano Heat. Press Enter to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
