// The synth, a sample at a time, all in one audio worklet so what plays is
// exactly what renders offline. It has five kinds of voice: an analog-style
// synth, a pipe organ, an FM synth, plucked strings, and a drum machine; and
// a room with an echo around them all.
//
// Notes arrive from player.js ahead of time, in the order they are to be
// played, and start on the sample they fall on. Each carries its patch, and
// the patch says which kind of voice plays it.

const TAU = Math.PI * 2;

// A turn of sine, looked up rather than worked out: this runs a few million
// times a second.
const TABLE = 8192;
const SINE = new Float32Array(TABLE + 1);
for (let i = 0; i <= TABLE; i++) SINE[i] = Math.sin(TAU * i / TABLE);

function sine(ph) {
  let x = ph * (TABLE / TAU);
  x -= Math.floor(x / TABLE) * TABLE;
  const i = x | 0;
  return SINE[i] + (SINE[i + 1] - SINE[i]) * (x - i);
}

// Softly, above four fifths of the way up, so a busy passage is held in
// rather than clipped: past the knee the last fifth bends over towards 1,
// meeting the straight part without a step. A rational stand-in for tanh,
// which is too dear to work out a few hundred thousand times a second; it
// reaches 1 at 3 and is held there, since past 3 it climbs again.
function hold(x) {
  if (x > -0.8 && x < 0.8) return x;
  const sign = x < 0 ? -1 : 1;
  const u = Math.min(3, (x * sign - 0.8) / 0.2);
  const u2 = u * u;
  return sign * (0.8 + 0.2 * u * (27 + u2) / (27 + 9 * u2));
}

// An envelope, kept as a running product rather than an exponential
// worked out afresh every sample: attack up, decay towards the sustain level,
// then a release once the key is let go.
class Envelope {
  constructor(a, d, s, r, sr) {
    this.a = a;
    this.s = s;
    this.decay = Math.exp(-(3 / Math.max(d, 0.01)) / sr);
    this.release = Math.exp(-(4 / Math.max(r, 0.02)) / sr);
    this.held = 1;      // the decaying part, from the end of the attack
    this.let = 1;       // the release, once the note is over
  }

  at(t, until) {
    let e;
    if (t < this.a) {
      e = t / this.a;
    } else {
      e = this.s + (1 - this.s) * this.held;
      this.held *= this.decay;
    }
    if (t > until) {
      this.let *= this.release;
      e *= this.let;
    }
    return e;
  }
}

// A state variable filter, trapezoidal, at a fixed frequency: low, band and
// high pass all at once.
class Filter {
  constructor(f, q, sr) {
    const g = Math.tan(Math.PI * Math.min(f, sr * 0.45) / sr);
    this.k = 1 / q;
    this.a1 = 1 / (1 + g * (g + this.k));
    this.a2 = g * this.a1;
    this.a3 = g * this.a2;
    this.ic1 = 0;
    this.ic2 = 0;
    this.lp = 0;
    this.hp = 0;
  }

  // Returns the band pass, and leaves the low and high pass to be read.
  run(x) {
    const v3 = x - this.ic2;
    const v1 = this.a1 * this.ic1 + this.a2 * v3;
    const v2 = this.ic2 + this.a2 * this.ic1 + this.a3 * v3;
    this.ic1 = 2 * v1 - this.ic1;
    this.ic2 = 2 * v2 - this.ic2;
    this.lp = v2;
    this.hp = x - this.k * v1 - v2;
    return v1;
  }
}

// ------------------------------------------------------------- the synth
//
// A few saws or squares a few cents apart, through a resonant low-pass whose
// cutoff has an envelope of its own. `drop` starts the note that many
// semitones high and falls to it, as an 808's bass drum does; `drive` pushes
// it into the soft clip before the filter.

function blep(t, dt) {
  if (t < dt) { t /= dt; return t + t - t * t - 1; }
  if (t > 1 - dt) { t = (t - 1) / dt; return t * t + t + t + 1; }
  return 0;
}

function osc(shape, p, dt) {
  if (shape === 'saw') return 2 * p - 1 - blep(p, dt);
  if (shape === 'tri') return 1 - 4 * Math.abs(p - 0.5);
  if (shape === 'sine') return sine(TAU * p);
  // A narrow pulse, a quarter of the way high, as an old games console had.
  if (shape === 'pulse') return (p < 0.25 ? 1.5 : -0.5) + blep(p, dt) - blep((p + 0.75) % 1, dt);
  let s = p < 0.5 ? 1 : -1;
  s += blep(p, dt);
  s -= blep((p + 0.5) % 1, dt);
  return s;
}

