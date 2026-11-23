// Port Solano itself: a grid of sunlit streets over a seeded layout — seven avenues across,
// five streets down and Ocean Drive along the beach. Blocks between the roads become tower
// blocks, parks or parking lots; a handful hold the named places the story visits. Everything
// the game needs to know about the ground is computed here once: building solids for collision,
// lane maths for traffic, landmarks, the marina pier and the hidden packages.

import { BUILDING_SKINS, LANE, WORLD } from './config.js';

export const ROAD_X = [210, 630, 1050, 1470, 1890, 2310, 2730, 3150];
export const ROAD_Y = [210, 630, 1050, 1470, 1890, 2240];
/** Sand from here to the water; the sea from WATER_Y to the world's south edge. */
export const BEACH_Y = 2298;
export const WATER_Y = 2368;

const HALF_ROAD = WORLD.roadWidth / 2;
const SHOP_NAMES = [
  'Taco Sol', 'Surf & Sand', 'Hotel Brisa', 'Club Neon Palms', 'Bodega Mar', 'Gym Toro',
  'Cinema Sol', 'Farmacia Vida', 'Casa Pescado', 'Palmetto Books', 'Bar El Faro', 'Diner 24',
  'Flores Market', 'Hotel Coral', 'Taller Ruiz', 'Café Brisa', 'Solano Ink', 'Panadería Luz',
];

/** The lane offset from a road centre for right-hand traffic, by travel axis and direction. */
export function laneOffset(axis, dir) {
  if (axis === 'y') return dir > 0 ? -LANE : LANE;
  return dir > 0 ? LANE : -LANE;
}

/** True when the point lies on any road (not on a block). */
export function pointOnRoad(city, x, y) {
  for (const cx of city.roadsX) if (Math.abs(x - cx) <= HALF_ROAD) return true;
  for (const cy of city.roadsY) if (Math.abs(y - cy) <= HALF_ROAD) return true;
  return false;
}

/** A random point on a random road, between minD and maxD from (x, y); null if none found. */
export function randomRoadPoint(city, rng, x, y, minD, maxD) {
  for (let tries = 0; tries < 24; tries += 1) {
    let px;
    let py;
    if (rng.chance(0.5)) {
      px = rng.pick(city.roadsX) + rng.range(-LANE, LANE);
      py = rng.range(30, WORLD.height - 30);
    } else {
      px = rng.range(30, WORLD.width - 30);
      py = rng.pick(city.roadsY) + rng.range(-LANE, LANE);
    }
    const d = Math.hypot(px - x, py - y);
    if (d >= minD && d <= maxD) return { x: px, y: py };
  }
  return null;
}

