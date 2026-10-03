# Synthdeck

A music player for six tunes, with no audio files: the tunes are written in
code as chords, melodies and patterns, and every sample is worked out live by
a synthesizer running in an `AudioWorklet`.

| Tune | Style | What plays it |
|---|---|---|
| voluntary | Baroque organ voluntary and toccata | Pipe organ: principals, mixture, flutes, trumpet, oboe, céleste, pedal reeds; Vallotti temperament |
| boombox | Miami bass | Nothing but an 808: the tuned bass drum as the bass, pitched toms, congas and cowbell |
| hoedown | Bluegrass | Plucked strings: banjo, guitar, mandolin, dobro, upright bass |
| carnival | Soca | Steel pans, marimba, FM bass, horns, congas |
| mirrorball | Disco | FM e-piano, octave bass, chicken-scratch guitar, strings, horns, synth lead |
| liquid | Liquid drum and bass | Breakbeat, reese bass, pads, vibraphone, glass bells |

Plain ES modules and static files in `web/`, with no build step and no
dependencies.

## Running

```bash
python3 tools/serve.py 8123
```

Then open `http://localhost:8123/`. Any static file server works, but
`serve.py` turns off caching so a reload always picks up edited modules.

## Deploying

The site is deployed as a static site on Cloudflare Workers, using Workers
Static Assets. `wrangler.jsonc` serves `web/` as it is, with no build step and
no Worker script:

```bash
npx wrangler deploy
```

Or connect the repo under the Worker's Settings > Builds. Leave the build
command blank and keep the default deploy and preview commands. The Worker
must be named `synthdeck` to match `name` in `wrangler.jsonc`. The empty
`previews` block lets each branch build to its own preview URL.

## Controls

- Play / pause, previous, next, a seek bar and a level slider.
- The mode button cycles Repeat all, Repeat one and Shuffle - what plays when
  a tune ends. In Repeat all and Shuffle the next tune crossfades in over the
  last 1.5 seconds.
- Previous goes back to the start of the tune, or, within its first three
  seconds, to the tune before (the last one played, in Shuffle).
- Click a tune in the list to play it.
- Keys: Space or K play / pause, Left and Right seek 5 seconds, N next,
  P previous, T temperament. Media keys and the OS media controls work too.
- Under the description, the part of the tune playing - for the organ, the
  stops drawn. A tune in a temperament of its own (the organ) has a Tuning
  button that switches it to equal temperament and back as it plays.
- The mode and level are remembered in `localStorage` under `synth.`.

## How it works

- `web/js/tunes.js` is data only. Each tune has its tempo, key and a line
  about it for the track list, chord progressions, melodies, a song form, its
  parts and the sounds they play, its drum kit, room and tuning, and the
  patterns only it plays.
- `web/js/compose.js` works a tune out into a sorted list of timed
  MIDI-style notes `[time, channel, note, velocity, duration, glideFrom]`,
  with a mark where each section starts. Each part has a role - melody, pad,
  arpeggio, bass or comping - and each section says what every part plays.
  It also works out temperaments from how far each fifth is narrowed.
- `web/js/main.js` builds the playlist from the two and hands it to the
  player, along with the page.
- `web/js/player.js` knows nothing of the tunes. It plays whatever songs its
  playlist gives it, queuing their notes 0.6 seconds ahead of the audio clock
  and posting them to the worklet, each with its pitch in the song's tuning.
  It runs two worklet instances (decks) so one tune can fade out while the
  next fades in. Pausing suspends the `AudioContext`, which freezes the clock
  the notes are scheduled against. Seeking silences the synth and restarts
  the queue from the first note at or after the new position.
- `web/js/synth-processor.js` is the synthesizer, sample by sample, with five
  kinds of voice:
  - An analog-style synth: detuned saw, square, pulse, triangle or sine
    oscillators (band-limited with PolyBLEP), a sub-octave square, a resonant
    state-variable filter with its own envelope, glide, vibrato, and a pitch
    drop for 808 bass.
  - A pipe organ: each stop a rank of pipes at its footage, from wavetables
    of each pipe tone's harmonics; mutations tuned pure; mixtures that break
    back; slower speech for bigger pipes, chiff on the flues, a cent or so of
    fixed mistuning per pipe, a céleste rank, a tremulant, and a shared wind
    that sags under full chords.
  - FM: a sine carrier with decaying modulators, for e-piano, steel pans,
    marimba, vibraphone and bells.
  - Plucked strings (Karplus-Strong), with pick position, brightness, paired
    courses and slides.
  - A drum machine after the 808: a dropping bass drum, two-head snare, clap,
    metallic hats and cymbals from six square waves, cowbell, rim, clave,
    toms, congas, maracas, shaker, tambourine and a noise riser, with an open
    hat choked by a closed one.
  - Around them, sidechain-style ducking under the kick, a soft clipper, a
    ping-pong echo and a Freeverb-style reverb, set per tune - a cathedral for
    the organ, a small room for the strings.
- After the worklet, a limiter catches peaks and an `AnalyserNode` feeds the
  spectrum behind the player.

A browser without `AudioWorklet` cannot play the music.