class Synth {
  constructor(note, sr) {
    const p = note.patch;
    this.patch = p;
    this.level = note.level * (p.gain ?? 1);
    this.gainL = note.gainL;
    this.gainR = note.gainR;
    this.held = note.held;
    this.cut = Infinity;
    this.dt = 1 / sr;
    this.sr = sr;
    this.t = 0;
    const n = p.voices || 1;
    const spread = p.detune || 0;
    this.incs = [];
    this.phs = [];
    for (let i = 0; i < n; i++) {
      const cents = n === 1 ? 0 : spread * (2 * i / (n - 1) - 1);
      this.incs.push(Math.min(0.5, note.f * 2 ** (cents / 1200) / sr));
      this.phs.push(p.drop ? 0 : Math.random());
    }
    this.subInc = note.f / 2 / sr;
    this.subPh = 0;
    this.norm = 1 / Math.sqrt(n);
    this.env = new Envelope(p.a, p.d, p.s, p.r, sr);
    this.fenv = new Envelope(p.fa || 0.002, p.fd || 0.3, p.fs || 0, p.r, sr);
    // Higher notes open the filter further, as a keyboard's tracking does.
    this.base = p.cutoff * (note.f / 262) ** (p.track || 0.5);
    this.k = 1 / (p.res || 0.8);
    this.ic1 = 0;
    this.ic2 = 0;
    this.vib = p.vib || 0;
    this.drop = (p.drop || 0) / 12;
    this.dropTime = p.dropTime || 0.04;
    this.drive = p.drive || 0;
    // A patch with glide starts at the note before and slides to its own,
    // `bend` the ratio still to go.
    this.bend = 1;
    this.bendBy = 1;
    if (note.from && p.glide) {
      this.bend = note.from / note.f;
      this.bendBy = (note.f / note.from) ** (1 / (p.glide * sr));
    }
    this.dead = false;
  }

  sample() {
    const p = this.patch;
    const t = this.t;
    const until = this.cut < this.held ? this.cut : this.held;
    const e = this.env.at(t, until);
    const fe = this.fenv.at(t, until);
    let wob = this.vib && t > 0.25 ? 1 + this.vib * sine(TAU * 5.5 * t) : 1;
    if (this.drop && t < this.dropTime * 8) wob *= 2 ** (this.drop * Math.exp(-t / this.dropTime));
    if (this.bend !== 1) {
      wob *= this.bend;
      this.bend *= this.bendBy;
      if ((this.bendBy > 1) === (this.bend >= 1)) this.bend = 1;
    }
    let x = 0;
    for (let i = 0; i < this.phs.length; i++) {
      const inc = this.incs[i] * wob;
      x += osc(p.wave, this.phs[i], inc);
      this.phs[i] += inc;
      if (this.phs[i] >= 1) this.phs[i] -= 1;
    }
    x *= this.norm;
    if (p.sub) {
      x += p.sub * (this.subPh < 0.5 ? 1 : -1);
      this.subPh += this.subInc * wob;
      if (this.subPh >= 1) this.subPh -= 1;
    }
    if (this.drive) x = hold(x * this.drive);
    // The state variable filter, trapezoidal, cutoff worked out each sample
    // only as a cheap approximation of the tangent it needs.
    const fc = Math.min(this.sr * 0.4, this.base + p.env * fe);
    const w = Math.PI * fc / this.sr;
    const g = w + w * w * w / 3 + 2 * w ** 5 / 15;
    const a1 = 1 / (1 + g * (g + this.k));
    const a2 = g * a1;
    const a3 = g * a2;
    const v3 = x - this.ic2;
    const v1 = a1 * this.ic1 + a2 * v3;
    const v2 = this.ic2 + a2 * this.ic1 + a3 * v3;
    this.ic1 = 2 * v1 - this.ic1;
    this.ic2 = 2 * v2 - this.ic2;
    const out = v2 * e * this.level;
    this.t = t + this.dt;
    if (t > until && e < 0.0005) this.dead = true;
    return out;
  }
}

// ------------------------------------------------------------- the organ
//
// Every stop drawn is a rank of pipes, and every key that is down sounds one
// pipe from each. A pipe is a fixed tone - the strengths of its harmonics,
// as its voicer left them - at a pitch set by its length: 8 ft at the pitch
// of the key, 4 ft an octave up, 16 ft an octave down, 2 2/3 ft a twelfth up,
// tuned pure, as mutations are. A mixture is several ranks of high
// principals at once, each breaking back an octave wherever it would climb
// too high, as a builder lays one out.
//
// A pipe takes longer to speak the bigger it is, and the flues speak with a
// little chiff; the reeds speak fast. No two pipes are exactly in tune - each
// is a cent or so off, always the same way - so a chorus of them shimmers.
// The pipes all draw on one wind, which sags a little under a full chord,
// and a tremulant shakes it.

