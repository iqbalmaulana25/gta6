// The living city: the player on foot and behind the wheel, traffic that minds its lanes,
// pedestrians who stroll and scatter, and the Port Solano PD, who answer the wanted level in
// cruisers and, once the player is cornered on foot, with an officer and a bust meter.
// Nothing here touches the DOM or sound directly: the game reports what happens through
// state.hooks (onCrime, onSound, onWasted, onBusted), which main.js wires to the story,
// the HUD and the synth.

import { CAR, CAR_KINDS, CAR_PAINTS, LANE, PLAYER, POLICE, TRAFFIC, WANTED, WORLD } from './config.js';
import { circleHitsSolid, createCity, inWater, laneOffset, pointOnRoad, randomRoadPoint, resolveCircle } from './city.js';

export const EVENT_NONE = 0;
export const EVENT_WASTED = 1;
export const EVENT_BUSTED = 2;

const TAU = Math.PI * 2;

export function angleLerp(a, b, t) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return a + d * Math.min(1, t);
}

export function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Line of sight between two points: sampled so no building stands between them. */
export function lineOfSight(city, x1, y1, x2, y2) {
  const d = Math.hypot(x2 - x1, y2 - y1);
  const steps = Math.max(1, Math.floor(d / 26));
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    if (circleHitsSolid(city, x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, 2)) return false;
  }
  return true;
}

let nextId = 1;

export function makeCar(kind, x, y, angle, paint, driver) {
  return {
    id: nextId++, kind, x, y, angle, speed: 0, paint,
    health: CAR.health, driver, dead: false, brake: false, steerVis: 0,
    axis: null, dir: 1, fixed: 0, targetSpeed: 0, thinkTime: Math.random() * 0.4,
    blockedTime: 0, waypoint: null, officer: null, missionTag: null, hornTime: 0,
  };
}

export function makePed(x, y, opts = {}) {
  return {
    id: nextId++, x, y, angle: Math.random() * TAU, speed: 0,
    health: 100, dead: false, hostile: opts.hostile ?? false, police: opts.police ?? false,
    shirt: opts.shirt ?? null, target: null, fleeFrom: null, fleeTime: 0,
    gunCooldown: Math.random() * 0.8, walkPhase: Math.random() * TAU, car: opts.car ?? null,
  };
}

export function createGame(rng) {
  const city = createCity(rng);
  const cafe = city.landmarks.cafe;
  const state = {
    rng, city, time: 0,
    player: {
      x: cafe.doorX, y: cafe.doorY + 26, angle: -Math.PI / 2, health: PLAYER.health,
      money: 120, car: null, gunCooldown: 0, ammo: PLAYER.magazine, reloadTime: 0,
      bustMeter: 0, walkPhase: 0, dead: false,
    },
    cars: [], peds: [], bullets: [], particles: [], skids: [],
    wanted: { heat: 0, unseenTime: 0, seen: false },
    crimeCooldowns: { shoot: 0 },
    packagesFound: new Set(),
    hooks: { onCrime() {}, onSound() {}, onWasted() {}, onBusted() {}, onPackage() {}, onEnterCar() {} },
    aim: { x: cafe.doorX, y: cafe.doorY - 60 },
    message: null,
  };
  // Parked cars wait in the lots; a few sit at the kerb.
  for (const lot of city.lots) {
    for (const bay of lot.bays) {
      if (rng.chance(0.45)) {
        const kind = rng.pick(['sedan', 'hatch', 'taxi', 'truck']);
        state.cars.push(makeCar(kind, bay.x + 22, bay.y + 24, Math.PI / 2, rng.pick(CAR_PAINTS), 'parked'));
      }
    }
  }
  for (let i = 0; i < 6; i += 1) {
    const p = randomRoadPoint(city, rng, state.player.x, state.player.y, 200, 700);
    if (p) state.cars.push(makeCar(rng.pick(['sedan', 'hatch', 'sport']), p.x, p.y, 0, rng.pick(CAR_PAINTS), 'parked'));
  }
  return state;
}

export function starsOf(state) {
  return Math.min(WANTED.max, Math.ceil(state.wanted.heat - 1e-6));
}

export function addHeat(state, amount) {
  state.wanted.heat = Math.max(0, Math.min(WANTED.max, state.wanted.heat + amount));
  state.wanted.unseenTime = 0;
}

function crime(state, kind) {
  state.hooks.onCrime(kind);
  if (kind === 'steal') addHeat(state, WANTED.steal);
  else if (kind === 'hitPed') addHeat(state, WANTED.hitPed);
  else if (kind === 'hitPolice') addHeat(state, WANTED.hitPolice);
  else if (kind === 'killPolice') addHeat(state, WANTED.killPolice);
  else if (kind === 'shoot' && state.crimeCooldowns.shoot <= 0) {
    addHeat(state, WANTED.shoot);
    state.crimeCooldowns.shoot = 2.5;
  }
}

