// A small seeded random source (mulberry32). One seed makes one city and one traffic pattern,
// which is what lets the screenshot scenes in shots.js stage the same frame every time.

export function createRandom(seed) {
  let state = seed >>> 0;
  function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  return {
    next,
    /** A float in [min, max). */
    range(min, max) {
      return min + next() * (max - min);
    },
    /** An integer in [min, max], both ends included. */
    int(min, max) {
      return min + Math.floor(next() * (max - min + 1));
    },
    /** One item of a non-empty array. */
    pick(items) {
      return items[Math.floor(next() * items.length)];
    },
    /** A shuffled copy of the array (Fisher–Yates on this source); the original is kept. */
    shuffle(items) {
      const out = [...items];
      for (let i = out.length - 1; i > 0; i -= 1) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
    /** True with probability p. */
    chance(p) {
      return next() < p;
    },
    /** -1 or 1, coin flip. */
    sign() {
      return next() < 0.5 ? -1 : 1;
    },
    /** A direction in radians, uniform over the circle. */
    angle() {
      return next() * Math.PI * 2;
    },
  };
}