const TONES = {
  principal: { h: k => k ** -1.3 * (k > 10 ? 0.5 : 1), count: 24, chiff: 0.3 },
  flute: { h: [1, 0.16, 0.06, 0.03, 0.015], chiff: 0.5 },
  gedackt: { h: [1, 0.02, 0.24, 0.015, 0.07, 0.01, 0.025], chiff: 0.45 },
  viole: { h: k => 0.9 * k ** -0.7, count: 32, chiff: 0.12, speak: 1.6 },
  trumpet: { h: k => (k < 5 ? 0.5 + 0.12 * k : 1.1 * (5 / k) ** 0.85), count: 40, reed: true, chiff: 0 },
  trombone: { h: k => (k < 3 ? 0.6 + 0.2 * k : 1.1 * (3 / k) ** 0.8), count: 40, reed: true, chiff: 0 },
  oboe: { h: [0.3, 0.55, 1, 0.85, 0.5, 0.32, 0.2, 0.14, 0.1, 0.07, 0.05, 0.035], reed: true, chiff: 0 },
};
for (const tone of Object.values(TONES)) {
  if (Array.isArray(tone.h)) { const h = tone.h; tone.count = h.length; tone.h = k => h[k - 1]; }
}

const MIXTURE = [6, 8, 12, 16];   // harmonics: 1 1/3, 1, 2/3 and 1/2 ft
const CHIFF = 0.25;               // the chiff at its loudest, against a pipe's 0.5
const MIXTURE_TOP = 4300;         // a rank breaks back below this

// A tone's one turn, built from its harmonics up to `n` of them; a pipe
// plays the one with as many as fit below half the sample rate. All are
// built as the synth loads, since building one mid-tune would hold up the
// sound.
const WAVE = 2048;
const WAVES = new Map();
const HARMONIC_STEPS = [1, 2, 3, 4, 6, 8, 12, 16, 24, 32, 40];

for (const [name, tone] of Object.entries(TONES)) {
  // Scaled by all its harmonics, not just those kept, so a high pipe is not
  // made louder for having fewer.
  let power = 0;
  for (let k = 1; k <= tone.count; k++) power += tone.h(k) ** 2 / 2;
  const scale = 0.5 / Math.sqrt(power);
  for (const n of HARMONIC_STEPS) {
    if (n > tone.count) break;
    const w = new Float32Array(WAVE + 1);
    for (let k = 1; k <= n; k++) {
      const amp = tone.h(k) * scale;
      const phase = ((k * k * 0.618) % 1) * TAU;
      for (let i = 0; i < WAVE; i++) w[i] += amp * sine(TAU * k * i / WAVE + phase);
    }
    w[WAVE] = w[0];
    WAVES.set(name + n, w);
  }
}

function wave(name, f, sr) {
  const top = Math.min(TONES[name].count, Math.floor(sr * 0.45 / f));
  let n = 1;
  for (const s of HARMONIC_STEPS) if (s <= top) n = s;
  return WAVES.get(name + n);
}

// How far a pipe is out of tune, in cents: the same for the same pipe every
// time it plays.
function mistune(key, rank) {
  const x = Math.sin(key * 12.9898 + rank * 78.233) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}

class Organ {
  constructor(note, sr, air) {
    const p = note.patch;
    this.air = air;
    this.level = note.level * (p.gain ?? 1);
    this.gainL = note.gainL;
    this.gainR = note.gainR;
    this.held = note.held;
    this.cut = Infinity;
    this.dt = 1 / sr;
    this.t = 0;
    this.dead = false;
    this.trem = p.trem || 0;
    this.spread = p.spread ?? 1.2;
    this.pipes = [];
    const key = Math.round(69 + 12 * Math.log2(note.f / 440));
    p.pipes.forEach(([tone, foot, level = 1, cents = 0], rank) => {
      if (tone === 'mixture') {
        MIXTURE.slice(0, foot).forEach((h, k) => {
          let f = note.f * h;
          while (f > MIXTURE_TOP) f /= 2;
          this.pipe('principal', f, level * 0.55, cents, key, rank * 8 + k, sr);
        });
      } else {
        this.pipe(tone, note.f * 8 / foot, level, cents, key, rank * 8, sr);
      }
    });
    // The biggest pipe sets how long the note takes to die once let go.
    const low = Math.min(...this.pipes.map(q => q.f));
    this.release = (p.r ?? 0.05) + 1.5 / low;
  }

  pipe(name, f, level, cents, key, rank, sr) {
    if (f > sr * 0.45) return;
    const tone = TONES[name];
    f *= 2 ** ((cents + this.spread * mistune(key, rank)) / 1200);
    const speak = (0.012 + 1.6 / f) * (tone.reed ? 0.45 : 1) * (tone.speak || 1);
    // The chiff: noise ringing at about the pipe's second harmonic as it
    // finds its note. The ringing is scaled to come out as loud whatever its
    // pitch: a resonance that narrow would otherwise make the noise into a
    // pipe's lowest harmonics hundreds of times louder than into its top.
    const fc = Math.min(f * 2, 7000);
    const bw = fc / 4;
    const r = Math.exp(-Math.PI * bw / sr);
    const w = TAU * fc / sr;
    const peak = (1 - r) * Math.sqrt(1 - 2 * r * Math.cos(2 * w) + r * r);
    this.pipes.push({
      wave: wave(name, f, sr), inc: f / sr, ph: Math.random(), f, level, speak,
      chiff: tone.chiff * level, gain: CHIFF * peak / Math.sqrt(Math.PI * bw / (3 * sr)),
      c1: 2 * r * Math.cos(w), c2: -r * r, y1: 0, y2: 0,
    });
  }

