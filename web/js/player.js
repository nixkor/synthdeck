// The player: it takes a playlist of songs, each a list of timed notes with
// the sounds and kit to play them on, and queues the notes, a little ahead
// of time, for the synth in js/synth-processor.js, an audio worklet. It knows
// nothing of where the songs come from.

const LOOKAHEAD = 0.6;     // seconds of notes queued at a time
const INTERVAL = 100;      // milliseconds between scheduling passes
// In shuffle and repeat all, the next tune starts this many seconds before the
// last one ends, the one fading in as the other fades out.
const CROSSFADE = 1.5;
const LEVEL = 0.34;        // a note's level, with the room on top

const DRUMS = 9;           // the channel the drums are on, as in General MIDI

export class Player {
  // `playlist.names` the songs in playing order, and `playlist.song(name)`
  // one of them, as js/compose.js makes it: { notes, length, gap, patches,
  // pans, kit, room, ducking, level, tuning, marks }.
  constructor(playlist) {
    this.playlist = playlist;
    this.ctx = null;
    this.ready = null;       // the audio graph being made, once asked for
    this.decks = null;       // two synths, so one tune can fade into the next
    this.deck = 0;           // the one playing
    this.current = null;     // { name, song, index, start, deck }
    this.outgoing = null;    // a tune still fading out
    this.timer = null;
    this.paused = true;
    this.mode = 'all';       // 'one', 'all' or 'shuffle': what follows a tune
    this.level = 0.8;
    this.history = [];       // tunes played before this one, for Previous in shuffle
    this.equal = false;      // true to play every tune in equal temperament
    this.onChange = null;    // hears of a new tune, or of play and pause
  }

  // The audio graph, made on the first press, since browsers only start
  // sound from one: the two decks, a level, a limiter that only catches
  // peaks, and an analyser for the meter. Every caller waits on the same
  // making of it, so a second press while the synth is still loading finds
  // the decks there.
  init() {
    if (!this.ready) this.ready = this.build();
    return this.ready;
  }