function blockRect(col, row) {
  const x0 = ROAD_X[col] + HALF_ROAD;
  const x1 = ROAD_X[col + 1] - HALF_ROAD;
  const y0 = ROAD_Y[row] + HALF_ROAD;
  const y1 = ROAD_Y[row + 1] - HALF_ROAD;
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

export function createCity(rng) {
  const buildings = [];
  const parks = [];
  const lots = [];
  const trees = [];
  let shopIndex = 0;

  function addBuilding(x, y, w, h, name) {
    const skin = BUILDING_SKINS[rng.int(0, BUILDING_SKINS.length - 1)];
    buildings.push({
      x, y, w, h,
      skin,
      floors: Math.max(2, skin.floors + rng.int(-1, 2)),
      name: name ?? null,
      seed: rng.int(1, 100000),
    });
  }

  // Landmark blocks are placed first, by hand, so the story always has its stage.
  const landmarkBlocks = new Map();
  function landmark(col, row, name) {
    const b = blockRect(col, row);
    const inset = 26;
    addBuilding(b.x + inset, b.y + inset, b.w - inset * 2, b.h - inset * 2, name);
    landmarkBlocks.set(`${col},${row}`, name);
    return { x: b.x + b.w / 2, y: b.y + b.h + 26, doorX: b.x + b.w / 2, doorY: b.y + b.h + 10 };
  }

  const cafe = landmark(3, 2, 'Café Azul');
  const hotel = landmark(1, 4, 'Palmetto Hotel');
  const bank = landmark(4, 1, 'Solano Trust Bank');
  const garage = landmark(6, 2, "Lena's Garage");
  const docks = landmark(6, 4, 'Marina Warehouse');
  const policeStation = landmark(5, 0, 'Port Solano PD');
  const hospital = landmark(1, 0, 'Solano General Hospital');
  const safehouse = landmark(0, 3, 'Calle Ocho Safehouse');

  for (let col = 0; col < ROAD_X.length - 1; col += 1) {
    for (let row = 0; row < ROAD_Y.length - 1; row += 1) {
      if (landmarkBlocks.has(`${col},${row}`)) continue;
      const b = blockRect(col, row);
      const roll = rng.next();
      if (roll < 0.15) {
        // A park: grass, a crossing path and shade trees.
        parks.push({ x: b.x, y: b.y, w: b.w, h: b.h });
        const count = rng.int(5, 9);
        for (let i = 0; i < count; i += 1) {
          trees.push({ x: b.x + rng.range(24, b.w - 24), y: b.y + rng.range(24, b.h - 24), r: rng.range(13, 20), palm: false });
        }
      } else if (roll < 0.27) {
        // A parking lot with marked bays; entities.js parks cars in some of them.
        const bays = [];
        for (let bx = b.x + 26; bx + 44 < b.x + b.w - 10; bx += 56) {
          bays.push({ x: bx, y: b.y + 18 });
          bays.push({ x: bx, y: b.y + b.h - 62 });
        }
        lots.push({ x: b.x, y: b.y, w: b.w, h: b.h, bays });
      } else {
        // Buildings: one tower, two side by side, or four around a courtyard.
        const style = rng.next();
        const gap = 14;
        if (style < 0.34) {
          addBuilding(b.x + 20, b.y + 20, b.w - 40, b.h - 40, rng.chance(0.3) ? SHOP_NAMES[shopIndex++ % SHOP_NAMES.length] : null);
        } else if (style < 0.67) {
          const w = (b.w - gap) / 2;
          addBuilding(b.x, b.y + 12, w, b.h - 24, null);
          addBuilding(b.x + w + gap, b.y + 12, w, b.h - 24, rng.chance(0.35) ? SHOP_NAMES[shopIndex++ % SHOP_NAMES.length] : null);
        } else {
          const w = (b.w - gap) / 2;
          const h = (b.h - gap) / 2;
          addBuilding(b.x, b.y, w, h, null);
          addBuilding(b.x + w + gap, b.y, w, h, null);
          addBuilding(b.x, b.y + h + gap, w, h, rng.chance(0.3) ? SHOP_NAMES[shopIndex++ % SHOP_NAMES.length] : null);
          addBuilding(b.x + w + gap, b.y + h + gap, w, h, null);
        }
      }
    }
  }

  // Palms along Ocean Drive and the beach, shade trees on the promenades at the map edges.
  for (let x = 90; x < WORLD.width; x += 130) {
    trees.push({ x: x + rng.range(-16, 16), y: BEACH_Y + rng.range(6, 44), r: rng.range(12, 17), palm: true });
  }
  for (let y = 120; y < BEACH_Y; y += 190) {
    trees.push({ x: rng.range(56, 120), y, r: rng.range(12, 18), palm: rng.chance(0.5) });
    trees.push({ x: WORLD.width - rng.range(56, 120), y: y + 60, r: rng.range(12, 18), palm: rng.chance(0.5) });
  }

  // The marina: two piers into the sea and the getaway boat at the end of the longer one.
  const piers = [
    { x: 2560, y: WATER_Y - 6, w: 34, h: 132 },
    { x: 2830, y: WATER_Y - 6, w: 40, h: 158 },
  ];
  const boat = { x: 2850, y: WATER_Y + 168, w: 64, h: 30 };

  // Twenty golden palms, the city's hidden packages: parks, lots, alleys, beach, pier ends.
  const packages = [];
  const spots = [];
  for (const park of parks) spots.push({ x: park.x + park.w / 2, y: park.y + park.h / 2 });
  for (const lot of lots) spots.push({ x: lot.x + lot.w - 22, y: lot.y + 22 });
  for (const pier of piers) spots.push({ x: pier.x + pier.w / 2, y: pier.y + pier.h - 14 });
  spots.push({ x: 200, y: BEACH_Y + 40 }, { x: 1700, y: BEACH_Y + 52 }, { x: 3200, y: BEACH_Y + 36 });
  while (spots.length < 20) {
    const b = buildings[rng.int(0, buildings.length - 1)];
    spots.push({ x: b.x - 20, y: b.y + b.h + 20 });
  }
  // Which spots hold a palm changes with the seed: shuffle the candidates, take twenty.
  const shuffled = rng.shuffle(spots);
  for (let i = 0; i < 20; i += 1) packages.push({ id: i, x: shuffled[i].x, y: shuffled[i].y, taken: false });

  return {
    roadsX: ROAD_X,
    roadsY: ROAD_Y,
    buildings,
    solids: buildings,
    parks,
    lots,
    trees,
    piers,
    boat,
    packages,
    landmarks: { cafe, hotel, bank, garage, docks, policeStation, hospital, safehouse },
    beach: { x: 0, y: BEACH_Y, w: WORLD.width, h: WATER_Y - BEACH_Y },
    water: { x: 0, y: WATER_Y, w: WORLD.width, h: WORLD.height - WATER_Y },
  };
}

/** True when a circle at (x, y) would touch a building or leave the world. */
export function circleHitsSolid(city, x, y, r) {
  if (x < r || y < r || x > WORLD.width - r || y > WORLD.height - r) return true;
  for (const s of city.solids) {
    const nx = Math.max(s.x, Math.min(x, s.x + s.w));
    const ny = Math.max(s.y, Math.min(y, s.y + s.h));
    const dx = x - nx;
    const dy = y - ny;
    if (dx * dx + dy * dy < r * r) return true;
  }
  return false;
}

/** Push a circle out of every building it overlaps; returns the corrected position. */
export function resolveCircle(city, x, y, r) {
  x = Math.max(r, Math.min(WORLD.width - r, x));
  y = Math.max(r, Math.min(WORLD.height - r, y));
  for (const s of city.solids) {
    const nx = Math.max(s.x, Math.min(x, s.x + s.w));
    const ny = Math.max(s.y, Math.min(y, s.y + s.h));
    let dx = x - nx;
    let dy = y - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 >= r * r) continue;
    if (d2 < 0.0001) {
      // Centre inside the box: leave by the nearest face.
      const left = x - s.x;
      const right = s.x + s.w - x;
      const top = y - s.y;
      const bottom = s.y + s.h - y;
      const min = Math.min(left, right, top, bottom);
      if (min === left) x = s.x - r;
      else if (min === right) x = s.x + s.w + r;
      else if (min === top) y = s.y - r;
      else y = s.y + s.h + r;
    } else {
      const d = Math.sqrt(d2);
      x = nx + (dx / d) * r;
      y = ny + (dy / d) * r;
    }
  }
  return { x, y };
}

/** True when the point is in the sea and not on a pier (or the boat deck). */
export function inWater(city, x, y) {
  if (y < WATER_Y) return false;
  for (const pier of city.piers) {
    if (x >= pier.x && x <= pier.x + pier.w && y >= pier.y && y <= pier.y + pier.h) return false;
  }
  const b = city.boat;
  if (x >= b.x - 8 && x <= b.x + b.w + 8 && y >= b.y - 8 && y <= b.y + b.h + 8) return false;
  return true;
}
