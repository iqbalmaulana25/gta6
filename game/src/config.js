// Solano Heat — every tuning number, colour and name in one place.
// The world is a fixed 3360x2520 field of pixels; the renderer fits the camera view to the
// window, so no rule below depends on the screen size. Nothing here is borrowed from any
// commercial game: Port Solano, its people and its story are this game's own.

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const WORLD = {
  width: 3360,
  height: 2520,
  /** Road centre lines sit on this pitch, in both directions. */
  pitch: 420,
  /** Full width of a road, kerb to kerb. */
  roadWidth: 116,
  /** Sidewalk band inside each block edge. */
  sidewalk: 16,
  /** The sea starts at this y; a sand beach band lies just above it (city.js derives both). */
  waterY: 2368,
  beachY: 2298,
};

/** Lane offset from a road's centre line: right-hand traffic. */
export const LANE = 29;

export const PLAYER = {
  radius: 13,
  walkSpeed: 168,
  sprintSpeed: 262,
  health: 100,
  punchRange: 40,
  punchDamage: 34,
  gunDamage: 42,
  gunCooldown: 0.24,
  magazine: 12,
  enterRange: 58,
};

export const CAR = {
  length: 52,
  width: 26,
  accel: 340,
  brake: 520,
  reverseMax: 120,
  drag: 0.6,
  gripTurn: 2.6,
  health: 100,
};

/** Per-kind driving character: top speed in px/s and how eagerly it turns. */
export const CAR_KINDS = {
  sedan: { topSpeed: 342, turn: 1.0, label: 'Marina Sedan' },
  taxi: { topSpeed: 330, turn: 1.0, label: 'Solano Cab' },
  hatch: { topSpeed: 318, turn: 1.08, label: 'Palmetto Hatch' },
  truck: { topSpeed: 268, turn: 0.8, label: 'Dockside Hauler' },
  sport: { topSpeed: 468, turn: 1.12, label: 'Comet GT' },
  police: { topSpeed: 402, turn: 1.05, label: 'Port Solano PD Cruiser' },
};

export const WANTED = {
  /** Heat added per crime, before it is rounded up to stars for display. */
  steal: 1,
  hitPed: 1,
  shoot: 0.6,
  hitPolice: 1.6,
  killPolice: 2,
  max: 5,
  /** Heat lost per second while no officer can see the player. */
  decay: 0.055,
  /** How long the player must stay unseen before decay starts, in seconds. */
  hideTime: 4,
};

export const POLICE = {
  carSpeed: 392,
  /** Seconds of travel a pursuing cruiser aims ahead of a moving target. */
  leadTime: 0.5,
  footSpeed: 196,
  sightRange: 560,
  bustRange: 30,
  bustTime: 1.15,
  shootRange: 330,
  shootCooldown: 1.15,
  gunDamage: 7,
};

/** How headquarters answers a rising wanted level: cruisers sent in waves, and — once the
 * chase is hot enough — a line of them parked across the road ahead of the player. */
export const DISPATCH = {
  /** Seconds between waves while the player is at two stars or more. */
  waveInterval: 9,
  /** Cruisers sent per wave. */
  waveSize: 2,
  /** Stars at which roadblocks start appearing. */
  roadblockStars: 4,
  /** How far ahead of the player a roadblock is set, in pixels. */
  roadblockAhead: 430,
  /** Seconds between roadblocks while the heat stays up. */
  roadblockEvery: 16,
  /** Seconds a roadblock stands before its cruisers join the pursuit. */
  roadblockLife: 30,
};

/** Objective marker colours by step kind: the HUD panel, the minimap blip and the light
 * beam in the world all speak the same colour per kind of job step. */
export const MARKER_COLORS = {
  go: '#ffd23e',
  crate: '#ffb35c',
  car: '#7fd4ff',
  eye: '#c9a7ff',
  cross: '#ff5147',
  boat: '#53d769',
  house: '#ffe9a8',
  star: '#ff9d2e',
};

export const TRAFFIC = {
  targetCars: 13,
  targetPeds: 17,
  spawnRange: 980,
  despawnRange: 1250,
};

export const PALETTE = {
  grass: '#57a05a',
  grassDark: '#4c8f52',
  parkPath: '#cbb98a',
  sand: '#ecd28f',
  water: '#2e7fb8',
  waterDeep: '#256a9c',
  asphalt: '#3c4149',
  asphaltDark: '#343943',
  laneMark: '#e8e4d2',
  kerb: '#9aa0a3',
  sidewalk: '#b9bcb4',
  plaza: '#cfc4a5',
  roofTrim: '#00000022',
  player: '#ffb340',
  policeCar: '#e8ecf2',
  policeTrim: '#274b8f',
  marker: '#ffd23e',
  markerSoft: '#ffd23e55',
  danger: '#e5534b',
  good: '#53d769',
  text: '#f5f2e9',
  panel: '#141a24cc',
  panelEdge: '#ffffff2a',
};

export const FONT = '"Avenir Next", "Segoe UI", system-ui, sans-serif';

/** Sun-soaked building skins: wall colour, roof colour, floors of windows. */
export const BUILDING_SKINS = [
  { wall: '#f2d5a0', roof: '#d9a05b', floors: 3 },
  { wall: '#e8e3d5', roof: '#b08968', floors: 5 },
  { wall: '#f4b183', roof: '#c97b4a', floors: 4 },
  { wall: '#dce9ec', roof: '#7fa3ad', floors: 7 },
  { wall: '#f7ead7', roof: '#a26769', floors: 2 },
  { wall: '#cfd8dc', roof: '#607d8b', floors: 9 },
  { wall: '#ffe0b2', roof: '#e09f3e', floors: 6 },
  { wall: '#e6c8c8', roof: '#96605f', floors: 3 },
];

/** Car paint jobs for civilian traffic. */
export const CAR_PAINTS = ['#c94f42', '#3f7fbf', '#e0a51f', '#5da85f', '#d8d8d8', '#7a4f9e', '#3aa6a0', '#8c8c92', '#e57ba8'];

/** Where progress is kept between visits (this browser only). */
export const SAVE_KEY = 'solano-heat.save.v1';

export const GAME_TITLE = 'SOLANO HEAT';
export const CITY_NAME = 'Port Solano';
