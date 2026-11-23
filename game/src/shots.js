// The screenshot scenes behind ?shot=title|cover|foot|marina|roadblock. Each one builds a
// fresh world from the seed and plays the real rules forward — traffic, police and gunfire
// are the game's own systems, never props — with a scripted driver or walker at the
// controls, so the frame is what play actually looks like: the cover is a genuine
// three-star chase down Ocean Drive with the mission marker up, the marina scene is the
// Dockside Noise shootout mid-fight, and the roadblock scene is the Solano Score's second
// beat, five stars up with the PSPD line across the avenue ahead.

import { STEP } from './config.js';
import { makeCar, setRoadblock, updateGame } from './entities.js';
import { updateMissions } from './missions.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';

function idleInput() {
  return {
    held: () => false,
    moveAxes: () => ({ x: 0, y: 0 }),
    mouse: { down: false, x: 0, y: 0 },
    takeActions: () => 0,
  };
}

function drivingInput() {
  return {
    held: (code) => code === 'KeyW',
    moveAxes: () => ({ x: 0, y: 0 }),
    mouse: { down: false, x: 0, y: 0 },
    takeActions: () => 0,
  };
}

function walkingInput(dx, dy) {
  return {
    held: () => false,
    moveAxes: () => ({ x: dx, y: dy }),
    mouse: { down: false, x: 0, y: 0 },
    takeActions: () => 0,
  };
}

const NO_ACTIONS = { interact: false };

function run(state, input, seconds, withMissions = true) {
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    updateGame(state, input, NO_ACTIONS, STEP);
    if (withMissions) updateMissions(state, STEP);
  }
}

/**
 * Stage the named scene in `state` (fresh from the seed, missions attached) and return the
 * screen to draw over it.
 */
export function stageShot(name, state) {
  const city = state.city;
  const p = state.player;
  if (name === 'cover') {
    // On Ocean Drive, in a Comet, three stars up and the warehouse job on the clock.
    run(state, idleInput(), 0.2);
    const car = makeCar('sport', 330, 2269, 0, '#e8b10e', 'player');
    car.speed = 120;
    state.cars.push(car);
    p.car = car;
    car.playerDriven = true;
    p.x = car.x;
    p.y = car.y;
    for (const [back, speed] of [[95, 330], [185, 310], [285, 296]]) {
      const cop = makeCar('police', 330 - back, 2269, 0, '#e8ecf2', 'police');
      cop.speed = speed;
      state.cars.push(cop);
    }
    state.wanted.heat = 3;
    state.aim = { x: p.x + 500, y: p.y };
    run(state, drivingInput(), 3.9);
    state.aim = { x: p.x + 500, y: p.y - 10 };
    return { screen: SCREEN_PLAY };
  }
  if (name === 'foot') {
    // Downtown at street level: Dario crosses toward the gold beam while traffic rolls by.
    run(state, idleInput(), 0.2);
    p.x = city.roadsX[3] - 150;
    p.y = city.roadsY[2] + 150;
    state.aim = { x: p.x + 260, y: p.y - 60 };
    run(state, walkingInput(1, -0.25), 4.2);
    state.aim = { x: p.x + 260, y: p.y - 60 };
    return { screen: SCREEN_PLAY };
  }
  if (name === 'marina') {
    // The Dockside Noise job, thirty seconds in: hostiles around the warehouse, Dario firing.
    state.missions.nextIndex = 3;
    run(state, idleInput(), 0.2);
    const docks = city.landmarks.docks;
    p.x = docks.doorX;
    p.y = docks.doorY - 30;
    updateMissions(state, STEP);
    p.y = docks.doorY + 128;
    p.x = docks.doorX - 30;
    const firing = walkingInput(0, 0);
    firing.mouse.down = true;
    for (let i = 0; i < 150; i += 1) {
      const hostile = state.peds.find((q) => q.hostile && !q.dead);
      if (hostile) state.aim = { x: hostile.x, y: hostile.y };
      updateGame(state, firing, NO_ACTIONS, STEP);
      updateMissions(state, STEP);
    }
    return { screen: SCREEN_PLAY };
  }
  if (name === 'roadblock') {
    // The Solano Score, beat two: the bag is grabbed, the alarm has pinned five stars up,
    // and headquarters has parked a line of cruisers across the avenue ahead while the
    // pursuit closes from behind — wanted stars, minimap and the boat objective in frame.
    state.missions.nextIndex = 7;
    run(state, idleInput(), 0.2);
    const bank = city.landmarks.bank;
    p.x = bank.doorX;
    p.y = bank.doorY;
    updateMissions(state, STEP);
    updateMissions(state, STEP);
    const avenue = city.roadsX[5];
    const car = makeCar('sport', avenue, 1560, Math.PI / 2, '#e8b10e', 'player');
    car.speed = 300;
    state.cars.push(car);
    p.car = car;
    car.playerDriven = true;
    p.x = car.x;
    p.y = car.y;
    setRoadblock(state, avenue, 2050, false);
    for (const back of [150, 265]) {
      const cop = makeCar('police', avenue - 20, 1560 - back, Math.PI / 2, '#e8ecf2', 'police');
      cop.speed = 320;
      state.cars.push(cop);
    }
    state.aim = { x: p.x, y: p.y + 500 };
    run(state, drivingInput(), 0.95);
    state.aim = { x: p.x, y: p.y + 500 };
    return { screen: SCREEN_PLAY };
  }
  // Title: the city idles behind the menu — traffic, strollers, the sea.
  run(state, idleInput(), 7, false);
  return { screen: SCREEN_TITLE };
}