export function hurtPlayer(state, amount) {
  const p = state.player;
  if (p.dead) return;
  p.health -= amount;
  state.hooks.onSound('hurt');
  if (p.health <= 0) {
    p.health = 0;
    p.dead = true;
  }
}

function spawnParticles(state, x, y, n, color, speed, life, size) {
  for (let i = 0; i < n; i += 1) {
    const a = Math.random() * TAU;
    const s = speed * (0.3 + Math.random() * 0.7);
    state.particles.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: life * (0.5 + Math.random() * 0.5), maxLife: life, color, size: size * (0.6 + Math.random() * 0.8),
    });
  }
  if (state.particles.length > 420) state.particles.splice(0, state.particles.length - 420);
}

function shoot(state, from, x, y, angle, damage) {
  state.bullets.push({
    x: x + Math.cos(angle) * 18, y: y + Math.sin(angle) * 18,
    vx: Math.cos(angle) * 980, vy: Math.sin(angle) * 980,
    life: 0.55, damage, fromPlayer: from === 'player', dead: false,
  });
  spawnParticles(state, x + Math.cos(angle) * 20, y + Math.sin(angle) * 20, 2, '#ffd76a', 60, 0.12, 3);
}

// ---------------------------------------------------------------- traffic & crowds

function trafficSpawnPoint(state) {
  return randomRoadPoint(state.city, state.rng, state.player.x, state.player.y, 620, TRAFFIC.spawnRange);
}

function initTrafficCar(state, car, x, y) {
  const city = state.city;
  // Join the nearer road family and take its lane.
  let bestDx = Infinity;
  let cx = 0;
  for (const rx of city.roadsX) { const d = Math.abs(x - rx); if (d < bestDx) { bestDx = d; cx = rx; } }
  let bestDy = Infinity;
  let cy = 0;
  for (const ry of city.roadsY) { const d = Math.abs(y - ry); if (d < bestDy) { bestDy = d; cy = ry; } }
  if (bestDx <= bestDy) {
    car.axis = 'y';
    car.dir = state.rng.sign();
    car.fixed = cx + laneOffset('y', car.dir);
    car.x = car.fixed;
    car.y = y;
    car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  } else {
    car.axis = 'x';
    car.dir = state.rng.sign();
    car.fixed = cy + laneOffset('x', car.dir);
    car.y = car.fixed;
    car.x = x;
    car.angle = car.dir > 0 ? 0 : Math.PI;
  }
  car.targetSpeed = CAR_KINDS[car.kind].topSpeed * state.rng.range(0.45, 0.7);
}

function updateTrafficCar(state, car, dt) {
  const city = state.city;
  const kind = CAR_KINDS[car.kind];
  let want = car.targetSpeed;
  // Keep off the bumper of anything ahead in the same lane.
  for (const other of state.cars) {
    if (other === car || other.dead) continue;
    const ahead = car.axis === 'y'
      ? Math.abs(other.x - car.x) < 24 && (other.y - car.y) * car.dir > 0 && (other.y - car.y) * car.dir < 62
      : Math.abs(other.y - car.y) < 24 && (other.x - car.x) * car.dir > 0 && (other.x - car.x) * car.dir < 62;
    if (ahead) want = Math.min(want, Math.max(0, Math.abs(other.speed) - 8));
  }
  const target = state.player.car ? state.player : state.player;
  if (!state.player.car && Math.hypot(target.x - car.x, target.y - car.y) < 44) want = 0;
  car.speed += Math.sign(want - car.speed) * Math.min(Math.abs(want - car.speed), CAR.accel * 0.7 * dt);
  car.brake = want < car.speed - 4;
  const step = car.speed * car.dir * dt;
  if (car.axis === 'y') car.y += step; else car.x += step;
  car.angle = car.axis === 'y' ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (car.dir > 0 ? 0 : Math.PI);
  // At an intersection, sometimes turn onto the crossing road.
  car.thinkTime -= dt;
  const centres = car.axis === 'y' ? city.roadsY : city.roadsX;
  const along = car.axis === 'y' ? car.y : car.x;
  for (const c of centres) {
    if (Math.abs(along - c) < Math.abs(step) + 2 && car.thinkTime <= 0) {
      car.thinkTime = 0.5;
      if (state.rng.chance(0.38)) {
        const cross = car.axis === 'y' ? car.x : car.y;
        const newAxis = car.axis === 'y' ? 'x' : 'y';
        car.dir = state.rng.sign();
        car.axis = newAxis;
        car.fixed = (newAxis === 'x' ? c : c) + laneOffset(newAxis, car.dir);
        if (newAxis === 'x') { car.y = car.fixed; car.x = cross + car.dir * 4; }
        else { car.x = car.fixed; car.y = cross + car.dir * 4; }
      }
      break;
    }
  }
  if (car.x < -70 || car.y < -70 || car.x > WORLD.width + 70 || car.y > WORLD.height + 70) car.dead = true;
}

