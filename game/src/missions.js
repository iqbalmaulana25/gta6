// The story of Solano Heat, as a chain of jobs for fixer Lena Costa, and the small engine
// that runs them: each mission is a list of steps (go somewhere, pick something up, steal a
// particular car, tail a sedan, clear a shootout, run for the boat). The engine watches the
// world through entities.js state, moves the objective marker the HUD draws, pays out, and
// offers the next job back at Café Azul. Dario Venn — the player — is new in Port Solano;
// Lena's jobs are how he stops being new.

import { addHeat, makeCarDrive, makePed, placeStoryCar } from './entities.js';

export const MISSION_DEFS = [
  {
    id: 'first-run',
    title: 'First Run',
    reward: 450,
    intro: 'Lena: A crate at the Marina Warehouse needs to reach the Palmetto Hotel. Quietly, Dario.',
    steps: [
      { kind: 'goto', at: 'docks', radius: 90, text: 'Drive to the Marina Warehouse' },
      { kind: 'pickup', at: 'docks', radius: 36, text: 'Collect the crate from the warehouse door' },
      { kind: 'goto', at: 'hotel', radius: 70, text: 'Deliver the crate to the Palmetto Hotel' },
    ],
  },
  {
    id: 'borrowed-wheels',
    title: 'Borrowed Wheels',
    reward: 800,
    intro: 'Lena: A Comet GT is sitting in a downtown lot, and its owner owes me. Bring it to my garage.',
    steps: [
      { kind: 'steal', tag: 'comet', text: 'Steal the Comet GT from the downtown lot' },
      { kind: 'deliverCar', tag: 'comet', at: 'garage', radius: 78, text: "Bring the Comet to Lena's garage" },
    ],
  },
  {
    id: 'quiet-tail',
    title: 'A Quiet Tail',
    reward: 650,
    intro: 'Lena: A grey sedan just left the bank. Follow it home — close enough to watch, far enough to breathe.',
    steps: [
      { kind: 'tail', tag: 'tail', duration: 70, text: 'Tail the grey sedan — stay between 110 and 430 paces' },
    ],
  },
  {
    id: 'dockside-noise',
    title: 'Dockside Noise',
    reward: 1200,
    intro: 'Lena: The crew at my warehouse stopped answering. Go there and make the docks quiet again.',
    steps: [
      { kind: 'goto', at: 'docks', radius: 110, text: 'Go to the Marina Warehouse' },
      { kind: 'shootout', count: 5, at: 'docks', radius: 300, text: 'Clear the smugglers off the docks' },
    ],
  },
  {
    id: 'solano-score',
    title: 'The Solano Score',
    reward: 3000,
    intro: 'Lena: One last job, love. The bank bag, the marina boat, and every badge in Solano between you and it.',
    steps: [
      { kind: 'goto', at: 'bank', radius: 80, text: 'Go to the Solano Trust Bank' },
      { kind: 'pickup', at: 'bank', radius: 36, text: 'Grab the money bag from the bank door', alarm: true },
      { kind: 'escape', at: 'boat', radius: 52, text: 'Reach the getaway boat at the marina pier' },
    ],
  },
];

export function createMissionState() {
  return {
    nextIndex: 0,
    active: null,
    storyComplete: false,
    objective: null,
    phone: null,
    banner: null,
  };
}

function landmarkPoint(state, at) {
  const city = state.city;
  if (at === 'boat') return { x: city.boat.x + city.boat.w / 2, y: city.boat.y };
  const lm = city.landmarks[at];
  return { x: lm.doorX, y: lm.doorY };
}

function setPhone(state, text, seconds = 6) {
  state.missions.phone = { from: 'Lena Costa', text, t: seconds };
}

function setBanner(state, title, sub, seconds = 3.6) {
  state.missions.banner = { title, sub, t: seconds };
}

function startMission(state, def) {
  const m = state.missions;
  m.active = { def, stepIndex: 0, step: null, data: {} };
  setPhone(state, def.intro, 7);
  setBanner(state, def.title, 'A job for Lena Costa', 3.2);
  state.hooks.onSound('mission');
  beginStep(state);
}

function beginStep(state) {
  const m = state.missions;
  const a = m.active;
  if (!a) return;
  const def = a.def.steps[a.stepIndex];
  a.step = { ...def, t: 0, tooClose: 0, lost: 0, hostiles: [] };
  const city = state.city;
  if (def.kind === 'steal' && def.tag === 'comet') {
    // The marked Comet waits in the lot nearest the city centre.
    let best = null;
    let bestD = Infinity;
    for (const lot of city.lots) {
      const cx = lot.x + lot.w / 2;
      const cy = lot.y + lot.h / 2;
      const d = Math.hypot(cx - 1470, cy - 1050);
      if (d < bestD) { bestD = d; best = lot; }
    }
    const bay = best.bays[2] ?? { x: best.x + 40, y: best.y + 40 };
    placeStoryCar(state, 'sport', bay.x + 22, bay.y + 24, Math.PI / 2, '#e8b10e', 'comet');
  }
  if (def.kind === 'tail') {
    const bank = landmarkPoint(state, 'bank');
    const car = placeStoryCar(state, 'sedan', bank.x, bank.y - 130, 0, '#8c8c92', 'tail');
    makeCarDrive(state, car);
    a.data.target = car;
  }
  if (def.kind === 'shootout') {
    const centre = landmarkPoint(state, 'docks');
    for (let i = 0; i < def.count; i += 1) {
      const ang = (i / def.count) * Math.PI * 2;
      const hx = centre.x + Math.cos(ang) * 130;
      const hy = centre.y + Math.sin(ang) * 90 - 40;
      const ped = makePed(hx, hy, { hostile: true, shirt: '#3a3f4a' });
      state.peds.push(ped);
      a.step.hostiles.push(ped);
    }
  }
}

