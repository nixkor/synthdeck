// Six tunes, as data and nothing else: each one's chords, melodies and song
// form, its parts and the sounds they play, the patterns it plays them in,
// its drum kit and room, and what the track list says about it. js/compose.js
// works a tune out into notes, and says what each field means.
//
// The sounds, in the synth's terms (js/synth-processor.js has them all):
//   the analog synth - `wave` the oscillator, `voices` how many of it spread
//     over `detune` cents, `sub` a square an octave down, the filter's
//     `cutoff`, `res` and envelope (`env` hertz on top, with fa, fd, fs),
//     `drop` a fall in pitch from that many semitones up, `drive`, `glide`;
//   `pipes` - an organ registration, a list of [tone, length in feet,
//     level, cents], with `trem` for a tremulant;
//   `fm` - a carrier and the modulators pushing it about;
//   `pluck` - a plucked string: `bright`, `decay`, `pick`, `courses`;
//   `drum` - one of the drum machine's tuned voices, played as notes;
// and a, d, s and r the level's attack, decay, sustain and release, `gain`
// how loud the sound is against the others, `duck` how far it ducks the rest.
//
// Melodies are "note/length" words, lengths in sixteenths, "r" for a rest;
// notes joined with + sound together, ! accents one and _ plays it softly.
// Chords are a bar to a word, "Eb|F" sharing a bar between two.

