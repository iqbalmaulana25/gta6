// The screen furniture: wanted stars and health over the world, the mission phone from Lena,
// centre banners, the minimap of Port Solano with its blips, and every full screen — title,
// how-to, pause, busted, wasted and story complete. Pure canvas drawing in screen space;
// main.js decides which screen is up.

import { CITY_NAME, FONT, GAME_TITLE, PALETTE, PLAYER, WORLD } from './config.js';
import { getNearestCar, starsOf } from './entities.js';
import { SCREEN_BUSTED, SCREEN_COMPLETE, SCREEN_HOWTO, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

function panel(ctx, x, y, w, h, r = 10) {
  ctx.fillStyle = PALETTE.panel;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
  ctx.strokeStyle = PALETTE.panelEdge;
  ctx.lineWidth = 1;
  ctx.stroke();
}

function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const trial = line ? `${line} ${word}` : word;
    if (ctx.measureText(trial).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = trial;
  }
  if (line) lines.push(line);
  return lines;
}

function drawStars(ctx, x, y, stars, t) {
  ctx.font = '26px sans-serif';
  ctx.textAlign = 'left';
  for (let i = 0; i < 5; i += 1) {
    const on = i < stars;
    ctx.fillStyle = on ? '#ffd23e' : 'rgba(255,255,255,0.22)';
    if (on && stars >= 4) ctx.fillStyle = Math.floor(t * 6) % 2 ? '#ffd23e' : '#ff9d2e';
    ctx.fillText('★', x + i * 27, y);
  }
}

