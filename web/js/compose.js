// The composer: works a tune from js/tunes.js out into a list of timed
// MIDI-style notes, [time, channel, note, velocity, duration, glideFrom],
// sorted by time, with the sounds, kit, room and tuning to play them in, and
// a mark where each section starts. It knows how a tune is laid out and holds
// a few common patterns; each tune brings the rest.
//
// A tune has parts, each with a sound and a role:
//   melody  plays a melody, or several at once, written out note by note
//   pad     holds the chord through the bar
//   arp     plays the chord's tones one at a time, in a pattern
//   bass    plays the root of the chord, in a pattern
//   comp    strikes the whole chord, in a rhythm
// and a form: the sections it plays, in order. Each section names its chords
// and what each part plays in it; a part a section does not name is silent.

const DRUMS = 9;   // the drums' channel, as in General MIDI

// The kit's notes, General MIDI's but for the riser, which it has none of.
const DRUM = {
  kick: 36, rim: 37, snare: 38, clap: 39, hat: 42, open: 46, crash: 49, ride: 51, tambourine: 54,
  cowbell: 56, tomLo: 45, tomMid: 48, tomHi: 50, congaHi: 63, congaMid: 62, congaLo: 64,
  maracas: 70, clave: 75, shaker: 82, riser: 92,
};
const SOFT = new Set(['hat', 'shaker', 'maracas', 'tambourine']);

const PITCH = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };

function pitch(name) {
  const m = /^([a-g])(#|b)?(-?\d)$/.exec(name);
  if (!m) throw new Error('bad note ' + name);
  return 12 * (+m[3] + 1) + PITCH[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}

const QUALITY = {
  '': [0, 4, 7], m: [0, 3, 7], 7: [0, 4, 7, 10], m7: [0, 3, 7, 10], maj7: [0, 4, 7, 11],
  6: [0, 4, 7, 9], m6: [0, 3, 7, 9], 9: [0, 4, 7, 10, 14], m9: [0, 3, 7, 10, 14],
  maj9: [0, 4, 7, 11, 14], add9: [0, 4, 7, 14], madd9: [0, 3, 7, 14], sus4: [0, 5, 7],
  sus2: [0, 2, 7], '7sus4': [0, 5, 7, 10], dim: [0, 3, 6], aug: [0, 4, 8],
};

function pc(letter, accidental, shift = 0) {
  return (PITCH[letter.toLowerCase()] + (accidental === '#' ? 1 : accidental === 'b' ? -1 : 0) + shift + 24) % 12;
}

// A chord symbol: its root, its tones as steps above the root, and the note
// under it - the root, or another after a slash, as in "D/F#".
function chord(name, shift = 0) {
  const m = /^([A-G])(#|b)?([^/]*)(?:\/([A-G])(#|b)?)?$/.exec(name);
  if (!m || !QUALITY[m[3]]) throw new Error('bad chord ' + name);
  const root = pc(m[1], m[2], shift);
  return { pc: root, bass: m[4] ? pc(m[4], m[5], shift) : root, steps: QUALITY[m[3]] };
}

// A melody as "note/length" words, lengths in sixteenths, "r" for a rest.
// Notes joined with + sound together; a ! after the length accents it and a
// _ plays it softly.
function melody(text) {
  return text.trim().split(/\s+/).map(word => {
    const m = /^([^/]+)\/([\d.]+)([!_]?)$/.exec(word);
    if (!m) throw new Error('bad melody word ' + word);
    return {
      notes: m[1] === 'r' ? [] : m[1].split('+').map(pitch),
      len: +m[2],
      accent: m[3] === '!' ? 1.2 : m[3] === '_' ? 0.65 : 1,
    };
  });
}

// Temperaments, as how far each of the twelve fifths round the circle from
// C is narrowed, in parts of the Pythagorean comma; worked out to how far
// each note lies from equal temperament, in cents, with A left at 440.
const TEMPERAMENTS = {
  // Vallotti's: the six fifths from F to B narrowed by a sixth of a comma,
  // the rest pure, so the keys near C are sweetest and the far ones bright.
  vallotti: [-1 / 6, -1 / 6, -1 / 6, -1 / 6, -1 / 6, 0, 0, 0, 0, 0, 0, -1 / 6],
};
const COMMA = 1200 * Math.log2(531441 / 524288);
const PURE_FIFTH = 1200 * Math.log2(3 / 2);

function temperament(name) {
  const narrow = TEMPERAMENTS[name];
  if (!narrow) throw new Error('no temperament ' + name);
  const cents = new Array(12).fill(0);
  let note = 0, off = 0;
  for (let k = 0; k < 11; k++) {
    off += PURE_FIFTH + narrow[k] * COMMA - 700;
    note = (note + 7) % 12;
    cents[note] = off;
  }
  const a = cents[9];
  return cents.map(c => +(c - a).toFixed(3));
}

// ------------------------------------------------------------ patterns
//
// A few common patterns any tune can name. A tune names the pattern a part
// plays; one of its own, under `patterns`, is found before one of these.

const SHARED = {
  // The bass, as sixteenths in a bar: [step, octave up?, length in steps,
  // velocity, and semitones above the root, if not on it].
  bass: {
    octave: Array.from({ length: 8 }, (_, i) => [i * 2, i % 2, 2, i % 2 ? 90 : 110]),
    roots: [[0, 0, 15, 110]],
  },
  // The arpeggio, as which of the chord's tones each step plays: the
  // voiced chord, then its root an octave up, then a drone if the part has
  // one.
  arp: {
    up: [0, 1, 2, 3],
  },
  // A rhythm to strike the chord in: [step, length in steps, velocity, and
  // -1 for an upstroke].
  comp: {
    quarters: [[0, 3, 100], [4, 3, 90], [8, 3, 95], [12, 3, 90]],
    offbeats: [[2, 1.5, 100], [6, 1.5, 90], [10, 1.5, 100], [14, 1.5, 90]],
  },
  // Drums, as a row a sound, one character a step: X hits hard, x hits, o
  // hits softly. A row may hold more steps than the bar, for triplets or
  // thirty-seconds, and `bars` spreads a pattern over more than one bar.
  drums: {
    fourFloor: { kick: 'x...x...x...x...' },
  },
};

function pattern(tune, kind, name) {
  const found = tune.patterns?.[kind]?.[name] ?? SHARED[kind][name];
  if (!found) throw new Error(`no ${kind} pattern ${name}`);
  return found;
}

// A random number generator that always gives the same numbers, for the
// small unsteadiness of a part played by hand.
function seeded(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ------------------------------------------------------------ composing
//
// A section names its `chords`, a list of the tune's, and how many `bars` of
// them it plays (all unless it says), and in `play` what each part plays: a
// melody's name, or a pattern's, or a level (true for 1), or all of them as
// { melody, pattern, level, sound, shift, loop, double }. `sound` swaps the
// part's sound for the section, as an organist changes stops; `shift` moves
// a melody by semitones and `loop` repeats it to fill the section; `double`
// adds it again that many semitones up, softer.
//
// The rest of a section: `drums` the pattern the kit plays; `crash` a cymbal
// on its first beat; `fill` a tom fill over its last half bar, or a pattern
// to play in its last bar; `roll` a snare roll building to the end of the
// section in place of the snare; `riser` a sweep of noise over its last
// bars (all of them for true); `gap` silence on its last beat but for the
// roll and the pads; `transpose` semitones for everything; and `label`, what
// the page shows while it plays.

export function compose(tune) {
  const step = 60 / tune.bpm / 4;
  const steps = tune.steps || 16;
  const bar = step * steps;
  const swing = (tune.swing || 0) * step;
  const random = seeded(tune.bpm * 7919 + steps);
  const notes = [];
  const add = (t, ch, n, vel, dur, from) => notes.push([+Math.max(0, t).toFixed(4), ch, n,
    Math.round(Math.max(1, Math.min(127, vel))), +dur.toFixed(4), ...(from == null ? [] : [from])]);
  // When the sixteenth `s` of a bar starting at `t0` falls; a swung tune
  // holds back every second one.
  const at16 = (t0, s) => t0 + s * step + (Number.isInteger(s) && s % 2 === 1 ? swing : 0);

  // A channel for each part and sound it plays, so a part can change sound
  // from section to section.
  const patches = {}, pans = {}, channels = new Map();
  let free = 0;
  const channel = (name, soundName) => {
    const key = name + ' ' + soundName;
    if (!channels.has(key)) {
      if (free === DRUMS) free++;
      if (!tune.sounds[soundName]) throw new Error('no sound ' + soundName);
      patches[free] = tune.sounds[soundName];
      pans[free] = tune.parts[name].pan ?? 0.5;
      channels.set(key, free++);
    }
    return channels.get(key);
  };

  const marks = [];
  let at = 0;
  for (const name of tune.form) {
    const sec = tune.sections[name];
    if (!sec) throw new Error('no section ' + name);
    const shift = sec.transpose || 0;
    const list = tune.chords[sec.chords];
    if (!list) throw new Error('no chords ' + sec.chords);
    const chords = list.slice(0, sec.bars || list.length);
    const length = chords.length * steps;
    marks.push({ at, name, label: sec.label || '' });
    const silent = (b, s) => sec.gap && b === chords.length - 1 && s >= steps - 4;

    // Each bar's chord, or the two sharing it ("Eb|F").
    const bars = chords.map(symbol => symbol.split('|').map((h, i, all) => ({
      ...chord(h, shift), from: i * steps / all.length, span: steps / all.length,
    })));
    const harmony = (b, s) => {
      const halves = bars[b];
      return halves[Math.min(halves.length - 1, Math.floor(s * halves.length / steps))];
    };

    for (const [partName, setting] of Object.entries(sec.play || {})) {
      if (setting == null || setting === false) continue;
      const part = tune.parts[partName];
      if (!part) throw new Error('no part ' + partName);
      const opt = typeof setting === 'object' ? setting
        : typeof setting === 'string' ? { [part.role === 'melody' ? 'melody' : 'pattern']: setting }
        : { level: setting === true ? 1 : setting };
      const level = opt.level ?? 1;
      const soundName = opt.sound || part.sound;
      const sound = tune.sounds[soundName];
      const ch = channel(partName, soundName);
      // A part played by hand is a little early or late, and a little
      // louder or softer, note to note.
      const loose = part.loose || 0;
      const play = (t, n, vel, dur, from) => {
        if (loose) {
          t += (random() * 2 - 1) * loose;
          vel *= 1 + (random() * 2 - 1) * 0.1;
        }
        add(t, ch, n, vel, dur, from);
      };
      // The chord voiced around middle C, in as many tones as the part
      // takes, moved by its octave.
      const octave = part.octave ?? (part.role === 'arp' ? 1 : 0);
      const voiced = h => {
        let root = 48 + h.pc;
        if (root < 52) root += 12;
        return h.steps.slice(0, part.voicing || 3).map(s => root + s + 12 * octave);
      };

      if (part.role === 'melody') {
        const text = tune.melodies[opt.melody];
        if (!text) throw new Error('no melody ' + opt.melody);
        const words = melody(text);
        const glide = sound.glide;
        const up = opt.double || 0;
        let pos = 0, before = null;
        do {
          for (const { notes: ns, len, accent } of words) {
            if (pos >= length) break;
            const start = at16(at, pos);
            const vel = 100 * level * accent;
            const dur = Math.min(len, length - pos) * step * (glide ? 0.98 : part.legato ?? 0.92);
            // A chord in a melody, strummed if the part strums.
            ns.forEach((note, i) => {
              const n = note + shift + (opt.shift || 0);
              const t = start + i * (part.strum || 0);
              const from = glide && ns.length === 1 && before !== null && before !== n ? before : null;
              if (part.tremolo && !glide) {
                for (let k = 0; k < len; k += part.tremolo) {
                  play(at16(at, pos + k), n, vel * (k ? 0.8 : 1), part.tremolo * step * 0.9);
                }
              } else {
                play(t, n, vel, dur, from);
              }
              if (up) play(t, n + up, vel * 0.5, dur);
            });
            before = ns.length === 1 ? ns[0] + shift + (opt.shift || 0) : null;
            pos += len;
          }
        } while (opt.loop && pos < length);
        continue;
      }

      bars.forEach((halves, b) => {
        const t0 = at + b * bar;
        if (part.role === 'pad') {
          for (const h of halves) {
            for (const n of voiced(h)) play(t0 + h.from * step, n, 62 * level, h.span * step * 0.98);
          }
        } else if (part.role === 'arp') {
          const shape = pattern(tune, 'arp', opt.pattern || part.pattern);
          const every = opt.every || part.every || 1;
          for (let k = 0; k < steps / every; k++) {
            const s = k * every;
            if (silent(b, s)) continue;
            const v = voiced(harmony(b, s));
            const tones = [...v, v[0] + 12];
            if (part.drone) tones.push(part.drone);
            const n = tones[shape[k % shape.length] % tones.length];
            play(at16(t0, s), n, (s % 4 === 0 ? 72 : 58) * level, step * every * (part.hold ?? 0.9));
          }
        } else if (part.role === 'bass') {
          for (const [s, up, len, vel, above = 0] of pattern(tune, 'bass', opt.pattern || part.pattern)) {
            if (silent(b, s)) continue;
            const h = harmony(b, s);
            const low = 36 + h.bass - (h.bass > 7 ? 12 : 0) + 12 * (part.octave || 0);
            play(at16(t0, s), low + 12 * up + above, vel * level, len * step * 0.9);
          }
        } else if (part.role === 'comp') {
          for (const [s, len, vel = 100, stroke = 1] of pattern(tune, 'comp', opt.pattern || part.pattern)) {
            if (silent(b, s)) continue;
            const v = voiced(harmony(b, s));
            if (stroke < 0) v.reverse();
            v.forEach((n, i) => play(at16(t0, s) + i * (part.strum || 0), n, vel * level, len * step * 0.95));
          }
        } else {
          throw new Error(`part ${partName} has no role`);
        }
      });
    }

    // The drums.
    const kit = sec.drums ? pattern(tune, 'drums', sec.drums) : null;
    const fill = typeof sec.fill === 'string' ? pattern(tune, 'drums', sec.fill) : null;
    chords.forEach((_, b) => {
      const t0 = at + b * bar;
      const lastBar = b === chords.length - 1;
      const rows = lastBar && fill ? fill : kit;
      if (rows) {
        const span = rows.bars || 1;
        const which = lastBar && fill ? 0 : b % span;
        for (const [sound, row] of Object.entries(rows)) {
          if (sound === 'bars') continue;
          if (sound === 'snare' && sec.roll) continue;
          if (!DRUM[sound]) throw new Error('no drum ' + sound);
          const per = row.length / span;
          for (let i = 0; i < per; i++) {
            const c = row[which * per + i];
            if (c === '.' || c === undefined) continue;
            const s = i * steps / per;
            if (sec.fill === true && lastBar && s >= steps / 2) continue;
            if (silent(b, s)) continue;
            const t = per === steps ? at16(t0, s) : t0 + s * step;
            const vel = c === 'X' ? 127 : c === 'o' ? 50 : SOFT.has(sound) ? 80 : 110;
            add(t, DRUMS, DRUM[sound], vel, step);
          }
        }
      }
      if (sec.fill === true && lastBar) {
        const toms = [DRUM.tomHi, DRUM.tomHi, DRUM.tomMid, DRUM.tomMid, DRUM.tomLo, DRUM.tomLo, DRUM.snare, DRUM.snare];
        toms.forEach((n, k) => add(at16(t0, steps / 2 + k * steps / 16), DRUMS, n, 80 + k * 5, step));
      }
      // A roll: quarters, then eighths in the bar before last, sixteenths in
      // the last, and thirty-seconds on its last beat, getting louder all the
      // way.
      if (sec.roll) {
        const left = chords.length - 1 - b;
        const every = left >= 2 ? 4 : left === 1 ? 2 : 1;
        for (let s = 0; s < steps; s += every) {
          const vel = 55 + 55 * (b * steps + s) / (chords.length * steps);
          add(at16(t0, s), DRUMS, DRUM.snare, vel, step);
          if (lastBar && s >= steps - 4) add(t0 + (s + 0.5) * step, DRUMS, DRUM.snare, vel, step / 2);
        }
      }
      if (sec.crash && b === 0) add(t0, DRUMS, DRUM.crash, 100, step);
    });

    if (sec.riser) {
      const n = sec.riser === true ? chords.length : sec.riser;
      add(at + (chords.length - n) * bar, DRUMS, DRUM.riser, 100, n * bar);
    }
    at += chords.length * bar;
  }

  notes.sort((p, q) => p[0] - q[0]);
  const room = { ...tune.room };
  if (room.echo) room.echo *= 60 / tune.bpm;
  return {
    patches,
    pans,
    kit: tune.kit || {},
    room,
    ducking: tune.ducking ?? 0.5,
    level: tune.level ?? 1,
    tuning: tune.tuning ? temperament(tune.tuning) : null,
    temperament: tune.tuning || null,
    marks,
    length: at + (tune.tail || 0),
    gap: 0,
    notes,
  };
}

// For checking a tune: each melody each section plays, its bars, and how
// many bars the melody fills, which should be the same unless it loops.
export function melodyBars(tune) {
  const steps = tune.steps || 16;
  const out = [];
  for (const section of tune.form) {
    const sec = tune.sections[section];
    const bars = tune.chords[sec.chords].slice(0, sec.bars || Infinity).length;
    for (const [part, setting] of Object.entries(sec.play || {})) {
      if (tune.parts[part].role !== 'melody' || !setting) continue;
      const name = typeof setting === 'string' ? setting : setting.melody;
      if (setting.loop) continue;
      const filled = melody(tune.melodies[name]).reduce((sum, m) => sum + m.len, 0) / steps;
      out.push({ section, part, melody: name, bars, filled });
    }
  }
  return out;
}
