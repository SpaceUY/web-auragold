// Sonidos sintetizados con Web Audio: no hay archivos que descargar. El
// contexto se crea en el primer toque, porque el navegador solo deja sonar
// audio después de una interacción.

let context;
let master;

function ensureContext() {
  if (context instanceof OfflineAudioContext) return context;
  if (!context) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;
    context = new AudioContext();
    master = context.createGain();
    master.gain.value = 0.55;
    master.connect(context.destination);
  }
  if (context.state === "suspended") context.resume();
  return context;
}

function noiseBuffer(seconds) {
  const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * seconds), context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function ping(frequency, start, duration, gain) {
  const oscillator = context.createOscillator();
  const envelope = context.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(frequency, start);
  envelope.gain.setValueAtTime(0, start);
  envelope.gain.linearRampToValueAtTime(gain, start + 0.004);
  envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(envelope).connect(master);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.05);
}

function burst(start, duration, gain, from, to) {
  const source = context.createBufferSource();
  source.buffer = noiseBuffer(duration);
  const filter = context.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(from, start);
  filter.frequency.exponentialRampToValueAtTime(to, start + duration);
  const envelope = context.createGain();
  envelope.gain.setValueAtTime(gain, start);
  envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  source.connect(filter).connect(envelope).connect(master);
  source.start(start);
}

// Golpe de cerámica: cada toque suena un poco más agudo y más fuerte.
export function playTap(step, at = 0) {
  if (!ensureContext()) return;
  const now = context.currentTime + at;
  const base = 520 + step * 140;
  burst(now, 0.09, 0.5 + step * 0.15, 5200, 600);
  ping(base, now, 0.35, 0.28);
  ping(base * 2.76, now, 0.18, 0.12);
  ping(base * 5.4, now + 0.01, 0.1, 0.05);
}

// Estallido grave y una lluvia de monedas.
export function playExplosion(at = 0) {
  if (!ensureContext()) return;
  const now = context.currentTime + at;
  burst(now, 0.9, 1.1, 2400, 60);
  burst(now, 0.25, 0.7, 9000, 900);
  const thump = context.createOscillator();
  const thumpGain = context.createGain();
  thump.frequency.setValueAtTime(140, now);
  thump.frequency.exponentialRampToValueAtTime(38, now + 0.5);
  thumpGain.gain.setValueAtTime(0.9, now);
  thumpGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
  thump.connect(thumpGain).connect(master);
  thump.start(now);
  thump.stop(now + 0.7);
  for (let i = 0; i < 26; i++) {
    const t = now + 0.18 + Math.random() * 1.4 * Math.pow(i / 26, 0.7);
    const f = 2400 + Math.random() * 2600;
    ping(f, t, 0.22, 0.05 + Math.random() * 0.05);
    ping(f * 1.5, t, 0.12, 0.025);
  }
}

// Para el video: los mismos sonidos en un contexto offline, devueltos como WAV
// en base64. `events` es una lista de { at, type: "tap" | "explosion", step }.
export async function renderAudio(events, seconds) {
  const sampleRate = 48000;
  const live = { context, master };
  context = new OfflineAudioContext(2, Math.ceil(seconds * sampleRate), sampleRate);
  master = context.createGain();
  master.gain.value = 0.55;
  master.connect(context.destination);
  for (const event of events) {
    if (event.type === "tap") playTap(event.step, event.at);
    else playExplosion(event.at);
  }
  const buffer = await context.startRendering();
  ({ context, master } = live);
  return wavBase64(buffer);
}

function wavBase64(buffer) {
  const channels = buffer.numberOfChannels;
  const length = buffer.length * channels * 2;
  const view = new DataView(new ArrayBuffer(44 + length));
  const text = (offset, value) => [...value].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  text(0, "RIFF");
  view.setUint32(4, 36 + length, true);
  text(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, length, true);
  const data = [...Array(channels)].map((_, c) => buffer.getChannelData(c));
  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let c = 0; c < channels; c++) {
      view.setInt16(offset, Math.max(-1, Math.min(1, data[c][i])) * 0x7fff, true);
      offset += 2;
    }
  }
  let binary = "";
  const bytes = new Uint8Array(view.buffer);
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}