function completeStep(state) {
  const m = state.missions;
  const a = m.active;
  const def = a.def;
  if (a.step.alarm) {
    addHeat(state, Math.max(0, 4 - state.wanted.heat) + 0.2);
    setPhone(state, 'Lena: Alarm\'s singing, love. Marina pier, the white boat — GO.', 6);
    state.hooks.onSound('cash');
  }
  a.stepIndex += 1;
  if (a.stepIndex >= def.steps.length) {
    state.player.money += def.reward;
    m.active = null;
    m.nextIndex += 1;
    setBanner(state, 'Mission complete', `${def.title} — $${def.reward}`, 4);
    setPhone(state, m.nextIndex >= MISSION_DEFS.length
      ? 'Lena: That was the last of it. The city is yours now, Dario. Don\'t waste it.'
      : 'Lena: Good work. Come by Café Azul when you want more.', 7);
    state.hooks.onSound('mission');
    if (m.nextIndex >= MISSION_DEFS.length) m.storyComplete = true;
    state.hooks.onMissionComplete?.(def);
  } else {
    beginStep(state);
  }
}

export function failMission(state, reason) {
  const m = state.missions;
  if (!m.active) return;
  setBanner(state, 'Mission failed', reason, 4);
  setPhone(state, 'Lena: Shake it off and come back to Café Azul. We run it again.', 6);
  state.hooks.onSound('fail');
  // Story cars left behind become ordinary parked cars.
  for (const car of state.cars) if (car.missionTag) car.missionTag = null;
  m.active = null;
}

export function attachMissions(state) {
  state.missions = createMissionState();
  state.hooks.onMissionComplete = state.hooks.onMissionComplete ?? null;
  return state.missions;
}

export function updateMissions(state, dt) {
  const m = state.missions;
  const p = state.player;
  if (m.phone) {
    m.phone.t -= dt;
    if (m.phone.t <= 0) m.phone = null;
  }
  if (m.banner) {
    m.banner.t -= dt;
    if (m.banner.t <= 0) m.banner = null;
  }
  if (!m.active) {
    if (m.storyComplete) {
      m.objective = null;
      return;
    }
    const cafe = landmarkPoint(state, 'cafe');
    m.objective = { x: cafe.x, y: cafe.y, text: 'See Lena at Café Azul', sub: MISSION_DEFS[m.nextIndex]?.title ?? '' };
    if (!p.car && Math.hypot(p.x - cafe.x, p.y - cafe.y) < 40) startMission(state, MISSION_DEFS[m.nextIndex]);
    return;
  }
  const a = m.active;
  const step = a.step;
  step.t += dt;
  const finish = () => completeStep(state);
  if (step.kind === 'goto' || step.kind === 'escape') {
    const at = landmarkPoint(state, step.at);
    m.objective = { x: at.x, y: at.y, text: step.text, sub: a.def.title };
    if (Math.hypot(p.x - at.x, p.y - at.y) < step.radius) finish();
  } else if (step.kind === 'pickup') {
    const at = landmarkPoint(state, step.at);
    m.objective = { x: at.x, y: at.y, text: step.text, sub: a.def.title };
    if (!p.car && Math.hypot(p.x - at.x, p.y - at.y) < step.radius) finish();
  } else if (step.kind === 'steal') {
    const car = state.cars.find((c) => c.missionTag === step.tag);
    m.objective = car ? { x: car.x, y: car.y, text: step.text, sub: a.def.title } : null;
    if (car && p.car === car) {
      addHeat(state, 1);
      finish();
    } else if (!car) failMission(state, 'The car is gone.');
  } else if (step.kind === 'deliverCar') {
    const at = landmarkPoint(state, step.at);
    m.objective = { x: at.x, y: at.y, text: step.text, sub: a.def.title };
    if (p.car && p.car.missionTag === step.tag && Math.hypot(p.x - at.x, p.y - at.y) < step.radius) {
      p.car.missionTag = null;
      p.car.driver = 'parked';
      p.car = null;
      state.player.x = at.x;
      state.player.y = at.y + 30;
      finish();
    }
  } else if (step.kind === 'tail') {
    const target = a.data.target;
    if (!target || target.dead) {
      failMission(state, 'The sedan is wrecked.');
      return;
    }
    const d = Math.hypot(p.x - target.x, p.y - target.y);
    m.objective = { x: target.x, y: target.y, text: step.text, sub: `Follow — ${Math.max(0, Math.ceil(step.duration - step.t))}s` };
    if (d < 110) step.tooClose += dt; else step.tooClose = Math.max(0, step.tooClose - dt);
    if (d > 430) step.lost += dt; else step.lost = Math.max(0, step.lost - dt * 2);
    if (step.tooClose > 3) failMission(state, 'You spooked the sedan.');
    else if (step.lost > 8) failMission(state, 'You lost the sedan.');
    else if (step.t >= step.duration) {
      target.missionTag = null;
      finish();
    }
  } else if (step.kind === 'shootout') {
    const at = landmarkPoint(state, step.at);
    const alive = step.hostiles.filter((h) => !h.dead).length;
    m.objective = { x: at.x, y: at.y, text: `${step.text} — ${alive} left`, sub: a.def.title };
    if (alive === 0 && step.t > 0.5) finish();
  }
}

/** Restore progress loaded from a save: which job is next, and the ending flag. */
export function restoreMissions(state, saved) {
  const m = state.missions;
  m.nextIndex = Math.min(saved.missionIndex ?? 0, MISSION_DEFS.length);
  m.storyComplete = m.nextIndex >= MISSION_DEFS.length;
}