  sample() {
    const t = this.t;
    const air = this.air;
    const until = this.cut < this.held ? this.cut : this.held;
    let amp = 1;
    if (t > until) {
      amp = Math.exp(-(t - until) / this.release);
      if (amp < 0.0008) this.dead = true;
    }
    let shake = 1, bend = air.pitch;
    if (this.trem) {
      const s = sine(TAU * 5.4 * air.time);
      shake = 1 + this.trem * s;
      bend *= 1 + this.trem * 0.004 * s;
    }
    let x = 0;
    const pipes = this.pipes;
    for (let k = 0; k < pipes.length; k++) {
      const q = pipes[k];
      const pos = q.ph * WAVE;
      const i = pos | 0;
      let v = q.wave[i] + (q.wave[i + 1] - q.wave[i]) * (pos - i);
      if (t < q.speak) {
        const u = t / q.speak;
        v *= u * u * (3 - 2 * u);
      }
      x += v * q.level;
      if (q.chiff && t < q.speak * 3) {
        const n = (Math.random() * 2 - 1) * q.chiff * Math.exp(-t / (q.speak * 0.6));
        const y = n * q.gain + q.c1 * q.y1 + q.c2 * q.y2;
        q.y2 = q.y1;
        q.y1 = y;
        x += y;
      }
      q.ph += q.inc * bend;
      if (q.ph >= 1) q.ph -= 1;
    }
    this.t = t + this.dt;
    return x * amp * shake * air.pressure * this.level;
  }
}

// ------------------------------------------------------------- FM
//
// A sine carrier whose phase is pushed about by other sines, each at a ratio
// of the note and dying away at its own rate: bright and metallic as it is
// struck, mellowing as the modulation falls. An e-piano, a steel pan, a vibe
// or a marimba, by how the ratios are set. `trem` is the vibe's motor.

class FM {
  constructor(note, sr) {
    const p = note.patch;
    const fm = p.fm;
    this.level = note.level * (p.gain ?? 1);
    this.gainL = note.gainL;
    this.gainR = note.gainR;
    this.held = note.held;
    this.cut = Infinity;
    this.dt = 1 / sr;
    this.t = 0;
    this.dead = false;
    this.env = new Envelope(p.a, p.d, p.s, p.r, sr);
    this.inc = note.f * (fm.ratio || 1) / sr;
    this.ph = 0;
    // Higher notes are struck less brightly, as tines and bars are.
    const scale = Math.min(2, Math.max(0.3, (262 / note.f) ** (fm.scale ?? 0.3)));
    this.mods = fm.mods.map(m => ({
      inc: note.f * m.ratio / sr, ph: 0, index: m.index * scale, keep: m.sustain || 0, e: 1,
      fall: Math.exp(-1 / (m.decay * sr)),
    }));
    this.tremRate = fm.tremRate || 5;
    this.trem = fm.trem || 0;
  }

  sample() {
    const t = this.t;
    const until = this.cut < this.held ? this.cut : this.held;
    const e = this.env.at(t, until);
    let mod = 0;
    for (let k = 0; k < this.mods.length; k++) {
      const m = this.mods[k];
      mod += m.index * (m.keep + (1 - m.keep) * m.e) * sine(TAU * m.ph);
      m.e *= m.fall;
      m.ph += m.inc;
      if (m.ph >= 1) m.ph -= 1;
    }
    let x = sine(TAU * this.ph + mod);
    this.ph += this.inc;
    if (this.ph >= 1) this.ph -= 1;
    if (this.trem) x *= 1 - this.trem * (0.5 + 0.5 * sine(TAU * this.tremRate * t));
    this.t = t + this.dt;
    if (t > until && e < 0.0005) this.dead = true;
    return x * e * this.level;
  }
}

// ------------------------------------------------------------- strings
//
// Plucked strings, Karplus-Strong: a burst of noise the length of one period
// of the note, fed round and round a delay line with a little low-pass in
// the loop, so it rings at the note and loses its top first, as a string
// does. `bright` is how hard and near the bridge it is picked, `decay` how
// long it rings, `courses` how many strings sound together (a mandolin's
// pairs), and `glide` a slide into the note, as on a dobro.