  async build() {
    // On an iPhone, this is music: play through the silent switch, as a
    // music app does, rather than muting with the ringer. Set before the
    // context is made.
    if (navigator.audioSession) {
      try { navigator.audioSession.type = 'playback'; } catch { /* not settable */ }
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new Ctx();
    const ctx = this.ctx;
    this.out = ctx.createGain();
    this.out.gain.value = this.level * this.level;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -2;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.001;
    limiter.release.value = 0.06;
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.75;
    this.out.connect(limiter);
    limiter.connect(this.analyser);
    this.analyser.connect(ctx.destination);
    await ctx.audioWorklet.addModule('js/synth-processor.js');
    this.decks = [0, 1].map(() => {
      const synth = new AudioWorkletNode(ctx, 'synth', {
        outputChannelCount: [2],
        processorOptions: { gain: 0.8 },
      });
      const gain = ctx.createGain();
      synth.connect(gain);
      gain.connect(this.out);
      return { synth, gain };
    });
  }

  get name() { return this.current ? this.current.name : null; }

  // How far into the tune playing, in seconds, and how long it is.
  get position() {
    const cur = this.current;
    if (!cur || !this.ctx) return 0;
    return Math.max(0, Math.min(cur.song.length, this.ctx.currentTime - cur.start));
  }

  get duration() {
    return this.current ? this.current.song.length : 0;
  }

  // The part of the tune playing: the last of its marks already passed.
  get section() {
    const cur = this.current;
    if (!cur) return null;
    const at = this.position;
    let mark = null;
    for (const m of cur.song.marks) if (m.at <= at + 0.05) mark = m;
    return mark;
  }

  setLevel(level) {
    this.level = level;
    if (this.out) this.out.gain.setTargetAtTime(level * level, this.ctx.currentTime, 0.02);
  }

  // Pausing suspends the whole context, so the clock the notes are queued
  // against stops with it and picks up exactly where it was.
  async play() {
    await this.init();
    if (!this.current) this.load(this.playlist.names[0]);
    await this.ctx.resume();
    this.paused = false;
    if (!this.timer) this.timer = setInterval(() => this.pump(), INTERVAL);
    this.pump();
    this.changed();
  }

  async pause() {
    if (!this.ctx) return;
    await this.ctx.suspend();
    this.paused = true;
    this.changed();
  }

  toggle() {
    return this.paused ? this.play() : this.pause();
  }

  // `name` from `at` seconds in, cutting off whatever was playing.
  load(name, at = 0) {
    this.silence();
    const song = this.playlist.song(name);
    const now = this.ctx.currentTime;
    const index = song.notes.findIndex(n => n[0] >= at);
    const deck = this.decks[this.deck];
    room(deck, song);
    this.current = {
      name, song, deck,
      index: index < 0 ? song.notes.length : index,
      start: now + 0.05 - at,
    };
    this.changed();
  }

  // Every deck stopped dead and put back at full, a fade under way or not.
  silence() {
    const now = this.ctx.currentTime;
    for (const d of this.decks) {
      d.synth.port.postMessage({ type: 'silence' });
      d.gain.gain.cancelScheduledValues(now);
      d.gain.gain.setValueAtTime(1, now);
    }
    this.outgoing = null;
  }

  async select(name) {
    await this.init();
    if (this.current && this.current.name !== name) this.history.push(this.current.name);
    this.load(name);
    if (this.paused) await this.play();
  }

  seek(seconds) {
    if (!this.current) return;
    this.load(this.current.name, Math.max(0, Math.min(seconds, this.duration - 0.1)));
    this.pump();
  }

  // The tune to go to after `name`: in shuffle, any other at random;
  // otherwise the next in the list and round again.
  following(name) {
    if (this.mode === 'shuffle') {
      const others = this.playlist.names.filter(n => n !== name);
      return others[(Math.random() * others.length) | 0];
    }
    const names = this.playlist.names;
    return names[(names.indexOf(name) + 1) % names.length];
  }

  next() {
    const name = this.following(this.name);
    return this.select(name);
  }

  // Back to the start of the tune, or, near its start already, to the one
  // before: the last played in shuffle, otherwise the one above in the list.
  async previous() {
    if (this.position > 3 || !this.current) return this.seek(0);
    let name = this.history.pop();
    if (!name || this.mode !== 'shuffle') {
      const names = this.playlist.names;
      const i = names.indexOf(this.name);
      name = names[(i + names.length - 1) % names.length];
    }
    this.load(name);
    if (this.paused) await this.play();
  }

  // On to the next tune at the end of one: it starts on the other deck,
  // rising from silence over CROSSFADE seconds while the one playing falls
  // away, whatever of it is already queued playing out.
  crossfade() {
    const old = this.current;
    const name = this.following(old.name);
    this.history.push(old.name);
    const now = this.ctx.currentTime;
    this.deck = 1 - this.deck;
    const deck = this.decks[this.deck];
    deck.synth.port.postMessage({ type: 'silence' });
    const song = this.playlist.song(name);
    room(deck, song);
    const fade = (g, from, to) => {
      g.gain.cancelScheduledValues(now);
      g.gain.setValueAtTime(from, now);
      g.gain.linearRampToValueAtTime(to, now + CROSSFADE);
    };
    fade(old.deck.gain, old.deck.gain.gain.value, 0);
    fade(deck.gain, 0, 1);
    this.outgoing = { ...old, until: now + CROSSFADE };
    this.current = { name, song, index: 0, start: now + 0.05, deck };
    this.changed();
  }

  pump() {
    const cur = this.current;
    if (!cur || this.paused) return;
    const now = this.ctx.currentTime;
    const out = this.outgoing;
    if (out) {
      this.queue(out, Math.min(now + LOOKAHEAD, out.until));
      if (now > out.until) this.outgoing = null;
    }
    this.queue(cur, now + LOOKAHEAD);
    if (cur.index >= cur.song.notes.length) {
      const endsAt = cur.start + cur.song.length;
      if (this.mode !== 'one') {
        if (now > endsAt - CROSSFADE) this.crossfade();
      } else if (now > endsAt - LOOKAHEAD) {
        cur.start = endsAt + (cur.song.gap ?? 0.4);
        cur.index = 0;
      }
    }
  }

  // Queues `cur`'s notes due before `until`.
  queue(cur, until) {
    const notes = cur.song.notes;
    while (cur.index < notes.length && cur.start + notes[cur.index][0] < until) {
      const note = notes[cur.index++];
      this.voice(cur, cur.start + note[0], note);
    }
  }

  voice(cur, when, note) {
    if (when < this.ctx.currentTime - 0.05) return;
    const m = message(cur.song, note, when, this.equal);
    if (m) cur.deck.synth.port.postMessage(m);
  }

  changed() {
    if (this.onChange) this.onChange();
  }
}

// A deck's room, how hard its kick ducks the rest and how loud the song is
// overall, set for the song before any of its notes.
function room(deck, song) {
  deck.synth.port.postMessage({ type: 'room', room: song.room, ducking: song.ducking, level: song.level });
}

// Which of the kit's sounds a General MIDI drum note comes out as, and for
// the toms and congas, how far above or below the kit's tuning. The riser,
// which General MIDI has none of, sweeps for as long as the note is held.
const KIT = {
  35: 'kick', 36: 'kick', 37: 'rim', 38: 'snare', 39: 'clap', 40: 'snare', 42: 'hat', 44: 'hat',
  46: 'open', 49: 'crash', 57: 'crash', 51: 'ride', 59: 'ride', 54: 'tambourine', 56: 'cowbell',
  41: 'tom', 43: 'tom', 45: 'tom', 47: 'tom', 48: 'tom', 50: 'tom', 62: 'conga', 63: 'conga',
  64: 'conga', 70: 'maracas', 75: 'clave', 82: 'shaker', 92: 'riser',
};
const PITCH = { 41: 0.7, 43: 0.8, 45: 0.9, 47: 1.05, 48: 1.2, 50: 1.4, 62: 1.25, 63: 1.1, 64: 0.75 };

// A note's pitch in hertz, in the song's tuning: cents off equal
// temperament for each note of the octave, or none for equal.
function hz(note, tuning) {
  return 440 * 2 ** ((note - 69 + (tuning ? tuning[note % 12] / 100 : 0)) / 12);
}

function pans(pan) {
  return { gainL: Math.cos(pan * Math.PI / 2), gainR: Math.sin(pan * Math.PI / 2) };
}

// What the synth is told for one of a song's notes, [time, channel, note,
// velocity, duration, glideFrom], due `when`: its pitch, sound, level and
// place, or null for a part with no sound. `equal` plays it in equal
// temperament whatever the song is tuned to.
export function message(song, note, when, equal = false) {
  const [, ch, n, vel, dur, from] = note;
  const level = Math.min(1, (vel / 127) ** 1.4);
  if (ch === DRUMS) {
    const kit = KIT[n] || 'hat';
    return {
      type: 'note', when, kit, pitch: PITCH[n] || 1, length: dur, level, tone: song.kit,
      ...pans(song.kit.pan?.[kit] ?? 0.5),
    };
  }
  const patch = song.patches[ch];
  if (!patch) return null;
  const tuning = equal ? null : song.tuning;
  return {
    type: 'note', when, patch, level: level * LEVEL,
    f: hz(n, tuning), from: from == null ? 0 : hz(from, tuning),
    held: Math.max(0.06, Math.min(dur, 16)),
    ...pans(song.pans[ch] ?? 0.5),
  };
}
