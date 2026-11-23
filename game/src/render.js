// Everything the eye gets: Port Solano drawn top-down with a low sun — buildings lift a
// shaded south wall and a bright roof, the sea moves, palms lean over Ocean Drive. The camera
// follows the player (or their car) with a little look-ahead toward speed and aim. Screen
// furniture — HUD, minimap, menus — lives in hud.js; this file paints only the world and the
// people and machines in it.

import { CAR, FONT, MARKER_COLORS, PALETTE, WORLD } from './config.js';
import { BEACH_Y, WATER_Y } from './city.js';
import { starsOf } from './entities.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_COMPLETE = 'complete';
export const SCREEN_HOWTO = 'howto';

/** Deterministic 0..1 hash from two integers, for window patterns and roof clutter. */
function hash2(a, b) {
  let h = (a * 374761393 + b * 668265263) ^ 0x5bf03635;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const camera = { x: 0, y: 0, locked: false };

  function viewSize() {
    const scale = canvas.height / 620;
    return { scale, w: canvas.width / scale, h: 620 };
  }

  function updateCamera(state, dt) {
    if (camera.locked) return;
    const p = state.player;
    const lead = p.car ? 0.24 : 0.12;
    const tx = p.x + (state.aim.x - p.x) * lead * 0.4 + (p.car ? Math.cos(p.car.angle) * p.car.speed * 0.22 : 0);
    const ty = p.y + (state.aim.y - p.y) * lead * 0.4 + (p.car ? Math.sin(p.car.angle) * p.car.speed * 0.22 : 0);
    const { w, h } = viewSize();
    const k = Math.min(1, dt * 5);
    camera.x += (tx - camera.x) * k;
    camera.y += (ty - camera.y) * k;
    camera.x = Math.max(w / 2, Math.min(WORLD.width - w / 2, camera.x));
    camera.y = Math.max(h / 2, Math.min(WORLD.height - h / 2, camera.y));
  }

  function drawBuilding(b, t) {
    const lift = 10 + b.floors * 4.5;
    ctx.fillStyle = 'rgba(30,20,10,0.20)';
    ctx.fillRect(b.x + 7, b.y + 9, b.w, b.h);
    // South wall, then the roof lifted above the footprint.
    ctx.fillStyle = shade(b.skin.wall, -18);
    ctx.fillRect(b.x, b.y + b.h - lift, b.w, lift);
    ctx.fillStyle = b.skin.roof;
    ctx.fillRect(b.x, b.y - lift, b.w, b.h);
    ctx.strokeStyle = PALETTE.roofTrim;
    ctx.strokeRect(b.x + 0.5, b.y - lift + 0.5, b.w - 1, b.h - 1);
    // Windows on the sunlit wall.
    const cols = Math.max(2, Math.floor(b.w / 26));
    const rows = Math.max(1, Math.floor(lift / 13));
    for (let i = 0; i < cols; i += 1) {
      for (let j = 0; j < rows; j += 1) {
        const lit = hash2(b.seed, i * 31 + j * 7) > 0.42;
        ctx.fillStyle = lit ? '#ffe9a8' : '#5a6b7a';
        ctx.fillRect(b.x + 8 + i * ((b.w - 14) / cols), b.y + b.h - lift + 4 + j * 12, 9, 7);
      }
    }
    // Roof clutter: a water tank or vents, placed by the building's own seed.
    if (b.w > 90 && b.h > 80) {
      ctx.fillStyle = 'rgba(0,0,0,0.16)';
      const cx = b.x + 14 + hash2(b.seed, 99) * (b.w - 60);
      const cy = b.y - lift + 12 + hash2(b.seed, 7) * (b.h - 50);
      ctx.fillRect(cx, cy, 30, 20);
    }
    if (b.name) {
      ctx.font = `600 ${Math.max(13, Math.min(19, b.w / 9))}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(20,16,8,0.82)';
      const label = b.name.toUpperCase();
      const w = ctx.measureText(label).width + 18;
      ctx.fillRect(b.x + b.w / 2 - w / 2, b.y - lift + 10, w, 24);
      ctx.fillStyle = '#ffd76a';
      ctx.fillText(label, b.x + b.w / 2, b.y - lift + 27);
    }
  }

  function drawCar(car, t) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(-CAR.length / 2 + 3, -CAR.width / 2 + 4, CAR.length, CAR.width);
    // Wheels.
    ctx.fillStyle = '#15181c';
    const wy = CAR.width / 2 - 2;
    for (const [wx, wyy] of [[-17, -wy], [17, -wy], [-17, wy - 3], [17, wy - 3]]) {
      ctx.fillRect(wx - 5, wyy, 11, 4.5);
    }
    // Body.
    const body = car.kind === 'police' ? PALETTE.policeCar : car.paint;
    ctx.fillStyle = car.dead ? '#3c3c40' : body;
    roundRect(-CAR.length / 2, -CAR.width / 2, CAR.length, CAR.width, 6);
    ctx.fill();
    if (car.kind === 'truck') {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillRect(-CAR.length / 2 + 4, -CAR.width / 2 + 3, 26, CAR.width - 6);
    }
    // Cabin and glass.
    ctx.fillStyle = '#1d2733';
    roundRect(-6, -CAR.width / 2 + 4, 17, CAR.width - 8, 3);
    ctx.fill();
    ctx.fillStyle = 'rgba(160,210,240,0.5)';
    ctx.fillRect(9, -CAR.width / 2 + 5, 3.5, CAR.width - 10);
    if (car.kind === 'sport') {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(-CAR.length / 2 + 1, -CAR.width / 2 + 2, 5, CAR.width - 4);
    }
    if (car.kind === 'police') {
      ctx.fillStyle = PALETTE.policeTrim;
      ctx.fillRect(-CAR.length / 2 + 6, -3, CAR.length - 12, 6);
      const flash = Math.floor(t * 5) % 2 === 0;
      ctx.fillStyle = flash ? '#ff4444' : '#662222';
      ctx.fillRect(-4, -7, 8, 5);
      ctx.fillStyle = flash ? '#224466' : '#4488ff';
      ctx.fillRect(-4, 2, 8, 5);
      ctx.font = `700 8px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = PALETTE.policeTrim;
      ctx.fillText('PD', 2, -6);
      if (car.roadblock) {
        // The roadblock livery: amber bands along both flanks, visible across the street.
        ctx.fillStyle = '#ff9d2e';
        ctx.fillRect(-CAR.length / 2 + 2, -CAR.width / 2 + 1, CAR.length - 4, 3);
        ctx.fillRect(-CAR.length / 2 + 2, CAR.width / 2 - 4, CAR.length - 4, 3);
      }
    }
    if (car.kind === 'taxi') {
      ctx.fillStyle = '#14181d';
      ctx.fillRect(-3, -5, 10, 10);
      ctx.fillStyle = '#ffd23e';
      ctx.font = `700 7px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('TAXI', 2, 2.5);
    }
    if (car.brake) {
      ctx.fillStyle = '#ff3b30';
      ctx.fillRect(-CAR.length / 2 - 1.5, -CAR.width / 2 + 2, 3, 6);
      ctx.fillRect(-CAR.length / 2 - 1.5, CAR.width / 2 - 8, 3, 6);
    }
    ctx.restore();
    if (!car.dead && car.health < 42) {
      const puffs = 2 + Math.floor(hash2(car.id, Math.floor(t * 3)) * 2);
      ctx.fillStyle = 'rgba(70,70,70,0.35)';
      for (let i = 0; i < puffs; i += 1) {
        const r = 5 + hash2(car.id * 7, Math.floor(t * 3) + i) * 8;
        ctx.beginPath();
        ctx.arc(car.x + (hash2(car.id, i) - 0.5) * 16, car.y - 8 - i * 7 - (t * 9 % 7), r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (car.missionTag) {
      const bob = Math.sin(t * 4) * 4;
      ctx.fillStyle = PALETTE.marker;
      ctx.save();
      ctx.translate(car.x, car.y - 46 + bob);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-8, -8, 16, 16);
      ctx.restore();
    }
  }

  function drawPed(ped, t) {
    ctx.save();
    ctx.translate(ped.x, ped.y);
    if (ped.dead) {
      ctx.rotate(ped.angle + Math.PI / 2);
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath(); ctx.ellipse(1, 2, 15, 7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = ped.shirt ?? '#888';
      ctx.beginPath(); ctx.ellipse(0, 0, 13, 6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e8b98d';
      ctx.beginPath(); ctx.arc(15, 0, 5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      return;
    }
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath(); ctx.ellipse(1.5, 3, 9, 5.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.rotate(ped.angle);
    const stride = Math.sin(ped.walkPhase) * (Math.abs(ped.speed) > 12 ? 5 : 0);
    ctx.strokeStyle = '#2c3140';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(-3 + stride, 5);
    ctx.moveTo(0, 0); ctx.lineTo(-3 - stride, -5);
    ctx.stroke();
    ctx.fillStyle = ped.shirt ?? '#b0563a';
    ctx.beginPath(); ctx.arc(0, 0, 8.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e8b98d';
    ctx.beginPath(); ctx.arc(3.5, 0, 5, 0, Math.PI * 2); ctx.fill();
    if (ped.police) {
      ctx.fillStyle = '#1d3a6e';
      ctx.beginPath(); ctx.arc(4.5, 0, 5.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffd23e';
      ctx.fillRect(3, -1, 3.4, 2);
    }
    if (ped.hostile) {
      ctx.strokeStyle = '#14181d';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(6, 3); ctx.lineTo(17, 4); ctx.stroke();
    }
    ctx.restore();
  }

  function drawPlayer(state, t) {
    const p = state.player;
    if (p.car) return;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(1.5, 3, 10, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.rotate(p.angle);
    const stride = Math.sin(p.walkPhase) * 5.5;
    ctx.strokeStyle = '#23283b';
    ctx.lineWidth = 4.4;
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(-3 + stride, 5.5);
    ctx.moveTo(0, 0); ctx.lineTo(-3 - stride, -5.5);
    ctx.stroke();
    ctx.fillStyle = PALETTE.player;
    ctx.beginPath(); ctx.arc(0, 0, 9.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#8a4b1f';
    ctx.beginPath(); ctx.arc(-1, 0, 9.5, Math.PI * 0.55, Math.PI * 1.45); ctx.fill();
    ctx.fillStyle = '#e8b98d';
    ctx.beginPath(); ctx.arc(4, 0, 5.2, 0, Math.PI * 2); ctx.fill();
    // The pistol, when the trigger is down or just was.
    if (state.inputDown || p.gunCooldown > 0.1) {
      ctx.strokeStyle = '#14181d';
      ctx.lineWidth = 3.4;
      ctx.beginPath(); ctx.moveTo(7, 3); ctx.lineTo(19, 3.6); ctx.stroke();
    }
    ctx.restore();
  }

  function drawWorld(state, screen) {
    const t = state.time;
    const { scale, w, h } = viewSize();
    const left = camera.x - w / 2;
    const top = camera.y - h / 2;
    ctx.setTransform(scale, 0, 0, scale, -left * scale, -top * scale);
    // Base ground.
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(left - 8, top - 8, w + 16, h + 16);
    const city = state.city;
    // Sea and beach.
    ctx.fillStyle = PALETTE.waterDeep;
    ctx.fillRect(left - 8, WATER_Y, w + 16, WORLD.height - WATER_Y + 8);
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect(left - 8, WATER_Y, w + 16, 60);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i += 1) {
      const y = WATER_Y + 18 + i * 44 + Math.sin(t * 0.9 + i * 1.7) * 4;
      ctx.beginPath();
      for (let x = Math.floor(left / 90) * 90; x < left + w + 90; x += 90) {
        const yy = y + Math.sin(t * 1.3 + x * 0.02 + i) * 3;
        if (x === Math.floor(left / 90) * 90) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(left - 8, BEACH_Y, w + 16, WATER_Y - BEACH_Y);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(left - 8, WATER_Y - 4, w + 16, 3);
    // Parks and lots under the roads' sidewalks.
    for (const park of city.parks) {
      if (!visible(park, left, top, w, h)) continue;
      ctx.fillStyle = PALETTE.grassDark;
      ctx.fillRect(park.x, park.y, park.w, park.h);
      ctx.fillStyle = PALETTE.parkPath;
      ctx.fillRect(park.x, park.y + park.h / 2 - 7, park.w, 14);
      ctx.fillRect(park.x + park.w / 2 - 7, park.y, 14, park.h);
    }
    for (const lot of city.lots) {
      if (!visible(lot, left, top, w, h)) continue;
      ctx.fillStyle = PALETTE.asphaltDark;
      ctx.fillRect(lot.x, lot.y, lot.w, lot.h);
      ctx.strokeStyle = 'rgba(240,240,230,0.5)';
      ctx.lineWidth = 2;
      for (const bay of lot.bays) ctx.strokeRect(bay.x, bay.y, 44, 46);
      ctx.fillStyle = '#ffd23e';
      ctx.font = `700 26px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('P', lot.x + lot.w / 2, lot.y + lot.h / 2 + 9);
    }
    // Roads: sidewalk slab, asphalt, dashes, crosswalks.
    ctx.fillStyle = PALETTE.sidewalk;
    for (const cx of city.roadsX) ctx.fillRect(cx - WORLD.roadWidth / 2 - 7, 0, WORLD.roadWidth + 14, BEACH_Y + 4);
    for (const cy of city.roadsY) ctx.fillRect(0, cy - WORLD.roadWidth / 2 - 7, WORLD.width, WORLD.roadWidth + 14);
    ctx.fillStyle = PALETTE.asphalt;
    for (const cx of city.roadsX) ctx.fillRect(cx - WORLD.roadWidth / 2, 0, WORLD.roadWidth, BEACH_Y + 4);
    for (const cy of city.roadsY) ctx.fillRect(0, cy - WORLD.roadWidth / 2, WORLD.width, WORLD.roadWidth);
    ctx.fillStyle = PALETTE.laneMark;
    for (const cx of city.roadsX) {
      for (let y = 8; y < BEACH_Y; y += 44) {
        if (city.roadsY.some((cy) => Math.abs(y - cy) < 70)) continue;
        ctx.fillRect(cx - 2, y, 4, 24);
      }
    }
    for (const cy of city.roadsY) {
      for (let x = 8; x < WORLD.width; x += 44) {
        if (city.roadsX.some((cx) => Math.abs(x - cx) < 70)) continue;
        ctx.fillRect(x, cy - 2, 24, 4);
      }
    }
    ctx.fillStyle = 'rgba(240,240,230,0.75)';
    for (const cx of city.roadsX) {
      for (const cy of city.roadsY) {
        for (let s = -44; s <= 44; s += 15) ctx.fillRect(cx + s - 4, cy - WORLD.roadWidth / 2 + 4, 8, 10);
        for (let s = -44; s <= 44; s += 15) ctx.fillRect(cx + s - 4, cy + WORLD.roadWidth / 2 - 14, 8, 10);
      }
    }
    // Buildings, piers, trees.
    for (const b of city.buildings) if (visible(b, left, top, w, h)) drawBuilding(b, t);
    for (const pier of city.piers) {
      ctx.fillStyle = '#8a6a44';
      ctx.fillRect(pier.x, pier.y, pier.w, pier.h);
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      for (let y = pier.y + 12; y < pier.y + pier.h; y += 16) ctx.fillRect(pier.x, y, pier.w, 3);
    }
    const boat = city.boat;
    ctx.fillStyle = '#f2f4f6';
    ctx.beginPath();
    ctx.moveTo(boat.x, boat.y + boat.h);
    ctx.lineTo(boat.x + 10, boat.y);
    ctx.lineTo(boat.x + boat.w - 10, boat.y);
    ctx.lineTo(boat.x + boat.w, boat.y + boat.h);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#274b8f';
    ctx.fillRect(boat.x + 16, boat.y + 8, 30, 13);
    for (const tree of city.trees) {
      if (tree.x < left - 40 || tree.y < top - 40 || tree.x > left + w + 40 || tree.y > top + h + 40) continue;
      drawTree(tree, t);
    }
    // Skid marks, then the objective beam and packages.
    ctx.fillStyle = 'rgba(20,20,22,0.4)';
    for (const s of state.skids) {
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.angle);
      ctx.globalAlpha = Math.min(0.4, s.life / 5 * 0.4);
      ctx.fillRect(-9, -8, 18, 4);
      ctx.fillRect(-9, 4, 18, 4);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    const objective = state.missions?.objective;
    if (objective && screen === 'play') {
      // The beam burns in the step kind's own colour, the one the HUD and minimap use.
      const hex = MARKER_COLORS[objective.mark] ?? '#ffd23e';
      const n = Number.parseInt(hex.slice(1), 16);
      const rgb = `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
      const pulse = 0.75 + Math.sin(t * 5) * 0.25;
      const grad = ctx.createLinearGradient(0, objective.y - 300, 0, objective.y);
      grad.addColorStop(0, `rgba(${rgb},0)`);
      grad.addColorStop(1, `rgba(${rgb},${0.35 * pulse})`);
      ctx.fillStyle = grad;
      ctx.fillRect(objective.x - 13, objective.y - 300, 26, 300);
      ctx.fillStyle = hex;
      ctx.beginPath();
      ctx.arc(objective.x, objective.y, 17 * pulse + 6, 0, Math.PI * 2);
      ctx.globalAlpha = 0.3;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.save();
      ctx.translate(objective.x, objective.y - 34 + Math.sin(t * 4) * 4);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-8, -8, 16, 16);
      ctx.restore();
    }
    for (const pack of city.packages) {
      if (pack.taken) continue;
      const bob = Math.sin(t * 3 + pack.id) * 3;
      ctx.fillStyle = 'rgba(255,210,62,0.25)';
      ctx.beginPath(); ctx.arc(pack.x, pack.y + bob, 15, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffd23e';
      ctx.beginPath(); ctx.arc(pack.x, pack.y + bob, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#8a6a1f';
      ctx.font = `700 11px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('$', pack.x, pack.y + bob + 4);
    }
    // People and machines, sorted so the lower on screen stands in front.
    const actors = [];
    for (const ped of state.peds) actors.push({ y: ped.y, draw: () => drawPed(ped, t) });
    for (const car of state.cars) actors.push({ y: car.y + 14, draw: () => drawCar(car, t) });
    if (!state.player.car) actors.push({ y: state.player.y + 2, draw: () => drawPlayer(state, t) });
    actors.sort((a, b) => a.y - b.y);
    for (const actor of actors) actor.draw();
    // Bullets as tracers, particles over everything.
    ctx.strokeStyle = 'rgba(255,240,180,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (const b of state.bullets) {
      ctx.moveTo(b.x - b.vx * 0.016, b.y - b.vy * 0.016);
      ctx.lineTo(b.x, b.y);
    }
    ctx.stroke();
    for (const pt of state.particles) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // The bust ring closes over the player's head.
    const p = state.player;
    if (!p.car && p.bustMeter > 0.02) {
      ctx.strokeStyle = PALETTE.danger;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(p.x, p.y - 26, 10, -Math.PI / 2, -Math.PI / 2 + p.bustMeter * Math.PI * 2);
      ctx.stroke();
    }
    // Warm late light over the whole frame.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const vg = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, canvas.height * 0.42, canvas.width / 2, canvas.height / 2, canvas.height * 0.95);
    vg.addColorStop(0, 'rgba(255,170,60,0.05)');
    vg.addColorStop(1, 'rgba(20,10,40,0.28)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  function drawTree(tree, t) {
    ctx.strokeStyle = '#7a5a36';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(tree.x, tree.y);
    ctx.lineTo(tree.x + 2, tree.y - 8);
    ctx.stroke();
    if (tree.palm) {
      ctx.strokeStyle = '#3f8f3f';
      ctx.lineWidth = 3;
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * Math.PI * 2 + Math.sin(t * 0.8 + tree.x) * 0.05;
        ctx.beginPath();
        ctx.moveTo(tree.x + 2, tree.y - 8);
        ctx.quadraticCurveTo(
          tree.x + 2 + Math.cos(a) * tree.r * 0.8, tree.y - 14 + Math.sin(a) * 4,
          tree.x + 2 + Math.cos(a) * tree.r * 1.25, tree.y - 6 + Math.sin(a) * tree.r * 0.5 + 5,
        );
        ctx.stroke();
      }
    } else {
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.beginPath(); ctx.arc(tree.x + 4, tree.y + 3, tree.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#3e7d3a';
      ctx.beginPath(); ctx.arc(tree.x, tree.y - 6, tree.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#4c9950';
      ctx.beginPath(); ctx.arc(tree.x - tree.r * 0.3, tree.y - tree.r * 0.55, tree.r * 0.62, 0, Math.PI * 2); ctx.fill();
    }
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function shade(hex, amt) {
    const n = Number.parseInt(hex.slice(1), 16);
    const r = Math.max(0, Math.min(255, (n >> 16) + amt));
    const g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + amt));
    const b = Math.max(0, Math.min(255, (n & 0xff) + amt));
    return `rgb(${r},${g},${b})`;
  }

  function visible(r, left, top, w, h) {
    return r.x + r.w >= left - 60 && r.y + r.h >= top - 80 && r.x <= left + w + 60 && r.y <= top + h + 60;
  }

  return { drawWorld, updateCamera, camera, viewSize, ctx };
}