class Pluck {
  constructor(note, sr) {
    const p = note.patch;
    const pl = p.pluck;
    this.level = note.level * (p.gain ?? 1);
    this.gainL = note.gainL;
    this.gainR = note.gainR;
    this.held = note.held;
    this.cut = Infinity;
    this.dt = 1 / sr;
    this.t = 0;
    this.dead = false;
    this.quiet = 0;
    const bright = pl.bright ?? 0.6;
    this.s = 0.5 - 0.35 * bright;   // the loop filter: 0.5 is darkest
    const courses = pl.courses || 1;
    this.strings = [];
    for (let c = 0; c < courses; c++) {
      const cents = courses === 1 ? 0 : (pl.spread ?? 4) * (c / (courses - 1) - 0.5);
      const f = note.f * 2 ** (cents / 1200);
      const from = note.from && p.glide ? note.from * 2 ** (cents / 1200) : f;
      const period = sr / f;
      const size = Math.ceil(sr / Math.min(f, from)) + 4;
      const buf = new Float32Array(size);
      // The pluck: the string pulled aside at the pick and let go - a
      // triangle, peaking where along the string it is picked - with noise
      // mixed in the brighter it is picked. The noise is softened for a
      // gentler touch, less a copy of itself from further along, for the
      // pick's place again. Scaled so its loudest point is 1: noise alone
      // would start every note on a random spike far above the ring.
      const first = Math.ceil(period);
      const pick = Math.max(1, Math.min(first - 1, Math.round(first * (pl.pick ?? 0.15))));
      let lp = 0, top = 0;
      const a = 0.15 + 0.85 * bright;
      for (let i = 0; i < first; i++) {
        lp += a * (Math.random() * 2 - 1 - lp);
        buf[i] = lp;
      }
      for (let i = first - 1; i >= pick; i--) buf[i] -= buf[i - pick];
      for (let i = 0; i < first; i++) top = Math.max(top, Math.abs(buf[i]));
      let mean = 0;
      for (let i = 0; i < first; i++) {
        const tri = i < pick ? i / pick : (first - i) / (first - pick);
        buf[i] = bright * buf[i] / (top || 1) + (1 - bright) * tri;
        mean += buf[i];
      }
      mean /= first;
      top = 0;
      for (let i = 0; i < first; i++) top = Math.max(top, Math.abs(buf[i] -= mean));
      for (let i = 0; i < first; i++) buf[i] /= top || 1;
      this.strings.push({
        buf, size, w: first, prev: 0,
        delay: period - this.s, from: sr / from - this.s,
        ring: 10 ** (-3 / ((pl.decay ?? 2) * (262 / f) ** 0.4 * f)),
        mute: 10 ** (-3 / ((p.r ?? 0.1) * f)),
      });
    }
    this.glide = p.glide || 0;
    this.norm = 8 / courses;
  }

  sample() {
    const t = this.t;
    const until = this.cut < this.held ? this.cut : this.held;
    const glide = this.glide && t < this.glide * 6 ? Math.exp(-t / this.glide) : 0;
    let out = 0;
    for (let k = 0; k < this.strings.length; k++) {
      const st = this.strings[k];
      const d = st.delay + (st.from - st.delay) * glide;
      let r = st.w - d;
      if (r < 0) r += st.size;
      const i = r | 0;
      const j = i + 1 === st.size ? 0 : i + 1;
      const y = st.buf[i] + (st.buf[j] - st.buf[i]) * (r - i);
      const g = t > until ? st.mute : st.ring;
      st.buf[st.w] = g * ((1 - this.s) * y + this.s * st.prev);
      st.prev = y;
      st.w = st.w + 1 === st.size ? 0 : st.w + 1;
      out += y;
    }
    // Let go once it has fallen quiet.
    this.quiet = Math.abs(out) > 0.0004 ? 0 : this.quiet + 1;
    if (this.quiet > 2000 || t > until + 3) this.dead = true;
    this.t = t + this.dt;
    return out * this.norm * this.level;
  }
}

// ------------------------------------------------------------- the drums
//
// A drum machine after the 808: a bass drum that booms and drops in pitch, a
// snare of two tuned heads and noise, a clap of quick bursts, cymbals and
// hats from six square waves at odd ratios, a cowbell of two, rim, clave,
// toms and congas, maracas, a shaker and a tambourine, and a rising sweep of
// noise. A tune's kit tunes them - `kit.kick = { f, drop, decay }` and so on
// - and says whether the hats are metal, as the 808's, or noise. A part can
// play the tuned ones, the toms, congas, cowbell and bass drum, as notes.

const METAL = [205.3, 304.4, 369.6, 522.7, 540, 800];

const DRUM = {
  kick: { f: 52, drop: 2.2, decay: 0.45, click: 0.5 },
  snare: { f: 185, decay: 0.14, snappy: 0.8, body: 0.5 },
  clap: { decay: 0.14, f: 1150 },
  rim: { f: 1700, decay: 0.012 },
  clave: { f: 2500, decay: 0.03 },
  cowbell: { f: 540, decay: 0.11 },
  hat: { decay: 0.045, f: 9500 },
  open: { decay: 0.32, f: 9000 },
  crash: { decay: 1.0, f: 7000 },
  ride: { decay: 1.3, f: 5500 },
  tom: { f: 140, decay: 0.3, drop: 0.35 },
  conga: { f: 260, decay: 0.16, drop: 0.12 },
  maracas: { decay: 0.03, f: 7500 },
  shaker: { decay: 0.05, f: 5000 },
  tambourine: { decay: 0.13, f: 8500 },
  riser: {},
};