function spawnPed(state, x, y, opts) {
  const ped = makePed(x, y, opts);
  state.peds.push(ped);
  return ped;
}

function updatePed(state, ped, dt) {
  const city = state.city;
  const p = state.player;
  if (ped.dead) return;
  let wantSpeed = 0;
  let wantAngle = ped.angle;
  if (ped.police && ped.car) {
    // An officer out of his cruiser: run the player down, or get back in when he drives off.
    const d = dist(ped, p);
    if (p.car || d > 400) {
      wantAngle = Math.atan2(ped.car.y - ped.y, ped.car.x - ped.x);
      wantSpeed = POLICE.footSpeed;
      if (Math.hypot(ped.car.x - ped.x, ped.car.y - ped.y) < 30) {
        ped.dead = true;
        ped.car.officer = null;
        return;
      }
    } else {
      wantAngle = Math.atan2(p.y - ped.y, p.x - ped.x);
      wantSpeed = POLICE.footSpeed;
      ped.gunCooldown -= dt;
      if (starsOf(state) >= 3 && d < POLICE.shootRange && ped.gunCooldown <= 0 && lineOfSight(city, ped.x, ped.y, p.x, p.y)) {
        ped.gunCooldown = POLICE.shootCooldown * (0.8 + Math.random() * 0.5);
        shoot(state, 'police', ped.x, ped.y, wantAngle + (Math.random() - 0.5) * 0.09, POLICE.gunDamage);
        state.hooks.onSound('shot');
      }
    }
  } else if (ped.hostile) {
    const d = dist(ped, p);
    wantAngle = Math.atan2(p.y - ped.y, p.x - ped.x);
    if (d > 190) wantSpeed = 150;
    else if (d < 110) wantSpeed = -60;
    ped.gunCooldown -= dt;
    if (d < 360 && ped.gunCooldown <= 0 && lineOfSight(city, ped.x, ped.y, p.x, p.y)) {
      ped.gunCooldown = 0.95 * (0.75 + Math.random() * 0.6);
      shoot(state, 'hostile', ped.x, ped.y, wantAngle + (Math.random() - 0.5) * 0.11, 8);
      state.hooks.onSound('shot');
    }
  } else if (ped.fleeTime > 0 && ped.fleeFrom) {
    ped.fleeTime -= dt;
    wantAngle = Math.atan2(ped.y - ped.fleeFrom.y, ped.x - ped.fleeFrom.x);
    wantSpeed = 235;
  } else if (!ped.police && !ped.hostile && trafficThreat(state, ped)) {
    const threat = trafficThreat(state, ped);
    wantAngle = Math.atan2(ped.y - threat.y, ped.x - threat.x);
    wantSpeed = 220;
  } else {
    if (!ped.target || Math.hypot(ped.target.x - ped.x, ped.target.y - ped.y) < 16) {
      for (let tries = 0; tries < 8; tries += 1) {
        const tx = ped.x + (Math.random() - 0.5) * 520;
        const ty = ped.y + (Math.random() - 0.5) * 520;
        if (!circleHitsSolid(city, tx, ty, 12) && !inWater(city, tx, ty)) { ped.target = { x: tx, y: ty }; break; }
      }
    }
    if (ped.target) {
      wantAngle = Math.atan2(ped.target.y - ped.y, ped.target.x - ped.x);
      wantSpeed = 74;
    }
  }
  ped.angle = angleLerp(ped.angle, wantAngle, dt * 8);
  ped.speed += (wantSpeed - ped.speed) * Math.min(1, dt * 6);
  let nx = ped.x + Math.cos(ped.angle) * ped.speed * dt;
  let ny = ped.y + Math.sin(ped.angle) * ped.speed * dt;
  if (!inWater(city, nx, ny)) {
    const fixed = resolveCircle(city, nx, ny, 11);
    ped.x = fixed.x;
    ped.y = fixed.y;
  }
  ped.walkPhase += dt * Math.abs(ped.speed) * 0.09;
}

/** The nearest moving car close enough to make a pedestrian jump out of the road. */
function trafficThreat(state, ped) {
  for (const car of state.cars) {
    if (car.dead || Math.abs(car.speed) < 55) continue;
    if (Math.hypot(car.x - ped.x, car.y - ped.y) < 46) return car;
  }
  return null;
}