export const TUNES = {
  // The pipe organ. A festive voluntary in D, tuned as an eighteenth-century
  // builder might have left it.
  voluntary: {
    key: 'D major · Vallotti temperament',
    about: "A festive voluntary on a pipe organ: plenum, trumpet tune, echoes from the Swell, a céleste with tremulant, then a toccata over the pedal reeds. Tuned in Vallotti's well temperament; every pipe speaks, chiffs and drifts a cent or so on its own, and the wind sags under a full chord.",
    bpm: 104,
    level: 2,
    tuning: 'vallotti',
    tail: 4.5,
    ducking: 0,
    room: { size: 2.9, decay: 0.9, damp: 0.38, input: 0.02, send: 0.85, echo: 0, spread: 520, cut: 180 },
    sounds: {
      great: { pipes: [['principal', 8], ['principal', 4], ['principal', 2], ['mixture', 4]], gain: 0.3 },
      tutti: { pipes: [['principal', 8], ['principal', 4], ['principal', 2], ['mixture', 4], ['trumpet', 8, 0.9]], gain: 0.27 },
      trumpet: { pipes: [['trumpet', 8]], gain: 0.55 },
      flutes: { pipes: [['gedackt', 8], ['flute', 4, 0.7]], gain: 0.4 },
      oboe: { pipes: [['oboe', 8], ['gedackt', 8, 0.4]], gain: 0.42 },
      celeste: { pipes: [['viole', 8], ['viole', 8, 1, 6]], trem: 0.12, gain: 0.33 },
      solo: { pipes: [['flute', 4], ['gedackt', 8, 0.5]], trem: 0.12, gain: 0.5 },
      pedal: { pipes: [['gedackt', 16], ['principal', 8, 0.8]], gain: 0.7 },
      pedalSoft: { pipes: [['gedackt', 16], ['flute', 8, 0.5]], gain: 0.6 },
      pedalFull: { pipes: [['gedackt', 16], ['principal', 8], ['principal', 4, 0.6], ['trombone', 16]], gain: 0.5 },
    },
    // The divisions sit where they would in the case: the Great in the
    // middle, the Choir to the left, the Swell to the right, the Pedal
    // towers either side.
    parts: {
      rh: { role: 'melody', sound: 'trumpet', pan: 0.52 },
      echo: { role: 'melody', sound: 'oboe', pan: 0.7 },
      lh: { role: 'comp', sound: 'flutes', pattern: 'quarters', pan: 0.36, loose: 0.003 },
      held: { role: 'pad', sound: 'celeste', pan: 0.66 },
      figure: { role: 'arp', sound: 'great', pattern: 'toccata', octave: 1, pan: 0.5 },
      pedal: { role: 'bass', sound: 'pedal', pattern: 'walk', pan: 0.5 },
      pedalTune: { role: 'melody', sound: 'pedalFull', pan: 0.5 },
    },
    patterns: {
      bass: {
        walk: [[0, 0, 4, 100], [4, 1, 4, 85], [8, 0, 4, 95, 7], [12, 1, 4, 85]],
        halves: [[0, 0, 8, 95], [8, 0, 8, 85, 7]],
      },
      arp: { toccata: [0, 3, 1, 3, 2, 3, 1, 3] },
      comp: { halves: [[0, 7, 100], [8, 7, 90]] },
    },
    chords: {
      A: ['D', 'D', 'G', 'A', 'Bm', 'G', 'D/A|A', 'D'],
      B: ['Bm', 'F#m', 'G', 'D', 'Em', 'A', 'D|A', 'D'],
      echo: ['D', 'A', 'D', 'A', 'G', 'A', 'G', 'A'],
      soft: ['G', 'Em', 'C', 'D', 'G', 'Em', 'Am|D', 'G'],
      amen: ['D', 'D'],
    },
    melodies: {
      theme: `a4/4 d5/4 f#5/4 a5/4  a5/6 g5/2 f#5/4 e5/4  d5/4 g5/4 b5/6 a5/2  g5/4 f#5/4 e5/8
              f#5/4 b5/4 a5/4 g5/4  f#5/4 e5/4 d5/4 g5/4  f#5/4 g5/2 f#5/2 e5/1 f#5/1 e5/1 f#5/1 e5/4  d5/12 r/4`,
      second: `b5/4 a5/2 g5/2 f#5/4 d5/4  c#5/4 f#5/4 a5/6 f#5/2  g5/4 b5/4 d6/4 b5/4  a5/8 f#5/8
               g5/4 e5/4 b5/6 g5/2  a5/4 c#6/4 e6/4 c#6/4  d6/4 b5/2 a5/2 g5/2 f#5/2 e5/4  d5/4 a4/4 d5/8`,
      call: `f#5/2 g5/2 a5/4 d6/4 a5/4  g5/2 f#5/2 e5/4 c#5/4 a4/4  r/32
             b5/2 a5/2 g5/4 d5/4 g5/4  a5/2 g5/2 f#5/4 e5/4 c#5/4  r/32`,
      answer: `r/32  f#5/2 g5/2 a5/4 d6/4 a5/4  g5/2 f#5/2 e5/4 c#5/4 a4/4
               r/32  b5/2 a5/2 g5/4 d5/4 g5/4  a5/2 g5/2 f#5/4 e5/4 c#5/4`,
      soft: `d5/6 b4/2 g4/4 b4/4  e5/6 d5/2 b4/8  c5/4 e5/4 g5/6 e5/2  f#5/4 e5/4 d5/8
             d5/4 g5/4 b5/6 a5/2  g5/4 e5/4 b4/8  c5/4 e5/4 d5/4 f#5/2 a5/2  g5/12 r/4`,
      pedalTheme: `a4/4 d5/4 f#5/4 a5/4  a5/8 f#5/4 e5/4  d5/4 g5/4 b5/8  a5/8 e5/8
                   f#5/4 b5/4 a5/4 g5/4  f#5/4 e5/4 d5/4 g5/4  a5/8 a4/8  d5/16`,
      amen: `d5+f#5+a5+d6/32`,
    },
    form: ['plenum', 'tune', 'second', 'echo', 'soft', 'toccata', 'finale', 'amen'],
    sections: {
      plenum: {
        chords: 'A', label: "Great: Principal 8', Octave 4', Fifteenth 2', Mixture IV · Pedal: Bourdon 16', Octave 8'",
        play: { rh: { melody: 'theme', sound: 'great' }, lh: { sound: 'great', level: 0.85 }, pedal: true },
      },
      tune: {
        chords: 'A', label: "Trumpet 8' on the Great · Choir: Gedackt 8', Flute 4' · Pedal: Bourdon 16', Octave 8'",
        play: { rh: 'theme', lh: true, pedal: true },
      },
      second: {
        chords: 'B', label: "Trumpet 8' on the Great · Choir: Gedackt 8', Flute 4' · Pedal: Bourdon 16', Octave 8'",
        play: { rh: 'second', lh: true, pedal: true },
      },
      echo: {
        chords: 'echo', label: "Echoes: the Trumpet answered by the Swell Oboe 8'",
        play: { rh: 'call', echo: 'answer', lh: 0.85, pedal: { pattern: 'halves', sound: 'pedalSoft' } },
      },
      soft: {
        chords: 'soft', label: "Swell: Viole de gambe 8', Voix céleste 8', tremulant · Choir: Flute 4'",
        play: { rh: { melody: 'soft', sound: 'solo' }, held: true, pedal: { pattern: 'halves', sound: 'pedalSoft', level: 0.85 } },
      },
      toccata: {
        chords: 'A', label: "Toccata: Great plenum and Trumpet · Pedal: Bourdon 16', Octave 8', 4', Trombone 16'",
        play: { figure: { level: 2.2, sound: 'tutti' }, lh: { pattern: 'halves', sound: 'great', level: 0.8 }, pedalTune: { melody: 'pedalTheme', shift: -24, level: 1.3 } },
      },
      finale: {
        chords: 'A', label: 'Full organ, the Trumpet drawn into the plenum',
        play: { rh: { melody: 'theme', sound: 'tutti' }, lh: { sound: 'great' }, pedal: { sound: 'pedalFull' } },
      },
      amen: {
        chords: 'amen', label: 'Full organ',
        play: { rh: { melody: 'amen', sound: 'tutti' }, held: { sound: 'great' }, pedal: { pattern: 'roots', sound: 'pedalFull' } },
      },
    },
  },

  // Nothing but an 808: its bass drum, tuned and sliding, is the bass; its
  // toms, congas and cowbell, pitched, play the tunes.
  boombox: {
    key: 'C minor',
    about: "Miami bass from a drum machine and nothing else: the 808's long bass drum, tuned and sliding, plays the bass line; its toms, congas and cowbell are pitched to carry the tunes, over claps, metallic hats and triplet rolls.",
    bpm: 126,
    level: 1.4,
    tail: 1.5,
    ducking: 0.3,
    room: { size: 1.2, decay: 0.78, damp: 0.3, send: 0.35, echo: 0.75, echoSend: 0.1, echoFeedback: 0.3 },
    kit: {
      metal: true,
      kick: { f: 48, decay: 0.3, drop: 2.4, click: 0.4, gain: 0.8 },
      snare: { f: 238, decay: 0.15, snappy: 0.7, body: 0.45, tone: 1800, gain: 0.7 },
      clap: { decay: 0.16, gain: 0.9 },
      hat: { decay: 0.04, gain: 0.55 },
      open: { decay: 0.3, gain: 0.5 },
      crash: { decay: 1.4, gain: 0.5 },
      rim: { gain: 0.6 },
      clave: { gain: 0.5 },
      maracas: { gain: 0.6 },
      pan: { hat: 0.62, open: 0.62, maracas: 0.7, rim: 0.36, clave: 0.66, crash: 0.45 },
    },
    sounds: {
      boom: { wave: 'sine', voices: 1, cutoff: 6000, env: 0, res: 0.7, a: 0.001, d: 1.4, s: 0, r: 0.1, drop: 14, dropTime: 0.025, drive: 1.9, glide: 0.07, duck: 0.6, gain: 1.15 },
      toms: { drum: 'tom', decay: 0.32, drop: 0.25, dropTime: 0.03, gain: 0.85 },
      congas: { drum: 'conga', decay: 0.16, drop: 0.12, gain: 0.75 },
      bell: { drum: 'cowbell', decay: 0.12, gain: 0.32 },
    },
    parts: {
      boom: { role: 'melody', sound: 'boom', pan: 0.5 },
      toms: { role: 'melody', sound: 'toms', pan: 0.44 },
      congas: { role: 'melody', sound: 'congas', pan: 0.34 },
      bell: { role: 'melody', sound: 'bell', pan: 0.6 },
    },
    patterns: {
      drums: {
        intro: { clap: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', maracas: 'oxoxoxoxoxoxoxox' },
        groove: {
          clap: '....x.......x...', snare: '....x.......x...', hat: 'xx.xxx.xxx.xxx.x', open: '..x...x...x...x.',
          rim: '......x.......x.', maracas: 'o.o.o.o.o.o.o.o.',
        },
        // Hats in sixteenth triplets on the last two beats, the snare in
        // thirty-seconds on the last.
        roll: {
          clap: '....x.......X...', hat: 'x.x.x.x.x.x.xxxxxxxxxxxx', snare: '........................oxoxXxXx',
        },
        break: { clap: '....x.......x...', clave: '..x..x....x..x..', rim: 'x..x..x...x..x..' },
        // The bass drum machine-gunning into the drop.
        stutter: { kick: '................x.x.x.x.xxxxxxXX', clap: '....x.......X...' },
        out: { crash: 'x...............', kick: 'X...............' },
      },
    },
    chords: {
      four: ['Cm', 'Cm', 'Cm', 'Cm'],
      eight: ['Cm', 'Cm', 'Cm', 'Cm', 'Cm', 'Cm', 'Cm', 'Cm'],
      two: ['Cm', 'Cm'],
    },
    melodies: {
      boom: `c2/3 c2/3 c2/2 r/2 eb2/2 c2/2 g1/2  bb1/3 bb1/3 c2/4 f2/2 eb2/2 c2/2`,
      bell: `c5/2 r/1 c5/1 r/2 eb5/2 r/2 c5/2 g4/2 bb4/2  c5/2 r/2 g4/2 r/2 bb4/2 c5/2 eb5/2 f5/2`,
      toms: `c3/2 c3/2 eb3/2 r/2 f3/2 g3/2 r/2 bb3/2  c4/4 bb3/2 g3/2 f3/4 eb3/4
             c3/2 c3/2 eb3/2 r/2 f3/2 g3/2 r/2 bb3/2  g3/4 f3/2 eb3/2 c3/8
             eb3/2 eb3/2 g3/2 r/2 bb3/2 c4/2 r/2 eb4/2  d4/4 c4/2 bb3/2 g3/4 f3/4
             g3/2 g3/2 bb3/2 g3/2 f3/2 eb3/2 f3/2 g3/2  c3/16`,
      congaRiff: `c4/2 c4/1 g4/1 r/2 g4/2 c4/2 r/2 bb3/2 c4/2`,
      congas: `g4/2 g4/2 bb4/2 g4/2 f4/2 eb4/2 c4/4  eb4/2 f4/2 g4/4 bb4/4 g4/4
               g4/2 g4/2 bb4/2 c5/2 bb4/2 g4/2 f4/4  eb4/4 c4/4 eb4/8
               c5/2 c5/2 bb4/2 g4/2 bb4/2 g4/2 f4/4  g4/2 f4/2 eb4/4 c4/8
               eb4/2 f4/2 g4/2 bb4/2 c5/4 bb4/2 g4/2  c5/16`,
      end: `c2/16 r/16`,
    },
    form: ['intro', 'drop', 'toms', 'break', 'congas', 'finale', 'out'],
    sections: {
      intro: {
        chords: 'four', label: 'Claps, metal hats, maracas and the cowbell',
        drums: 'intro', fill: 'stutter',
        play: { bell: { melody: 'bell', loop: true, level: 0.8 } },
      },
      drop: {
        chords: 'eight', label: 'The bass drum as the bass, tuned and sliding',
        drums: 'groove', crash: true, fill: 'roll',
        play: { boom: { melody: 'boom', loop: true }, bell: { melody: 'bell', loop: true, level: 0.7 } },
      },
      toms: {
        chords: 'eight', label: 'Toms, pitched to play the tune',
        drums: 'groove', crash: true, fill: 'roll',
        play: { boom: { melody: 'boom', loop: true }, toms: 'toms' },
      },
      break: {
        chords: 'four', label: 'Break: congas, clave and claps',
        drums: 'break', fill: 'stutter',
        play: { boom: { melody: 'boom', loop: true, level: 0.85 }, congas: { melody: 'congaRiff', loop: true } },
      },
      congas: {
        chords: 'eight', label: 'Congas take the tune',
        drums: 'groove', crash: true, fill: 'roll',
        play: { boom: { melody: 'boom', loop: true }, congas: 'congas', bell: { melody: 'bell', loop: true, level: 0.6 } },
      },
      finale: {
        chords: 'eight', label: 'Toms, congas and cowbell all at once',
        drums: 'groove', crash: true, fill: 'roll',
        play: {
          boom: { melody: 'boom', loop: true }, toms: 'toms',
          congas: { melody: 'congaRiff', loop: true, level: 0.8 }, bell: { melody: 'bell', loop: true, level: 0.6 },
        },
      },
      out: { chords: 'two', drums: 'out', play: { boom: 'end' } },
    },
  },

  // Bluegrass, all plucked strings: banjo, guitar, mandolin, dobro, bass.
  hoedown: {
    key: 'G major',
    about: 'Bluegrass on plucked strings, each one a burst of noise ringing round a delay line: banjo rolls with the high fifth-string drone, boom-chuck guitar and upright bass, mandolin tremolo and chop, and a dobro that slides into its notes. It ends on a G run.',
    bpm: 132,
    level: 1.08,
    tail: 2.5,
    ducking: 0,
    room: { size: 0.9, decay: 0.7, damp: 0.45, send: 0.4, echo: 0 },
    sounds: {
      banjo: { pluck: { bright: 0.95, decay: 1.0, pick: 0.07 }, r: 0.3, gain: 0.75 },
      guitar: { pluck: { bright: 0.5, decay: 2.2, pick: 0.2 }, r: 0.15, gain: 0.34 },
      mandolin: { pluck: { bright: 0.85, decay: 0.9, pick: 0.12, courses: 2, spread: 5 }, r: 0.08, gain: 0.64 },
      chop: { pluck: { bright: 0.7, decay: 0.1, pick: 0.15, courses: 2, spread: 5 }, r: 0.03, gain: 0.5 },
      bass: { pluck: { bright: 0.2, decay: 1.2, pick: 0.25 }, r: 0.1, gain: 0.6 },
      dobro: { pluck: { bright: 0.75, decay: 2.6, pick: 0.15 }, glide: 0.07, r: 0.2, gain: 0.65 },
    },
    parts: {
      banjo: { role: 'arp', sound: 'banjo', pattern: 'forward', octave: 0, drone: 67, hold: 2, pan: 0.64, loose: 0.004 },
      guitar: { role: 'comp', sound: 'guitar', pattern: 'chuck', voicing: 3, strum: 0.012, pan: 0.36, loose: 0.004 },
      chop: { role: 'comp', sound: 'chop', pattern: 'chop', octave: 1, pan: 0.44, loose: 0.003 },
      bass: { role: 'bass', sound: 'bass', pattern: 'twoBeat', pan: 0.5 },
      mando: { role: 'melody', sound: 'mandolin', tremolo: 0.667, pan: 0.44, loose: 0.003 },
      dobro: { role: 'melody', sound: 'dobro', pan: 0.58 },
      run: { role: 'melody', sound: 'guitar', strum: 0.018, pan: 0.36 },
    },
    patterns: {
      bass: { twoBeat: [[0, 0, 4, 110], [8, 0, 4, 100, 7]] },
      // Thumb, index and middle round the strings, the middle often on the
      // drone.
      arp: {
        forward: [0, 1, 4, 0, 1, 4, 0, 4],
        alternating: [0, 1, 0, 3, 0, 2, 0, 4, 1, 4, 0, 3, 1, 2, 0, 4],
      },
      comp: {
        chuck: [[4, 2, 95], [12, 2, 95], [14, 1, 60, -1]],
        chop: [[4, 1, 100], [12, 1, 100]],
      },
    },
    chords: {
      intro: ['G', 'G', 'D', 'G'],
      A: ['G', 'G', 'C', 'G', 'G', 'G', 'D', 'G'],
      B: ['C', 'G', 'D', 'G', 'C', 'G', 'D', 'G'],
      tag: ['G', 'G'],
    },
    melodies: {
      mando: `d5/4 a#4/1 b4/3 g4/4 b4/4  d5/2 e5/2 d5/4 b4/8  c5/4 e5/4 g5/4 e5/4  d5/12 b4/4
              g4/2 a4/2 b4/4 d5/4 g5/4  f#5/2 g5/2 e5/4 d5/8  a4/4 c5/4 f#5/4 a5/4  g5/12 r/4`,
      dobro: `e5/6 g5/2 c6/8  b5/4 a5/2 g5/2 d5/8  f#5/4 a5/4 d6/6 c6/2  b5/12 r/4
              e5/2 g5/2 e5/4 c5/4 e5/4  d5/4 b4/4 g4/4 b4/4  a4/2 b4/2 c5/4 d5/4 f#5/4  g5/8 d5/4 g4/4`,
      run: `d4/2 e4/2 g4/2 a#4/1 b4/1 d5/4 g4/4  g3+d4+g4+b4+d5+g5/16`,
    },
    form: ['intro', 'A', 'B', 'break', 'B2', 'A2', 'tag'],
    sections: {
      intro: { chords: 'intro', label: 'Banjo, rolling over its high drone string', play: { banjo: 1 } },
      A: {
        chords: 'A', label: 'Mandolin tremolo takes the tune',
        play: { mando: 'mando', banjo: 0.6, guitar: true, bass: true },
      },
      B: {
        chords: 'B', label: 'Dobro, sliding into its notes',
        play: { dobro: 'dobro', banjo: 0.55, guitar: true, chop: true, bass: true },
      },
      break: {
        chords: 'A', label: 'Banjo break',
        play: { banjo: { pattern: 'alternating', level: 1.15 }, guitar: true, chop: true, bass: true },
      },
      B2: {
        chords: 'B', label: 'Dobro and mandolin together',
        play: { dobro: 'dobro', mando: { melody: 'dobro', shift: -12, level: 0.75 }, banjo: 0.5, guitar: true, bass: true },
      },
      A2: {
        chords: 'A', label: 'Everyone',
        play: { mando: 'mando', banjo: 0.7, guitar: true, chop: 0.8, bass: true },
      },
      tag: { chords: 'tag', label: 'A G run to finish', play: { run: 'run', bass: { pattern: 'roots' } } },
    },
  },

  // Carnival: steel pans, marimba and congas.
  carnival: {
    key: 'F major',
    about: 'Soca for a carnival road march: a lead steel pan over strummed double-second pans, a marimba, a round FM bass and brass hits, with congas, shaker and a four-on-the-floor kick.',
    bpm: 122,
    level: 1.1,
    tail: 2,
    ducking: 0.22,
    room: { size: 1.3, decay: 0.8, damp: 0.25, send: 0.42, echo: 0.75, echoSend: 0.1, echoFeedback: 0.28 },
    kit: {
      metal: false,
      kick: { f: 56, decay: 0.24, drop: 1.6, click: 0.5, gain: 0.7 },
      snare: { f: 210, decay: 0.11, snappy: 0.7, body: 0.5, tone: 2600, gain: 0.5 },
      open: { decay: 0.12, gain: 0.32 },
      shaker: { gain: 0.42 },
      conga: { f: 250, decay: 0.15, gain: 0.56 },
      crash: { decay: 1.2, gain: 0.32 },
      rim: { gain: 0.35 },
      pan: { open: 0.6, shaker: 0.72, conga: 0.32, rim: 0.4, crash: 0.55 },
    },
    sounds: {
      pan: { fm: { mods: [{ ratio: 2, index: 1.3, decay: 0.25, sustain: 0.1 }, { ratio: 3, index: 0.4, decay: 0.08 }] }, a: 0.002, d: 1.4, s: 0, r: 0.25, gain: 0.8 },
      seconds: { fm: { mods: [{ ratio: 2, index: 1.0, decay: 0.2, sustain: 0.1 }] }, a: 0.002, d: 0.7, s: 0, r: 0.12, gain: 0.42 },
      marimba: { fm: { mods: [{ ratio: 4, index: 1.0, decay: 0.02 }, { ratio: 10, index: 0.4, decay: 0.006 }] }, a: 0.001, d: 0.45, s: 0, r: 0.1, gain: 0.6 },
      bass: { fm: { mods: [{ ratio: 1, index: 2.2, decay: 0.12, sustain: 0.25 }] }, a: 0.002, d: 0.5, s: 0.5, r: 0.06, gain: 1.1 },
      horns: { wave: 'saw', voices: 3, detune: 10, cutoff: 900, env: 2800, res: 0.9, fa: 0.03, fd: 0.18, fs: 0.4, a: 0.02, d: 0.2, s: 0.7, r: 0.12, gain: 0.45 },
    },
    parts: {
      pan: { role: 'melody', sound: 'pan', pan: 0.55, loose: 0.003 },
      seconds: { role: 'comp', sound: 'seconds', pattern: 'offbeats', octave: 1, strum: 0.008, pan: 0.38, loose: 0.004 },
      marimba: { role: 'arp', sound: 'marimba', pattern: 'skip', octave: 0, pan: 0.68, loose: 0.003 },
      bass: { role: 'bass', sound: 'bass', pattern: 'soca', pan: 0.5 },
      horns: { role: 'comp', sound: 'horns', pattern: 'hits', octave: 1, pan: 0.5 },
    },
    patterns: {
      bass: { soca: [[0, 0, 3, 110], [3, 0, 1, 90], [4, 1, 2, 100], [8, 0, 3, 105], [11, 0, 1, 90], [12, 1, 2, 100], [14, 0, 2, 95, 7]] },
      arp: { skip: [0, 2, 1, 3, 2, 0, 3, 1] },
      comp: { hits: [[0, 1.5, 110], [3, 1.5, 95], [6, 3, 105]] },
      drums: {
        intro: { congaHi: '.......x..x...x.', congaLo: 'x.....x.........', congaMid: '...x........x...', shaker: 'xoxoxoxoxoxoxoxo', rim: '...x..x.........' },
        soca: {
          kick: 'x...x...x...x...', snare: '....x.......x...', open: '..x...x...x...x.', shaker: 'xoxoxoxoxoxoxoxo',
          congaHi: '.......x..x...x.', congaLo: 'x.....x.........', congaMid: '...x........x...',
        },
        perc: { congaHi: '..x.x..x..x.xx.x', congaLo: 'x.....x...x.....', congaMid: '...x....x.....x.', shaker: 'xoxoxoxoxoxoxoxo', rim: '...x..x...x.....' },
      },
    },
    chords: {
      intro: ['F', 'Bb', 'C7', 'F'],
      A: ['F', 'Bb', 'C7', 'F', 'F', 'Bb', 'C7', 'F'],
      B: ['Dm', 'Bb', 'F', 'C', 'Dm', 'Bb', 'G7', 'C7'],
      break: ['Dm', 'Bb', 'C', 'C'],
    },
    melodies: {
      A: `c6/3 a5/3 c6/2 r/2 a5/2 c6/4  d6/3 bb5/3 f5/2 r/2 g5/2 a5/2 bb5/2  g5/3 e5/3 c5/2 r/2 e5/2 g5/2 bb5/2  a5/8 r/4 c6/4
          f6/3 e6/3 c6/2 r/2 a5/2 c6/4  d6/3 c6/3 bb5/2 r/2 a5/2 bb5/2 d6/2  c6/4 g5/2 e5/2 g5/2 bb5/2 e6/4  f6/8 r/8`,
      B: `a5/6 f5/2 d5/8  d5/2 f5/2 bb5/4 a5/2 g5/2 f5/4  a5/6 c6/2 f6/8  e6/4 d6/2 c6/2 g5/8
          a5/4 d6/4 f6/4 d6/4  bb5/4 d6/4 f6/6 d6/2  b5/4 d6/4 g6/4 f6/4  e6/4 c6/4 g5/4 e5/4`,
    },
    form: ['intro', 'A', 'B', 'break', 'A2', 'B2', 'A3'],
    sections: {
      intro: { chords: 'intro', label: 'Double-second pans, marimba and congas', drums: 'intro', play: { seconds: true, marimba: 0.8 } },
      A: {
        chords: 'A', label: 'The lead pan', drums: 'soca', crash: true,
        play: { pan: 'A', seconds: true, marimba: 0.55, bass: true },
      },
      B: {
        chords: 'B', label: 'Horns join in', drums: 'soca', crash: true,
        play: { pan: 'B', seconds: true, marimba: 0.55, bass: true, horns: 0.75 },
      },
      break: {
        chords: 'break', label: 'Percussion break', drums: 'perc', fill: true,
        play: { marimba: 1, bass: 0.8 },
      },
      A2: {
        chords: 'A', label: 'Lead pan, doubled an octave up', drums: 'soca', crash: true,
        play: { pan: { melody: 'A', double: 12 }, seconds: true, marimba: 0.55, bass: true, horns: 0.6 },
      },
      B2: {
        chords: 'B', label: 'Everybody jump', drums: 'soca', crash: true,
        play: { pan: { melody: 'B', double: -12 }, seconds: true, marimba: 0.6, bass: true, horns: 0.8 },
      },
      A3: {
        chords: 'A', label: 'Last time round', drums: 'soca', crash: true,
        play: { pan: { melody: 'A', double: 12 }, seconds: true, marimba: 0.6, bass: true, horns: 0.6 },
      },
    },
  },

  // Disco, with a key change for the last chorus.
  mirrorball: {
    key: 'A minor · up a tone at the end',
    about: 'Disco: a tremolo e-piano, an octave-jumping bass and chicken-scratch guitar under horn stabs, a string section with a run up into the chorus, a synth solo, and the last chorus a tone higher.',
    bpm: 120,
    swing: 0.06,
    tail: 2,
    ducking: 0.28,
    room: { size: 1.5, decay: 0.84, damp: 0.25, send: 0.5, echo: 0.75, echoSend: 0.08, echoFeedback: 0.3 },
    kit: {
      metal: false,
      kick: { f: 52, decay: 0.28, drop: 1.8, click: 0.6 },
      clap: { decay: 0.16, gain: 0.85 },
      hat: { decay: 0.035, gain: 0.55 },
      open: { decay: 0.22, gain: 0.5 },
      tambourine: { gain: 0.5 },
      crash: { decay: 1.3, gain: 0.45 },
      pan: { hat: 0.6, open: 0.6, tambourine: 0.7, crash: 0.42 },
    },
    sounds: {
      epiano: { fm: { mods: [{ ratio: 1, index: 1.2, decay: 0.7, sustain: 0.15 }, { ratio: 14, index: 0.45, decay: 0.025 }], trem: 0.25, tremRate: 4.2 }, a: 0.002, d: 2.4, s: 0, r: 0.25, gain: 0.6 },
      bass: { wave: 'saw', voices: 1, sub: 0.3, cutoff: 260, env: 2200, res: 1.6, fd: 0.12, fs: 0.15, a: 0.002, d: 0.2, s: 0.5, r: 0.05, track: 0.3, gain: 0.95 },
      strings: { wave: 'saw', voices: 4, detune: 14, cutoff: 2800, env: 600, res: 0.7, fa: 0.1, fd: 0.5, a: 0.05, d: 0.4, s: 0.85, r: 0.35, vib: 0.004, gain: 0.42 },
      guitar: { pluck: { bright: 0.9, decay: 0.08, pick: 0.1 }, r: 0.02, gain: 0.42 },
      brass: { wave: 'saw', voices: 3, detune: 8, cutoff: 700, env: 3200, res: 1.0, fa: 0.025, fd: 0.15, fs: 0.35, a: 0.012, d: 0.2, s: 0.7, r: 0.08, gain: 0.38 },
      lead: { wave: 'square', voices: 2, detune: 6, cutoff: 1800, env: 1500, res: 1.2, fa: 0.01, fd: 0.3, fs: 0.6, a: 0.005, d: 0.3, s: 0.8, r: 0.15, vib: 0.006, glide: 0.04, gain: 0.42 },
    },
    parts: {
      keys: { role: 'comp', sound: 'epiano', pattern: 'disco', voicing: 4, pan: 0.4, loose: 0.004 },
      bass: { role: 'bass', sound: 'bass', pattern: 'octave', pan: 0.5 },
      guitar: { role: 'comp', sound: 'guitar', pattern: 'scratch', voicing: 2, octave: 1, pan: 0.7, loose: 0.003 },
      strings: { role: 'melody', sound: 'strings', pan: 0.5, legato: 0.98 },
      brass: { role: 'melody', sound: 'brass', pan: 0.56 },
      lead: { role: 'melody', sound: 'lead', pan: 0.5 },
    },
    patterns: {
      comp: {
        disco: [[0, 3, 90], [3, 1, 70], [6, 2, 85], [10, 3, 90], [14, 2, 80]],
        scratch: [[1, 0.5, 70], [3, 0.5, 95], [5, 0.5, 60], [7, 0.5, 95], [9, 0.5, 70], [11, 0.5, 95], [13, 0.5, 60], [15, 0.5, 95]],
      },
      drums: {
        intro: { kick: 'x...x...x...x...', hat: 'x.x.x.x.x.x.x.x.' },
        disco: {
          kick: 'x...x...x...x...', clap: '....x.......x...', hat: 'x...x...x...x...', open: '..x...x...x...x.',
          tambourine: 'oooxoooxoooxooox',
        },
      },
    },
    chords: {
      verse: ['Am9', 'D9', 'Am9', 'D9', 'Am9', 'D9', 'Fmaj7', 'E7'],
      chorus: ['Fmaj7', 'G', 'Em7', 'Am9', 'Dm7', 'G', 'Cmaj7', 'E7'],
      bridge: ['Dm9', 'G9', 'Cmaj9', 'Fmaj7', 'Dm9', 'G9', 'Em7', 'E7'],
    },
    melodies: {
      stabs: `r/2 e5+a5/2 r/2 g5+c6/2 r/4 a5+d6/2 r/2  r/2 c5+f#5/2 r/2 e5+a5/2 f#5+c6/4 r/4`,
      run: `r/120 e5/1 f5/1 g#5/1 a5/1 b5/1 c6/1 d6/1 e6/1`,
      chorus: `e5/2 a5/2 c6/4 e6/6 c6/2  d6/4 b5/4 g5/4 a5/2 b5/2  g5/6 e5/2 b5/8  a5/4 b5/2 c6/2 e6/8
               f6/4 e6/2 d6/2 c6/4 a5/4  b5/4 d6/4 g6/8  e6/4 d6/2 c6/2 b5/4 g5/4  g#5/4 b5/4 d6/4 e6/4`,
      solo: `a5/4 c6/4 e6/6 d6/2  b5/4 a5/2 f5/2 d5/8  e5/4 g5/4 b5/6 d6/2  c6/8 a5/8
             f5/4 a5/4 c6/4 e6/4  d6/4 b5/2 a5/2 g5/8  b5/4 g5/2 e5/2 d5/4 e5/4  g#5/12 r/4`,
    },
    form: ['intro', 'verse', 'chorus', 'bridge', 'verse2', 'lift'],
    sections: {
      intro: { chords: 'verse', bars: 4, label: 'E-piano and a four-on-the-floor', drums: 'intro', play: { keys: true, bass: 0.8 } },
      verse: {
        chords: 'verse', label: 'Chicken-scratch guitar, octave bass and horn stabs', drums: 'disco', crash: true,
        play: { keys: 0.85, bass: true, guitar: true, brass: { melody: 'stabs', loop: true }, strings: 'run' },
      },
      chorus: {
        chords: 'chorus', label: 'The strings take the tune', drums: 'disco', crash: true,
        play: { strings: { melody: 'chorus', double: -12 }, keys: 0.8, bass: true, guitar: true },
      },
      bridge: {
        chords: 'bridge', label: 'Synth solo', drums: 'disco', crash: true,
        play: { lead: 'solo', keys: true, bass: true, guitar: 0.8 },
      },
      verse2: {
        chords: 'verse', label: 'Horn stabs again, and the string run', drums: 'disco', crash: true,
        play: { keys: 0.85, bass: true, guitar: true, brass: { melody: 'stabs', loop: true }, strings: 'run' },
      },
      lift: {
        chords: 'chorus', transpose: 2, label: 'Last chorus, a tone higher', drums: 'disco', crash: true,
        play: { strings: { melody: 'chorus', double: -12 }, keys: 0.8, bass: true, guitar: true, brass: { melody: 'stabs', loop: true, level: 0.6 } },
      },
    },
  },

  // Liquid drum and bass: rolling breaks, a reese bass, vibes.
  liquid: {
    key: 'F major',
    about: 'Liquid drum and bass at 174: a chopped two-bar breakbeat with ghost notes, a detuned reese bass over a sub, warm pads, glass FM bells and a vibraphone tune with its motor running.',
    bpm: 174,
    level: 1.2,
    tail: 3,
    ducking: 0.35,
    room: { size: 1.8, decay: 0.86, damp: 0.3, send: 0.55, echo: 0.75, echoSend: 0.13, echoFeedback: 0.4 },
    kit: {
      metal: false,
      kick: { f: 55, decay: 0.22, drop: 2.5, click: 0.7 },
      snare: { f: 200, decay: 0.17, snappy: 0.9, body: 0.6, tone: 2600, gain: 0.85 },
      hat: { decay: 0.03, gain: 0.55 },
      ride: { decay: 1.2, gain: 0.35 },
      shaker: { gain: 0.5 },
      crash: { decay: 1.6, gain: 0.45 },
      pan: { hat: 0.6, ride: 0.64, shaker: 0.68, crash: 0.4 },
    },
    sounds: {
      reese: { wave: 'saw', voices: 2, detune: 22, sub: 0.6, cutoff: 260, env: 300, res: 1.1, fa: 0.05, fd: 0.4, fs: 0.5, a: 0.01, d: 0.3, s: 0.9, r: 0.12, track: 0.2, gain: 0.75 },
      pad: { wave: 'saw', voices: 4, detune: 18, cutoff: 1400, env: 500, res: 0.8, fa: 0.4, fd: 1.0, a: 0.4, d: 0.8, s: 0.85, r: 0.9, vib: 0.003, gain: 0.9 },
      vibes: { fm: { mods: [{ ratio: 4, index: 0.45, decay: 0.08 }, { ratio: 1, index: 0.25, decay: 1.2 }], trem: 0.35, tremRate: 5.5, scale: 0.2 }, a: 0.002, d: 3.0, s: 0, r: 0.4, gain: 0.7 },
      bells: { fm: { mods: [{ ratio: 3.5, index: 1.2, decay: 0.5 }] }, a: 0.002, d: 1.2, s: 0, r: 0.3, gain: 0.5 },
    },
    parts: {
      bass: { role: 'bass', sound: 'reese', pattern: 'rolling', pan: 0.5 },
      pad: { role: 'pad', sound: 'pad', voicing: 4, pan: 0.5 },
      vibes: { role: 'melody', sound: 'vibes', pan: 0.44 },
      bells: { role: 'arp', sound: 'bells', pattern: 'sparkle', every: 2, voicing: 4, octave: 1, pan: 0.62 },
    },
    patterns: {
      bass: { rolling: [[0, 0, 6, 110], [6, 0, 4, 95], [10, 1, 6, 100]] },
      arp: { sparkle: [0, 2, 4, 3, 1, 3, 2, 4] },
      drums: {
        intro: { hat: 'x.o.x.o.x.o.x.o.', shaker: '..x...x...x...x.' },
        half: { kick: 'x.........x.....', snare: '........x.......', hat: 'x.x.x.x.x.x.x.x.' },
        break: {
          bars: 2,
          kick: 'x.........x.......x.......x.....',
          snare: '....x..o.o..x..o....x..o....x.o.',
          hat: 'x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.xx',
          shaker: 'oooooooooooooooooooooooooooooooo',
        },
        ride: {
          bars: 2,
          kick: 'x.........x.......x.......x.....',
          snare: '....x..o.o..x..o....x..o....x.o.',
          hat: '..o...o...o...o...o...o...o...o.',
          ride: 'x...x...x...x...x...x...x...x...',
          shaker: 'oooooooooooooooooooooooooooooooo',
        },
        fill: { kick: 'x.........x.....', snare: '....x..o.xoxXxXX' },
      },
    },
    chords: {
      main: ['Fmaj9', 'Em7', 'Dm9', 'Cmaj7', 'Fmaj9', 'Em7', 'Dm9', 'Cmaj7'],
      lift: ['Bbmaj7', 'Am7', 'Gm9', 'C9', 'Bbmaj7', 'Am7', 'Gm9', 'C9'],
    },
    melodies: {
      first: `a5/4 g5/4 e5/4 c5/4  d5/8 e5/4 g5/4  f5/4 e5/4 c5/4 a4/4  b4/8 c5/4 e5/4
              a5/4 c6/4 e6/4 c6/4  b5/8 g5/4 e5/4  f5/4 a5/4 e6/6 d6/2  c6/8 b5/4 g5/4`,
      second: `d6/6 c6/2 a5/8  c6/4 a5/4 e5/8  d5/4 f5/4 a5/4 bb5/4  g5/8 e5/8
               f5/4 a5/4 d6/6 f6/2  e6/8 c6/8  bb5/4 a5/4 f5/4 d5/4  e5/8 g5/8`,
    },
    form: ['intro', 'build', 'drop', 'drop2', 'breakdown', 'drop3', 'drop4', 'outro'],
    sections: {
      intro: { chords: 'main', label: 'Pads and glass bells', drums: 'intro', play: { pad: 1, bells: 0.9 } },
      build: { chords: 'main', label: 'Half time, building', drums: 'half', riser: 4, play: { pad: 0.7, bells: 0.6, bass: 0.7 } },
      drop: { chords: 'main', label: 'Drop: breakbeat and reese bass', drums: 'break', crash: true, play: { bass: true, pad: 0.45, bells: 0.45 } },
      drop2: { chords: 'main', label: 'Vibraphone on top', drums: 'break', fill: 'fill', play: { bass: true, pad: 0.45, vibes: 'first' } },
      breakdown: { chords: 'lift', label: 'Breakdown', play: { pad: 1, vibes: 'second', bells: 0.6 } },
      drop3: { chords: 'lift', label: 'Second drop, on the ride', drums: 'ride', crash: true, play: { bass: true, pad: 0.45, vibes: { melody: 'second', level: 0.9 } } },
      drop4: { chords: 'main', label: 'Back home', drums: 'ride', fill: 'fill', play: { bass: true, pad: 0.45, vibes: 'first', bells: 0.4 } },
      outro: { chords: 'main', label: 'Outro', drums: 'intro', crash: true, play: { pad: 1, bells: 0.9, bass: 0.5 } },
    },
  },
};

// Every tune, in playing order.
export const TUNE_NAMES = ['voluntary', 'boombox', 'hoedown', 'carnival', 'mirrorball', 'liquid'];