class Drum {
  constructor(note, sr) {
    const kit = note.tone || {};
    const k = note.kit;
    const o = { ...DRUM[k], ...kit[k] };
    this.kit = k;
    this.o = o;
    this.f = note.f || o.f * (note.pitch || 1);
    this.level = note.level * (o.gain ?? 1);
    this.gainL = note.gainL;
    this.gainR = note.gainR;
    this.dt = 1 / sr;
    this.sr = sr;
    this.t = 0;
    this.ph = 0;
    this.ph2 = 0;
    this.lp = 0;
    this.choked = 0;
    this.dead = false;
    this.metal = kit.metal ?? true;
    this.decay = o.decay;
    this.length = k === 'riser' ? note.length : Math.min(3, this.decay * 7 + 0.02);
    this.phs = METAL.map(() => Math.random());
    if (k === 'snare') this.filter = new Filter(o.tone ?? 2200, 0.7, sr);
    else if (k === 'clap') this.filter = new Filter(o.f, 1.6, sr);
    else if (k === 'cowbell') this.filter = new Filter(this.f * 2.5, 1.2, sr);
    else if (k === 'rim') this.filter = new Filter(3000, 1, sr);
    else if (['hat', 'open', 'crash', 'ride', 'maracas', 'shaker', 'tambourine'].includes(k)) {
      this.filter = new Filter(o.f, k === 'shaker' ? 1.4 : 0.9, sr);
      this.high = new Filter(o.f * 0.7, 0.7, sr);
    }
  }

  // Cut short, as a closed hat cuts off an open one.
  choke() {
    if (!this.choked) this.choked = this.t + 0.005;
  }

  metallic(scale) {
    let s = 0;
    for (let i = 0; i < 6; i++) {
      s += this.phs[i] < 0.5 ? 1 : -1;
      this.phs[i] += METAL[i] * scale * this.dt;
      if (this.phs[i] >= 1) this.phs[i] -= 1;
    }
    return s / 6;
  }

  sample() {
    const t = this.t;
    const o = this.o;
    const n = Math.random() * 2 - 1;
    let out;
    switch (this.kit) {
      case 'kick': {
        const f = this.f * (1 + o.drop * Math.exp(-t / 0.035));
        this.ph += f * this.dt;
        out = hold(sine(TAU * this.ph) * 1.3) * Math.exp(-t / this.decay)
            + n * o.click * Math.exp(-t / 0.0015);
        break;
      }
      case 'snare': {
        this.ph += this.f * this.dt;
        this.ph2 += this.f * 1.62 * this.dt;
        const body = (sine(TAU * this.ph) + 0.6 * sine(TAU * this.ph2)) * Math.exp(-t / 0.055);
        this.filter.run(n);
        out = o.body * body + o.snappy * this.filter.hp * Math.exp(-t / this.decay);
        break;
      }
      case 'clap': {
        // Three quick bursts, then the tail.
        const burst = t < 0.03 ? Math.exp(-(t % 0.01) / 0.0025) : Math.exp(-(t - 0.03) / this.decay);
        out = 2.2 * this.filter.run(n) * burst;
        break;
      }
      case 'rim':
        this.ph += this.f * this.dt;
        out = (sine(TAU * this.ph) * 0.7 + this.filter.run(n)) * Math.exp(-t / this.decay);
        break;
      case 'clave':
        this.ph += this.f * this.dt;
        out = sine(TAU * this.ph) * Math.exp(-t / this.decay);
        break;
      case 'cowbell': {
        this.ph += this.f * this.dt;
        this.ph2 += this.f * 1.4815 * this.dt;
        if (this.ph >= 1) this.ph -= 1;
        if (this.ph2 >= 1) this.ph2 -= 1;
        const sq = (this.ph < 0.5 ? 1 : -1) + (this.ph2 < 0.5 ? 1 : -1);
        out = 1.4 * this.filter.run(sq) * (0.6 * Math.exp(-t / 0.012) + 0.4 * Math.exp(-t / this.decay));
        break;
      }
      case 'tom':
      case 'conga': {
        const f = this.f * (1 + o.drop * Math.exp(-t / (o.dropTime ?? (this.kit === 'tom' ? 0.06 : 0.02))));
        this.ph += f * this.dt;
        out = sine(TAU * this.ph) * Math.exp(-t / this.decay) + n * 0.25 * Math.exp(-t / 0.004);
        break;
      }
      case 'riser': {
        // A sweep: noise through a low-pass opening up as it swells, cut off
        // dead as the next section lands.
        const u = t / this.length;
        this.lp += (0.02 + 0.5 * u * u) * (n - this.lp);
        out = this.lp * 0.9 * u * u;
        break;
      }
      default: {
        // Hats, cymbals and the shakers: metal or noise, with everything
        // below the top taken out.
        let src = n;
        if (this.metal && (this.kit === 'hat' || this.kit === 'open' || this.kit === 'crash')) src = this.metallic(1) + n * 0.15;
        else if (this.kit === 'ride') src = this.metallic(1.7) * 0.8 + n * 0.3;
        else if (this.kit === 'tambourine') src = this.metallic(2.9) * 0.6 + n * 0.6;
        this.high.run(this.filter.run(src));
        const rise = this.kit === 'shaker' ? Math.min(1, t / 0.012) : 1;
        out = 1.6 * this.high.hp * rise * Math.exp(-t / this.decay);
      }
    }
    if (this.choked && t > this.choked) out *= Math.exp(-(t - this.choked) / 0.004);
    out *= this.level * 0.85;
    this.t = t + this.dt;
    if (t > this.length || (this.choked && t > this.choked + 0.04)) this.dead = true;
    return out;
  }
}

