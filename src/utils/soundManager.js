// Migrated from expo-av (deprecated and removed after SDK 54) to expo-audio.
// expo-audio's imperative API is createAudioPlayer(), which returns a player
// object rather than the { sound } wrapper expo-av used.
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import * as FileSystem from 'expo-file-system';
import { SOUNDS, bufferToBase64 } from './wavGenerator';
import { reportError } from './errorReporter';

const SOUND_NAMES = ['swoosh', 'impact', 'celebrate'];
const soundCache = {};
let loaded = false;

async function ensureDir() {
  const dir = `${FileSystem.cacheDirectory}myprs_sounds/`;
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  return dir;
}

async function loadSound(name) {
  if (soundCache[name]) return;
  const buf = SOUNDS[name];
  if (!buf) return;
  try {
    const dir = await ensureDir();
    const path = `${dir}${name}.wav`;
    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists) {
      const b64 = bufferToBase64(buf);
      await FileSystem.writeAsStringAsync(path, b64, { encoding: FileSystem.EncodingType.Base64 });
    }
    const player = createAudioPlayer({ uri: path });
    player.volume = 0.5;
    soundCache[name] = player;
  } catch (e) {
    // Sound is a non-essential flourish — never let it break a workout save.
    reportError(e, 'load-sound', { type: name });
  }
}

export async function loadSounds() {
  if (loaded) return;
  try {
    await setAudioModeAsync({
      playsInSilentMode: false,
      shouldRouteThroughEarpiece: false,
      interruptionModeAndroid: 'duckOthers',
    });
  } catch (e) {
    reportError(e, 'set-audio-mode');
  }
  await Promise.all(SOUND_NAMES.map(loadSound));
  loaded = true;
}

export async function playSound(name) {
  const player = soundCache[name];
  if (!player) return;
  try {
    // seekTo(0) so rapid repeat triggers restart rather than being ignored.
    await player.seekTo(0);
    player.play();
  } catch (e) {
    reportError(e, 'play-sound', { type: name });
  }
}

export function unloadSounds() {
  Object.values(soundCache).forEach(player => {
    try { player.remove(); } catch (e) { /* already released */ }
  });
  Object.keys(soundCache).forEach(k => delete soundCache[k]);
  loaded = false;
}