function drawMinimap(ctx, state, x, y, w, h) {
  const city = state.city;
  const sx = w / WORLD.width;
  const sy = h / WORLD.height;
  panel(ctx, x - 6, y - 6, w + 12, h + 22, 10);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = '#3f7a44';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = PALETTE.waterDeep;
  ctx.fillRect(x, y + city.water.y * sy, w, h - city.water.y * sy);
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(x, y + city.beach.y * sy, w, (city.water.y - city.beach.y) * sy);
  ctx.strokeStyle = 'rgba(240,240,230,0.65)';
  ctx.lineWidth = 2;
  for (const cx of city.roadsX) {
    ctx.beginPath(); ctx.moveTo(x + cx * sx, y); ctx.lineTo(x + cx * sx, y + h); ctx.stroke();
  }
  for (const cy of city.roadsY) {
    ctx.beginPath(); ctx.moveTo(x, y + cy * sy); ctx.lineTo(x + w, y + cy * sy); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,210,62,0.9)';
  for (const pack of city.packages) {
    if (!pack.taken) ctx.fillRect(x + pack.x * sx - 1, y + pack.y * sy - 1, 2.4, 2.4);
  }
  for (const car of state.cars) {
    if (car.driver !== 'police' || car.dead) continue;
    ctx.fillStyle = Math.floor(state.time * 4) % 2 ? '#ff5147' : '#4f8dff';
    ctx.fillRect(x + car.x * sx - 2, y + car.y * sy - 2, 4, 4);
  }
  for (const ped of state.peds) {
    if (!ped.hostile || ped.dead) continue;
    ctx.fillStyle = '#ff5147';
    ctx.fillRect(x + ped.x * sx - 2, y + ped.y * sy - 2, 3.6, 3.6);
  }
  const objective = state.missions?.objective;
  if (objective) {
    const pulse = 2.4 + Math.sin(state.time * 5) * 1.1;
    ctx.fillStyle = PALETTE.marker;
    ctx.beginPath();
    ctx.arc(x + objective.x * sx, y + objective.y * sy, pulse + 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
  // The player, an arrow that turns with them.
  const p = state.player;
  ctx.translate(x + p.x * sx, y + p.y * sy);
  ctx.rotate(p.angle + Math.PI / 2);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(0, -6);
  ctx.lineTo(4.4, 5);
  ctx.lineTo(0, 2.4);
  ctx.lineTo(-4.4, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.font = `600 10px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(245,242,233,0.75)';
  ctx.fillText(CITY_NAME.toUpperCase(), x, y + h + 13);
}

function drawHud(ctx, state, canvas) {
  const W = canvas.width;
  const H = canvas.height;
  const p = state.player;
  const m = state.missions;
  // Objective, top left.
  if (m?.objective) {
    const distM = Math.max(0, Math.round(Math.hypot(p.x - m.objective.x, p.y - m.objective.y) / 10));
    panel(ctx, 16, 16, 404, 58);
    ctx.font = `700 11px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffd23e';
    ctx.fillText((m.objective.sub || 'FREE ROAM').toUpperCase(), 30, 38);
    ctx.font = `600 15px ${FONT}`;
    ctx.fillStyle = PALETTE.text;
    const text = m.objective.text.length > 44 ? `${m.objective.text.slice(0, 43)}…` : m.objective.text;
    ctx.fillText(text, 30, 60);
    ctx.font = `700 15px ${FONT}`;
    ctx.fillStyle = '#ffd23e';
    ctx.textAlign = 'right';
    ctx.fillText(`${distM}m`, 406, 60);
    ctx.textAlign = 'left';
  }
  // Money, stars, health, top right.
  ctx.font = `800 27px ${FONT}`;
  ctx.textAlign = 'right';
  ctx.fillStyle = '#8be26b';
  ctx.fillText(`$${p.money.toLocaleString('en-US')}`, W - 20, 42);
  const stars = starsOf(state);
  drawStars(ctx, W - 158, 74, stars, state.time);
  if (stars > 0 && !state.wanted.seen && state.wanted.unseenTime > 1) {
    ctx.font = `700 11px ${FONT}`;
    ctx.fillStyle = 'rgba(245,242,233,0.8)';
    ctx.fillText('OUT OF SIGHT', W - 20, 74);
  }
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(W - 170, 86, 150, 11);
  ctx.fillStyle = p.health > 30 ? PALETTE.good : PALETTE.danger;
  ctx.fillRect(W - 170, 86, 150 * Math.max(0, p.health) / PLAYER.health, 11);
  ctx.font = `600 11px ${FONT}`;
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(245,242,233,0.85)';
  const found = state.packagesFound.size;
  ctx.fillText(`GOLDEN PALMS ${found}/20`, W - 20, 116);
  if (p.car) {
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(W - 170, 124, 150, 7);
    ctx.fillStyle = '#ffb35c';
    ctx.fillRect(W - 170, 124, 150 * Math.max(0, p.car.health) / 100, 7);
    ctx.font = `700 15px ${FONT}`;
    ctx.fillStyle = PALETTE.text;
    const kmh = Math.round(Math.abs(p.car.speed) * 0.31);
    ctx.fillText(`${p.car.kind === 'police' ? 'CRUISER' : p.car.kind.toUpperCase()} · ${kmh} km/h`, W - 20, 152);
    if (p.reloadTime > 0) { /* drivers do not reload */ }
  } else if (p.reloadTime > 0) {
    ctx.font = `700 13px ${FONT}`;
    ctx.fillStyle = '#ffd23e';
    ctx.fillText('RELOADING…', W - 20, 140);
  } else {
    ctx.font = `600 12px ${FONT}`;
    ctx.fillStyle = 'rgba(245,242,233,0.8)';
    ctx.fillText(`AMMO ${p.ammo}`, W - 20, 140);
  }
  // Lena's phone, bottom left.
  if (m?.phone) {
    const lines = wrapText(ctx, m.phone.text, 264);
    panel(ctx, 16, H - 178 - lines.length * 19, 300, 66 + lines.length * 19, 12);
    ctx.fillStyle = '#ffd23e';
    ctx.beginPath();
    ctx.arc(42, H - 146 - lines.length * 19, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#141a24';
    ctx.font = `800 15px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('L', 42, H - 141 - lines.length * 19);
    ctx.textAlign = 'left';
    ctx.font = `700 12px ${FONT}`;
    ctx.fillStyle = '#ffd23e';
    ctx.fillText('LENA COSTA', 66, H - 152 - lines.length * 19);
    ctx.font = `400 13.5px ${FONT}`;
    ctx.fillStyle = PALETTE.text;
    lines.forEach((line, i) => ctx.fillText(line, 30, H - 128 - lines.length * 19 + i * 19 + 19));
  }
  // Centre banner: mission news.
  if (m?.banner) {
    const a = Math.min(1, m.banner.t / 0.6, (3.6 - m.banner.t) / 0.4 + 0.2);
    ctx.globalAlpha = Math.max(0, Math.min(1, a));
    ctx.textAlign = 'center';
    ctx.font = `800 40px ${FONT}`;
    ctx.fillStyle = '#ffd23e';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 14;
    ctx.fillText(m.banner.title.toUpperCase(), W / 2, 128);
    ctx.font = `600 17px ${FONT}`;
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(m.banner.sub, W / 2, 156);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }
  // A hint for the keys that matter right now, bottom centre.
  ctx.font = `600 12.5px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(245,242,233,0.85)';
  let hint = 'WASD drive/walk · mouse aim · click shoot · F punch · E car · P pause';
  if (!p.car && getNearestCar(state)) hint = 'E — get in the car';
  if (p.car) hint = 'WASD drive · Space handbrake · E get out';
  ctx.fillText(hint, W / 2, H - 14);
  drawMinimap(ctx, state, W - 218, H - 196, 196, 147);
}

function centreOverlay(ctx, canvas, top, bottom) {
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, top);
  grad.addColorStop(1, bottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function bigTitle(ctx, canvas, title, sub, color = '#ffd23e') {
  ctx.textAlign = 'center';
  ctx.font = `900 ${Math.min(96, canvas.width / 11)}px ${FONT}`;
  ctx.fillStyle = 'rgba(20,10,30,0.55)';
  ctx.fillText(title, canvas.width / 2 + 4, canvas.height * 0.36 + 5);
  ctx.fillStyle = color;
  ctx.fillText(title, canvas.width / 2, canvas.height * 0.36);
  ctx.font = `600 19px ${FONT}`;
  ctx.fillStyle = PALETTE.text;
  ctx.fillText(sub, canvas.width / 2, canvas.height * 0.36 + 42);
}

export function createHud(canvas) {
  const ctx = canvas.getContext('2d');
  return {
    draw(state, screen, extras) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const W = canvas.width;
      const H = canvas.height;
      if (screen === SCREEN_PLAY) {
        drawHud(ctx, state, canvas);
        return;
      }
      if (screen === SCREEN_TITLE) {
        centreOverlay(ctx, canvas, 'rgba(24,12,44,0.42)', 'rgba(120,40,60,0.30)');
        bigTitle(ctx, canvas, GAME_TITLE, `An open-world crime story in ${CITY_NAME}`);
        ctx.textAlign = 'center';
        ctx.font = `700 21px ${FONT}`;
        ctx.fillStyle = PALETTE.text;
        ctx.fillText('ENTER — New game', W / 2, H * 0.58);
        if (extras.hasSave) ctx.fillText('C — Continue', W / 2, H * 0.58 + 34);
        ctx.fillText('H — How to play', W / 2, H * 0.58 + (extras.hasSave ? 68 : 34));
        ctx.font = `400 13.5px ${FONT}`;
        ctx.fillStyle = 'rgba(245,242,233,0.75)';
        ctx.fillText('Steal cars, run jobs for Lena Costa, dodge the Port Solano PD — and find the 20 golden palms.', W / 2, H - 56);
        ctx.fillText('Runs entirely in your browser: no downloads, no network, sound on for the sirens.', W / 2, H - 34);
        return;
      }
      if (screen === SCREEN_HOWTO) {
        centreOverlay(ctx, canvas, 'rgba(10,14,24,0.88)', 'rgba(10,14,24,0.88)');
        ctx.textAlign = 'center';
        ctx.font = `800 34px ${FONT}`;
        ctx.fillStyle = '#ffd23e';
        ctx.fillText('HOW TO PLAY', W / 2, 110);
        ctx.font = `400 16.5px ${FONT}`;
        ctx.fillStyle = PALETTE.text;
        const lines = [
          'You are Dario Venn, new in Port Solano. Fixer Lena Costa has work: follow the gold beam.',
          '',
          'WASD / arrows — walk and drive        Shift — sprint',
          'Mouse — aim · Click — shoot           F — punch · R — reload',
          'E — steal / enter / leave a car       Space — handbrake',
          'P or Esc — pause · F5 — save',
          '',
          'Crimes raise your stars. Stars bring cruisers, cruisers bring officers,',
          'and an officer who reaches you fills the red ring: busted.',
          'Break their line of sight and the heat cools. Wrecked or busted, you wake up',
          'at the hospital or the station, lighter in the wallet.',
          '',
          'Finish Lena\'s five jobs to close the story — then the city is yours:',
          'twenty golden palms are hidden on rooftops\' edges, piers, parks and lots.',
        ];
        lines.forEach((line, i) => ctx.fillText(line, W / 2, 168 + i * 27));
        ctx.font = `700 16px ${FONT}`;
        ctx.fillStyle = '#ffd23e';
        ctx.fillText('H or Esc — back', W / 2, 168 + lines.length * 27 + 16);
        return;
      }
      if (screen === SCREEN_PAUSED) {
        centreOverlay(ctx, canvas, 'rgba(8,10,18,0.62)', 'rgba(8,10,18,0.62)');
        bigTitle(ctx, canvas, 'PAUSED', `${CITY_NAME} waits for no one — except now`);
        ctx.textAlign = 'center';
        ctx.font = `700 19px ${FONT}`;
        ctx.fillStyle = PALETTE.text;
        ctx.fillText('Esc / P — resume', W / 2, H * 0.58);
        ctx.fillText('F5 — save game', W / 2, H * 0.58 + 32);
        ctx.fillText(`Golden palms found: ${state.packagesFound.size}/20`, W / 2, H * 0.58 + 72);
        return;
      }
      if (screen === SCREEN_OVER || screen === SCREEN_BUSTED) {
        const busted = screen === SCREEN_BUSTED;
        centreOverlay(ctx, canvas, busted ? 'rgba(16,24,64,0.66)' : 'rgba(64,8,8,0.66)', 'rgba(0,0,0,0.72)');
        bigTitle(ctx, canvas, busted ? 'BUSTED' : 'WASTED', busted
          ? 'The Port Solano PD walk you out of the station, $150 lighter.'
          : 'You wake at Solano General, $150 lighter and lucky.', busted ? '#7fb0ff' : '#ff6b5e');
        ctx.textAlign = 'center';
        ctx.font = `700 19px ${FONT}`;
        ctx.fillStyle = PALETTE.text;
        ctx.fillText('ENTER — back on the street', W / 2, H * 0.6);
        return;
      }
      if (screen === SCREEN_COMPLETE) {
        centreOverlay(ctx, canvas, 'rgba(30,20,60,0.55)', 'rgba(140,60,20,0.4)');
        bigTitle(ctx, canvas, 'STORY COMPLETE', 'The Solano Score is spent, the boat is gone, and Dario Venn owns his mornings.');
        ctx.textAlign = 'center';
        ctx.font = `600 18px ${FONT}`;
        ctx.fillStyle = PALETTE.text;
        ctx.fillText(`Banked: $${state.player.money.toLocaleString('en-US')} · Golden palms: ${state.packagesFound.size}/20`, W / 2, H * 0.56);
        ctx.fillText('ENTER — keep roaming Port Solano', W / 2, H * 0.56 + 36);
      }
    },
  };
}