// ------------------------------------------------------------- the room
//
// The space, worked out here beside the voices rather than with
// WebAudio's own nodes, so what plays is exactly what renders offline. A
// ping-pong echo, each side feeding the other; and a reverb after Freeverb's
// - six damped feedback combs, then four all-passes to smear them - fed the
// two sides together, heard in full on the left and a moment late on the
// right for width. What goes into the reverb has its bass cut below `cut`
// hertz first, so low notes stay clean rather than booming on and on. Each
// tune sets its own: a cathedral for the organ, a small room for the
// strings.

const COMBS = [1557, 1617, 1491, 1422, 1277, 1356];   // Freeverb's, at 44.1 kHz
const ALLPASSES = [556, 441, 341, 225];

class Room {
  constructor(sr, o = {}) {
    this.d = Math.max(1, Math.round((o.echo ?? 0.36) * sr));
    this.echoL = new Float32Array(this.d);
    this.echoR = new Float32Array(this.d);
    this.echoSend = o.echo === 0 ? 0 : o.echoSend ?? 0.16;
    this.echoFeedback = o.echoFeedback ?? 0.35;
    const size = o.size ?? 1.6;
    this.combs = COMBS.map(c => new Float32Array(Math.round(c * sr / 44100 * size)));
    this.store = COMBS.map(() => 0);
    this.at = COMBS.map(() => 0);
    this.passes = ALLPASSES.map(c => new Float32Array(Math.round(c * sr / 44100)));
    this.passAt = ALLPASSES.map(() => 0);
    this.feedback = o.decay ?? 0.84;
    this.damp = o.damp ?? 0.2;
    this.input = o.input ?? 0.025;
    this.cut = 1 - Math.exp(-TAU * (o.cut ?? 100) / sr);
    this.below = 0;
    this.send = o.send ?? 0.64;
    this.spread = new Float32Array(Math.max(1, Math.round((o.spread ?? 300) * sr / 48000)));
    this.e = 0;
    this.s = 0;
  }

  // Takes the dry pair in `io`, and leaves the pair with the room and echo on.
  run(io) {
    const [l, r] = io;
    // The echo: what went in a while ago, and the other side's echo then.
    const e = this.e;
    const eL = this.echoL[e], eR = this.echoR[e];
    this.echoL[e] = l * this.echoSend + eR * this.echoFeedback;
    this.echoR[e] = r * this.echoSend + eL * this.echoFeedback;
    this.e = e + 1 === this.d ? 0 : e + 1;
    // The reverb, its bass cut first.
    const mix = (l + r) * this.input;
    this.below += this.cut * (mix - this.below);
    const x = mix - this.below;
    let v = 0;
    for (let k = 0; k < 6; k++) {
      const buf = this.combs[k], i = this.at[k];
      const y = buf[i];
      this.store[k] = y * (1 - this.damp) + this.store[k] * this.damp;
      buf[i] = x + this.store[k] * this.feedback;
      v += y;
      this.at[k] = i + 1 === buf.length ? 0 : i + 1;
    }
    for (let k = 0; k < 4; k++) {
      const buf = this.passes[k], i = this.passAt[k];
      const y = buf[i];
      buf[i] = v + y * 0.5;
      v = y - v;
      this.passAt[k] = i + 1 === buf.length ? 0 : i + 1;
    }
    const late = this.spread[this.s];
    this.spread[this.s] = v;
    this.s = this.s + 1 === this.spread.length ? 0 : this.s + 1;
    io[0] = l + eL + v * this.send;
    io[1] = r + eR + late * this.send;
  }
}

// ------------------------------------------------------------- the processor

const VOICES = 48;          // notes sounding at once, before the oldest is let go

const IDLE_SECONDS = 6;   // longer than the room's tail takes to fall silent

class SynthProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const opts = (options && options.processorOptions) || {};
    this.duck = 0;           // the kick's sidechain, 1 as it lands
    this.ducking = 0.5;      // how far a kick ducks the rest
    this.base = opts.gain || 1.0;
    this.gain = this.base;
    this.pending = [];       // notes not yet due, in the order they arrived
    this.next = 0;
    this.voices = [];
    this.drums = [];
    this.room = new Room(sampleRate);
    this.io = [0, 0];
    // The organ's wind: its pressure, which sags as more pipes draw on it,
    // the pitch that goes with it, and the time, for the tremulant.
    this.air = { pressure: 1, pitch: 1, time: 0, flutter: 0 };
    // Samples since the last note or drum fell silent. Once the room's tail
    // has had IDLE_SECONDS to die away with nothing playing or due, a block
    // is left silent without being worked out - the music's second synth,
    // there for crossfades, sits that way between them.
    this.idle = 0;
    this.port.onmessage = e => {
      const m = e.data;
      if (m.type === 'note') {
        this.pending.push(m);
      } else if (m.type === 'silence') {
        this.pending.length = 0;
        this.next = 0;
        this.voices.length = 0;
        this.drums.length = 0;
      } else if (m.type === 'room') {
        this.room = new Room(sampleRate, m.room || {});
        this.ducking = m.ducking ?? 0.5;
        this.gain = this.base * (m.level ?? 1);
      } else if (m.type === 'gain') {
        this.gain = m.gain;
      }
    };
  }

  // A voice for the note, letting go of the one sounding longest when all
  // are busy.
  start(note) {
    if (note.kit) {
      if (note.kit === 'kick') this.duck = Math.max(this.duck, note.level);
      if (note.kit === 'hat') for (const d of this.drums) if (d.kit === 'open') d.choke();
      this.hit(new Drum(note, sampleRate));
      return;
    }
    const p = note.patch;
    if (p.drum) {
      this.hit(new Drum({
        kit: p.drum, tone: { [p.drum]: p }, f: note.f, level: note.level,
        gainL: note.gainL, gainR: note.gainR,
      }, sampleRate));
      if (p.duck) this.duck = Math.max(this.duck, note.level * p.duck);
      return;
    }
    const held = this.voices.filter(v => v.cut === Infinity);
    if (held.length >= VOICES) {
      let oldest = held[0];
      for (const v of held) if (v.t > oldest.t) oldest = v;
      oldest.cut = oldest.t;
    }
    const Voice = p.pipes ? Organ : p.fm ? FM : p.pluck ? Pluck : Synth;
    this.voices.push(new Voice(note, sampleRate, this.air));
    if (p.duck) this.duck = Math.max(this.duck, note.level * p.duck);
  }

  // A drum, cutting off the last hit of the same drum at the same pitch, as
  // an 808 has one voice for each: a fast roll then stays a roll rather than
  // piling up.
  hit(drum) {
    if (drum.kit !== 'riser') for (const d of this.drums) if (d.kit === drum.kit && d.f === drum.f) d.choke();
    this.drums.push(drum);
  }

  // The wind, once a block: the pressure eases towards where the pipes
  // sounding would pull it, with a little unsteadiness of its own.
  wind(n) {
    let pipes = 0;
    for (const v of this.voices) if (v.pipes && !v.dead) pipes += v.pipes.length;
    const air = this.air;
    const want = 1 - 0.035 * Math.min(1, pipes / 90);
    air.flutter = air.flutter * 0.98 + (Math.random() * 2 - 1) * 0.00012;
    air.pressure += (want - air.pressure) * (1 - Math.exp(-n / (0.07 * sampleRate))) + air.flutter;
    air.pitch = 1 + 0.03 * (air.pressure - 1);
  }

  process(inputs, outputs) {
    const due = this.next < this.pending.length;
    if (!this.voices.length && !this.drums.length && !due && this.idle > IDLE_SECONDS * sampleRate) return true;
    const out = outputs[0];
    const left = out[0];
    const right = out.length > 1 ? out[1] : out[0];
    const n = left.length;
    const step = 1 / sampleRate;
    const gain = this.gain;
    const duckFall = Math.exp(-1 / (0.14 * sampleRate));
    const ducking = this.ducking;
    const air = this.air;
    this.wind(n);

    for (let i = 0; i < n; i++) {
      const now = currentTime + i * step;
      air.time = now;
      while (this.next < this.pending.length && this.pending[this.next].when <= now) {
        this.start(this.pending[this.next++]);
      }
      const voices = this.voices;
      const drums = this.drums;
      let l = 0, r = 0;
      // Every note ducks under the kick and swells back, the pumping of a
      // sidechained compressor.
      const pump = 1 - ducking * this.duck;
      this.duck *= duckFall;
      for (let k = 0; k < voices.length; k++) {
        const v = voices[k];
        if (v.dead) continue;
        const x = v.sample() * pump;
        l += x * v.gainL;
        r += x * v.gainR;
      }
      for (let k = 0; k < drums.length; k++) {
        const d = drums[k];
        if (d.dead) continue;
        const x = d.sample();
        l += x * d.gainL;
        r += x * d.gainR;
      }
      const io = this.io;
      io[0] = hold(l * gain);
      io[1] = hold(r * gain);
      this.room.run(io);
      left[i] = io[0];
      right[i] = io[1];
    }

    if (this.next > 64) {
      this.pending.splice(0, this.next);
      this.next = 0;
    }
    if (this.voices.length) this.voices = this.voices.filter(v => !v.dead);
    if (this.drums.length) this.drums = this.drums.filter(d => !d.dead);
    this.idle = this.voices.length || this.drums.length ? 0 : this.idle + n;
    return true;
  }
}

registerProcessor('synth', SynthProcessor);
