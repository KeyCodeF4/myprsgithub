import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { loadSounds, playSound } from '../utils/soundManager';
import { getSoundEnabled, setSoundEnabled as storeEnabled, getSoundPrompted, setSoundPrompted } from '../utils/storage';

const SoundContext = createContext({
  soundEnabled: false,
  setSoundEnabled: () => {},
  playSound: () => {},
  hasPrompted: false,
  markPrompted: () => {},
});

export const useSound = () => useContext(SoundContext);

export function SoundProvider({ children }) {
  const [soundEnabled, setSoundEnabledState] = useState(false);
  const [hasPrompted, setHasPrompted] = useState(false);
  const loadedRef = useRef(false);

  useEffect(() => {
    (async () => {
      const [enabled, prompted] = await Promise.all([getSoundEnabled(), getSoundPrompted()]);
      setSoundEnabledState(enabled);
      setHasPrompted(prompted);
    })();
  }, []);

  useEffect(() => {
    if (soundEnabled && !loadedRef.current) {
      loadedRef.current = true;
      loadSounds();
    }
  }, [soundEnabled]);

  const setSoundEnabled = useCallback(async (val) => {
    setSoundEnabledState(val);
    await storeEnabled(val);
    if (val && !loadedRef.current) {
      loadedRef.current = true;
      loadSounds();
    }
  }, []);

  const play = useCallback((name) => {
    if (soundEnabled) playSound(name);
  }, [soundEnabled]);

  const markPrompted = useCallback(async () => {
    setHasPrompted(true);
    await setSoundPrompted();
  }, []);

  const resetState = useCallback(() => {
    setSoundEnabledState(false);
    setHasPrompted(false);
    loadedRef.current = false;
  }, []);

  return (
    <SoundContext.Provider value={{ soundEnabled, setSoundEnabled, playSound: play, hasPrompted, markPrompted, resetState }}>
      {children}
    </SoundContext.Provider>
  );
}