export function scarePeds(state, x, y, range) {
  for (const ped of state.peds) {
    if (ped.dead || ped.hostile || ped.police) continue;
    if (Math.hypot(ped.x - x, ped.y - y) < range) {
      ped.fleeFrom = { x, y };
      ped.fleeTime = 1.6 + Math.random() * 1.6;
    }
  }
}

// ---------------------------------------------------------------- the law

function desiredPolice(state) {
  const stars = starsOf(state);
  return stars === 0 ? 0 : Math.min(2 + stars, 6);
}

function spawnPolice(state) {
  const p = randomRoadPoint(state.city, state.rng, state.player.x, state.player.y, 640, 940);
  if (!p) return;
  const car = makeCar('police', p.x, p.y, 0, '#e8ecf2', 'police');
  initTrafficCar(state, car, p.x, p.y);
  car.driver = 'police';
  state.cars.push(car);
}

function updatePoliceCar(state, car, dt) {
  const city = state.city;
  const p = state.player;
  const target = p.car ? p.car : p;
  const d = Math.hypot(target.x - car.x, target.y - car.y);
  // Put an officer out when the player is on foot and the cruiser has arrived.
  if (!p.car && !car.officer && d < 120 && Math.abs(car.speed) < 90) {
    car.officer = spawnPed(state, car.x, car.y, { police: true, car, shirt: '#274b8f' });
  }
  const officerOut = Boolean(car.officer && !car.officer.dead);
  let wantSpeed = 0;
  let wantAngle = car.angle;
  if (!officerOut) {
    // Steer for the player; when a building blocks the way, aim for the crossing nearest him.
    let aimX = target.x;
    let aimY = target.y;
    const aheadX = car.x + Math.cos(car.angle) * 60;
    const aheadY = car.y + Math.sin(car.angle) * 60;
    if (circleHitsSolid(city, aheadX, aheadY, 18) || !lineOfSight(city, car.x, car.y, target.x, target.y)) {
      let bx = Infinity;
      let gx = city.roadsX[0];
      for (const rx of city.roadsX) { const dd = Math.abs(rx - target.x); if (dd < bx) { bx = dd; gx = rx; } }
      let by = Infinity;
      let gy = city.roadsY[0];
      for (const ry of city.roadsY) { const dd = Math.abs(ry - target.y); if (dd < by) { by = dd; gy = ry; } }
      if (Math.hypot(gx - car.x, target.y - car.y) < Math.hypot(target.x - car.x, gy - car.y)) { aimX = gx; aimY = target.y; }
      else { aimX = target.x; aimY = gy; }
      if (Math.hypot(aimX - car.x, aimY - car.y) < 40) { aimX = target.x; aimY = target.y; }
    }
    wantAngle = Math.atan2(aimY - car.y, aimX - car.x);
    wantSpeed = d > 46 ? POLICE.carSpeed : 0;
    car.blockedTime = Math.abs(car.speed) < 12 && wantSpeed > 0 ? car.blockedTime + dt : 0;
    if (car.blockedTime > 1.4) {
      // Wedged on a wall: back out and take the nearest road.
      const rp = randomRoadPoint(city, state.rng, car.x, car.y, 60, 320);
      if (rp) { car.x = rp.x; car.y = rp.y; initTrafficCar(state, car, rp.x, rp.y); car.driver = 'police'; }
      car.blockedTime = 0;
    }
  }
  const turnRate = CAR_KINDS.police.turn * CAR.gripTurn * (0.35 + Math.min(1, Math.abs(car.speed) / 200));
  car.angle = angleLerp(car.angle, wantAngle, Math.min(1, turnRate * dt));
  car.speed += Math.sign(wantSpeed - car.speed) * Math.min(Math.abs(wantSpeed - car.speed), CAR.accel * 1.05 * dt);
  car.brake = wantSpeed < car.speed - 6;
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  const fixed = resolveCircle(city, car.x, car.y, 20);
  if (Math.hypot(fixed.x - car.x, fixed.y - car.y) > 2) car.speed *= 0.55;
  car.x = fixed.x;
  car.y = fixed.y;
  // Keep cruisers out of the other cars' bodywork: shove overlapping cars apart.
  for (const other of state.cars) {
    if (other === car || other.dead) continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < 42 * 42 && d2 > 0.01) {
      const d = Math.sqrt(d2);
      const push = (42 - d) / 2;
      other.x += (dx / d) * push;
      other.y += (dy / d) * push;
      car.x -= (dx / d) * push;
      car.y -= (dy / d) * push;
      if (Math.abs(car.speed) > 120) {
        car.health -= 2;
        spawnParticles(state, car.x + dx / 2, car.y + dy / 2, 5, '#ffd76a', 150, 0.3, 3);
        state.hooks.onSound('crash');
      }
      car.speed *= 0.8;
    }
  }
  // A cruiser alongside a walking player is a bust in progress.
  if (!p.car && d < POLICE.bustRange + 14 && Math.abs(car.speed) < 130) {
    p.bustMeter = Math.min(1, p.bustMeter + dt / POLICE.bustTime);
  }
  car.gunCooldown = (car.gunCooldown ?? 0) - dt;
  if (starsOf(state) >= 4 && !p.car && d < POLICE.shootRange && car.gunCooldown <= 0 && lineOfSight(city, car.x, car.y, p.x, p.y)) {
    car.gunCooldown = POLICE.shootCooldown;
    shoot(state, 'police', car.x, car.y, Math.atan2(p.y - car.y, p.x - car.x) + (Math.random() - 0.5) * 0.1, POLICE.gunDamage);
    state.hooks.onSound('shot');
  }
}

