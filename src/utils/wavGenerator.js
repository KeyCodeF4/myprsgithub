function writeString(view, offset, str) {
  for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
}

function generateWav(samples, sampleRate) {
  const dataSize = samples.length * 2;
  const buf = new ArrayBuffer(44 + dataSize);
  const v = new DataView(buf);
  writeString(v, 0, 'RIFF');
  v.setUint32(4, 36 + dataSize, true);
  writeString(v, 8, 'WAVE');
  writeString(v, 12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  writeString(v, 36, 'data');
  v.setUint32(40, dataSize, true);
  for (let i = 0; i < samples.length; i++) {
    v.setInt16(44 + i * 2, Math.max(-32767, Math.min(32767, Math.round(samples[i] * 30000))), true);
  }
  return buf;
}

function sweepTone(startFreq, endFreq, duration, sampleRate) {
  const n = Math.floor(sampleRate * duration);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    const freq = startFreq + (endFreq - startFreq) * (t / duration);
    const envelope = Math.min(1, (n - i) / (sampleRate * 0.02));
    out[i] = Math.sin(2 * Math.PI * freq * t) * envelope;
  }
  return out;
}

function pulseTone(freq, duration, sampleRate, decay) {
  const n = Math.floor(sampleRate * duration);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    const env = decay ? Math.exp(-3 * t / duration) : 1;
    out[i] = Math.sin(2 * Math.PI * freq * t) * env;
  }
  return out;
}

const SR = 22050;

export const SOUNDS = {
  swoosh: generateWav(sweepTone(300, 800, 0.12, SR), SR),
  impact: generateWav(pulseTone(200, 0.15, SR, true), SR),
  celebrate: generateWav(sweepTone(440, 1200, 0.4, SR), SR),
};

export function bufferToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}