// ---------------------------------------------------------------- the player

function nearestCar(state, x, y, range) {
  let best = null;
  let bestD = range;
  for (const car of state.cars) {
    if (car.dead) continue;
    const d = Math.hypot(car.x - x, car.y - y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

export function getNearestCar(state) {
  return nearestCar(state, state.player.x, state.player.y, PLAYER.enterRange);
}

function driveCar(state, car, input, dt) {
  const kind = CAR_KINDS[car.kind];
  const up = input.held('KeyW', 'ArrowUp');
  const down = input.held('KeyS', 'ArrowDown');
  const left = input.held('KeyA', 'ArrowLeft');
  const right = input.held('KeyD', 'ArrowRight');
  const handbrake = input.held('Space');
  if (up) car.speed += CAR.accel * dt;
  if (down) car.speed -= (car.speed > 4 ? CAR.brake : CAR.accel * 0.6) * dt;
  car.brake = down || handbrake;
  const dragK = handbrake ? 2.6 : CAR.drag;
  car.speed -= car.speed * dragK * dt;
  car.speed = Math.max(-CAR.reverseMax, Math.min(kind.topSpeed, car.speed));
  if (Math.abs(car.speed) < 2 && !up && !down) car.speed = 0;
  const steer = (left ? -1 : 0) + (right ? 1 : 0);
  const grip = kind.turn * CAR.gripTurn * Math.min(1, Math.abs(car.speed) / 130) * (handbrake ? 1.5 : 1);
  car.angle += steer * grip * dt * Math.sign(car.speed);
  car.steerVis = steer;
  moveCarBody(state, car, dt, true);
  // Engine and siren state is read by main.js each frame; store what it needs.
  car.playerDriven = true;
}

function moveCarBody(state, car, dt, isPlayer) {
  const px = car.x;
  const py = car.y;
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  if (inWater(state.city, car.x, car.y)) {
    car.x = px;
    car.y = py;
    car.speed *= 0.4;
  }
  const fixed = resolveCircle(state.city, car.x, car.y, 21);
  const hitWall = Math.hypot(fixed.x - car.x, fixed.y - car.y);
  car.x = fixed.x;
  car.y = fixed.y;
  if (hitWall > 1.5) {
    const impact = Math.abs(car.speed);
    if (impact > 130) {
      car.health -= (impact - 110) * 0.09;
      spawnParticles(state, car.x, car.y, 8, '#ffd76a', 190, 0.4, 3);
      state.hooks.onSound('crash');
      if (isPlayer && car.kind === 'police') crime(state, 'hitPolice');
    }
    car.speed *= -0.18;
  }
  // Other cars: a soft shove apart, damage only at speed.
  for (const other of state.cars) {
    if (other === car || other.dead) continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < 42 * 42 && d2 > 0.01) {
      const d = Math.sqrt(d2);
      const push = (42 - d) / 2;
      other.x += (dx / d) * push;
      other.y += (dy / d) * push;
      car.x -= (dx / d) * push;
      car.y -= (dy / d) * push;
      const impact = Math.abs(car.speed - other.speed);
      if (impact > 120) {
        car.health -= 4;
        other.health -= 4;
        spawnParticles(state, car.x + dx / 2, car.y + dy / 2, 7, '#ffb35c', 170, 0.35, 3);
        state.hooks.onSound('crash');
        if (isPlayer && other.kind === 'police') crime(state, 'hitPolice');
      }
      car.speed *= 0.72;
      other.speed *= 0.72;
    }
  }
  // Pedestrians in the road.
  for (const ped of state.peds) {
    if (ped.dead) continue;
    const d = Math.hypot(ped.x - car.x, ped.y - car.y);
    if (d < 30 && Math.abs(car.speed) > 26) {
      ped.health -= Math.abs(car.speed) * 0.55;
      spawnParticles(state, ped.x, ped.y, 6, '#e5534b', 140, 0.4, 3);
      if (ped.health <= 0) killPed(state, ped, isPlayer);
      else ped.fleeFrom = { x: car.x, y: car.y }, ped.fleeTime = 2;
      if (isPlayer) crime(state, ped.police ? 'hitPolice' : 'hitPed');
      car.speed *= 0.82;
    } else if (d < 54 && Math.abs(car.speed) > 120) {
      ped.fleeFrom = { x: car.x, y: car.y };
      ped.fleeTime = Math.max(ped.fleeTime, 1.2);
    }
  }
  if (Math.abs(car.speed) > 235 && (car.steerVis ?? 0) !== 0 && state.rng.chance(0.5)) {
    state.skids.push({ x: car.x, y: car.y, angle: car.angle, life: 5 });
    if (state.skids.length > 500) state.skids.shift();
  }
  if (car.health <= 0 && !car.dead) {
    car.dead = true;
    spawnParticles(state, car.x, car.y, 22, '#5a5a5a', 90, 1.4, 6);
    spawnParticles(state, car.x, car.y, 12, '#ff8c42', 150, 0.6, 4);
  }
}

export function killPed(state, ped, byPlayer) {
  if (ped.dead) return;
  ped.dead = true;
  ped.health = 0;
  spawnParticles(state, ped.x, ped.y, 8, '#e5534b', 120, 0.5, 3);
  if (byPlayer) crime(state, ped.police ? 'killPolice' : 'hitPed');
  if (ped.police && ped.car) ped.car.officer = null;
}

function updatePlayerFoot(state, input, actions, dt) {
  const p = state.player;
  const city = state.city;
  const axes = input.moveAxes();
  const sprint = input.held('ShiftLeft', 'ShiftRight');
  const speed = sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
  let mx = axes.x;
  let my = axes.y;
  const len = Math.hypot(mx, my);
  if (len > 0) {
    mx /= len;
    my /= len;
    const nx = p.x + mx * speed * dt;
    const ny = p.y + my * speed * dt;
    if (!inWater(city, nx, p.y)) p.x = nx;
    if (!inWater(city, p.x, ny)) p.y = ny;
    const fixed = resolveCircle(city, p.x, p.y, PLAYER.radius);
    p.x = fixed.x;
    p.y = fixed.y;
    p.walkPhase += dt * speed * 0.075;
  }
  // Face the mouse aim; when the mouse has not moved, face the walk direction.
  if (Math.hypot(state.aim.x - p.x, state.aim.y - p.y) > 8) {
    p.angle = Math.atan2(state.aim.y - p.y, state.aim.x - p.x);
  } else if (len > 0) {
    p.angle = Math.atan2(my, mx);
  }
  // Combat: the mouse shoots, F punches.
  p.gunCooldown -= dt;
  if (p.reloadTime > 0) {
    p.reloadTime -= dt;
    if (p.reloadTime <= 0) p.ammo = PLAYER.magazine;
  }
  if (input.mouse.down && p.gunCooldown <= 0 && p.reloadTime <= 0) {
    if (p.ammo <= 0) {
      p.reloadTime = 0.9;
      state.hooks.onSound('ui');
    } else {
      p.ammo -= 1;
      p.gunCooldown = PLAYER.gunCooldown;
      shoot(state, 'player', p.x, p.y, p.angle + (Math.random() - 0.5) * 0.03, PLAYER.gunDamage);
      state.hooks.onSound('shot');
      crime(state, 'shoot');
      scarePeds(state, p.x, p.y, 320);
    }
  }
  if (input.held('KeyF')) {
    p.gunCooldown = Math.max(p.gunCooldown, 0.3);
    for (const ped of state.peds) {
      if (ped.dead) continue;
      const d = Math.hypot(ped.x - p.x, ped.y - p.y);
      const ang = Math.atan2(ped.y - p.y, ped.x - p.x);
      let da = Math.abs(ang - p.angle) % TAU;
      if (da > Math.PI) da = TAU - da;
      if (d < PLAYER.punchRange && da < 1.1) {
        ped.health -= PLAYER.punchDamage;
        ped.fleeFrom = { x: p.x, y: p.y };
        ped.fleeTime = 2;
        state.hooks.onSound('punch');
        if (ped.health <= 0) killPed(state, ped, true);
        else crime(state, ped.police ? 'hitPolice' : 'hitPed');
      }
    }
  }
  if (input.held('KeyR') && p.reloadTime <= 0 && p.ammo < PLAYER.magazine) p.reloadTime = 0.9;
  // Packages: golden palms are picked up by walking over them.
  for (const pack of city.packages) {
    if (pack.taken || state.packagesFound.has(pack.id)) continue;
    if (Math.hypot(pack.x - p.x, pack.y - p.y) < 24) {
      pack.taken = true;
      state.packagesFound.add(pack.id);
      state.hooks.onPackage(pack);
      state.hooks.onSound('pickup');
    }
  }
  // Getting in and out of cars.
  if (actions.interact) {
    const car = nearestCar(state, p.x, p.y, PLAYER.enterRange);
    if (car) {
      if (car.driver === 'traffic') {
        // Yank the driver out: a ped appears at the door and runs.
        const ped = spawnPed(state, car.x + 24, car.y, {});
        ped.fleeFrom = { x: p.x, y: p.y };
        ped.fleeTime = 3;
        crime(state, 'steal');
      } else if (car.driver === 'parked') {
        crime(state, 'steal');
      }
      if (car.kind === 'police' && car.driver === 'police') crime(state, 'steal');
      car.driver = 'player';
      car.playerDriven = true;
      p.car = car;
      state.hooks.onEnterCar(car);
    }
  }
  // The bust meter drains when no officer is on top of the player.
  let busted = false;
  for (const ped of state.peds) {
    if (ped.police && !ped.dead && Math.hypot(ped.x - p.x, ped.y - p.y) < POLICE.bustRange) {
      p.bustMeter = Math.min(1, p.bustMeter + dt / POLICE.bustTime);
      busted = true;
    }
  }
  if (!busted) p.bustMeter = Math.max(0, p.bustMeter - dt * 0.7);
}

function updatePlayerCar(state, input, actions, dt) {
  const p = state.player;
  const car = p.car;
  driveCar(state, car, input, dt);
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  p.bustMeter = Math.max(0, p.bustMeter - dt);
  if (car.dead) {
    p.car = null;
    car.driver = 'none';
    hurtPlayer(state, 12);
    const spot = resolveCircle(state.city, car.x + 36, car.y, PLAYER.radius);
    p.x = spot.x;
    p.y = spot.y;
    return;
  }
  if (actions.interact) {
    const side = car.angle + Math.PI / 2;
    const spot = resolveCircle(state.city, car.x + Math.cos(side) * 34, car.y + Math.sin(side) * 34, PLAYER.radius);
    p.x = spot.x;
    p.y = spot.y;
    car.driver = 'parked';
    car.playerDriven = false;
    p.car = null;
  }
}

// ---------------------------------------------------------------- bullets & air

function updateBullets(state, dt) {
  const city = state.city;
  for (const b of state.bullets) {
    if (b.dead) continue;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.life <= 0 || circleHitsSolid(city, b.x, b.y, 2) || inWater(city, b.x, b.y)) {
      if (b.life > 0) spawnParticles(state, b.x, b.y, 2, '#ffe9a8', 70, 0.18, 2);
      b.dead = true;
      continue;
    }
    if (b.fromPlayer) {
      for (const ped of state.peds) {
        if (ped.dead) continue;
        if (Math.hypot(ped.x - b.x, ped.y - b.y) < 13) {
          ped.health -= b.damage;
          b.dead = true;
          spawnParticles(state, ped.x, ped.y, 5, '#e5534b', 120, 0.35, 3);
          if (ped.health <= 0) killPed(state, ped, true);
          else if (!ped.hostile && !ped.police) crime(state, 'hitPed');
          break;
        }
      }
      if (b.dead) continue;
      for (const car of state.cars) {
        if (car.dead || car === state.player.car) continue;
        if (Math.hypot(car.x - b.x, car.y - b.y) < 27) {
          car.health -= b.damage * 0.5;
          b.dead = true;
          spawnParticles(state, b.x, b.y, 3, '#ffd76a', 130, 0.25, 2);
          if (car.health <= 0) {
            car.dead = true;
            spawnParticles(state, car.x, car.y, 18, '#5a5a5a', 90, 1.2, 6);
          }
          break;
        }
      }
    } else if (!state.player.car && Math.hypot(state.player.x - b.x, state.player.y - b.y) < 13) {
      b.dead = true;
      hurtPlayer(state, b.damage);
    } else if (state.player.car && Math.hypot(state.player.car.x - b.x, state.player.car.y - b.y) < 27) {
      b.dead = true;
      state.player.car.health -= b.damage * 0.4;
      hurtPlayer(state, b.damage * 0.35);
    }
  }
  state.bullets = state.bullets.filter((b) => !b.dead);
}

// ---------------------------------------------------------------- the step

export function updateGame(state, input, actions, dt) {
  state.time += dt;
  const city = state.city;
  const p = state.player;
  state.crimeCooldowns.shoot = Math.max(0, state.crimeCooldowns.shoot - dt);

  if (p.car) updatePlayerCar(state, input, actions, dt);
  else updatePlayerFoot(state, input, actions, dt);

  // Keep the streets populated near the player, and clear the far ones.
  const trafficCars = state.cars.filter((c) => c.driver === 'traffic');
  if (trafficCars.length < TRAFFIC.targetCars && state.rng.chance(0.3)) {
    const spot = trafficSpawnPoint(state);
    if (spot) {
      const car = makeCar(state.rng.pick(['sedan', 'hatch', 'taxi', 'truck', 'sport']), spot.x, spot.y, 0, state.rng.pick(CAR_PAINTS), 'traffic');
      initTrafficCar(state, car, spot.x, spot.y);
      state.cars.push(car);
    }
  }
  const walkers = state.peds.filter((q) => !q.police && !q.hostile);
  if (walkers.length < TRAFFIC.targetPeds && state.rng.chance(0.3)) {
    const a = Math.random() * TAU;
    const d = state.rng.range(380, 760);
    const x = p.x + Math.cos(a) * d;
    const y = p.y + Math.sin(a) * d;
    if (!circleHitsSolid(city, x, y, 12) && !inWater(city, x, y)) spawnPed(state, x, y, {});
  }

  for (const car of state.cars) {
    if (car.dead) continue;
    if (car.driver === 'traffic') updateTrafficCar(state, car, dt);
    else if (car.driver === 'police') updatePoliceCar(state, car, dt);
    else if (car.driver !== 'player' && car.speed !== 0) {
      car.speed -= car.speed * 2.2 * dt;
      moveCarBody(state, car, dt, false);
    }
  }
  for (const ped of state.peds) updatePed(state, ped, dt);
  updateBullets(state, dt);

  // Wanted: who can see the player decides whether the heat cools.
  let seen = false;
  for (const car of state.cars) {
    if (car.driver !== 'police' || car.dead) continue;
    if (Math.hypot(car.x - p.x, car.y - p.y) < POLICE.sightRange) { seen = true; break; }
  }
  if (!seen) {
    for (const ped of state.peds) {
      if (ped.police && !ped.dead && Math.hypot(ped.x - p.x, ped.y - p.y) < 300) { seen = true; break; }
    }
  }
  state.wanted.seen = seen;
  if (seen) state.wanted.unseenTime = 0;
  else {
    state.wanted.unseenTime += dt;
    if (state.wanted.unseenTime > WANTED.hideTime) {
      state.wanted.heat = Math.max(0, state.wanted.heat - WANTED.decay * dt);
    }
  }
  const want = desiredPolice(state);
  const policeNow = state.cars.filter((c) => c.driver === 'police' && !c.dead).length;
  if (policeNow < want && state.rng.chance(0.06 + starsOf(state) * 0.03)) spawnPolice(state);

  // Clean-up: the dead and the distant leave the world.
  state.cars = state.cars.filter((car) => {
    if (car === p.car) return true;
    const d = Math.hypot(car.x - p.x, car.y - p.y);
    if (car.dead && d < 700) return true;
    if (car.driver === 'traffic' && d > TRAFFIC.despawnRange) return false;
    if (car.driver === 'police' && d > 1500 && starsOf(state) === 0) return false;
    return !car.dead || d < 700;
  });
  state.peds = state.peds.filter((ped) => {
    const d = Math.hypot(ped.x - p.x, ped.y - p.y);
    if (ped.police || ped.hostile) return !ped.dead || d < 300;
    return d < 1100;
  });
  for (const pt of state.particles) {
    pt.life -= dt;
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vx *= 0.94;
    pt.vy *= 0.94;
  }
  state.particles = state.particles.filter((pt) => pt.life > 0);
  for (const skid of state.skids) skid.life -= dt;
  state.skids = state.skids.filter((s) => s.life > 0);

  if (p.dead) return EVENT_WASTED;
  if (p.bustMeter >= 1) return EVENT_BUSTED;
  return EVENT_NONE;
}

/** A fresh traffic-style car placed by the story (the tail target, the marked Comet). */
export function placeStoryCar(state, kind, x, y, angle, paint, tag) {
  const car = makeCar(kind, x, y, angle, paint, 'parked');
  car.missionTag = tag;
  state.cars.push(car);
  return car;
}

/** Put a car under AI traffic control (the tail target drives itself). */
export function makeCarDrive(state, car) {
  car.driver = 'traffic';
  initTrafficCar(state, car, car.x, car.y);
}
