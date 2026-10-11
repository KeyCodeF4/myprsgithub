import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  APP_THEMES,
  DEFAULT_THEME_ID,
  THEME_LIST,
  getUnlockedThemeIds,
  isThemeUnlocked,
  resolveSafeThemeId,
} from '../config/theme-config';
import { getThemeData, saveThemeData } from '../utils/storage';
import { reportError } from '../utils/errorReporter';
import { trackEvent } from '../utils/product-analytics';

const ThemeContext = createContext({
  ...APP_THEMES[DEFAULT_THEME_ID],
  themeId: DEFAULT_THEME_ID,
  unlockedThemeIds: [DEFAULT_THEME_ID],
  availableThemes: THEME_LIST,
  level: 1,
  equipTheme: async () => false,
  unlockTheme: async () => false,
  isUnlocked: () => false,
});

export const useTheme = () => useContext(ThemeContext);

/**
 * `level` is supplied by the app shell (from XP) so themes can be gated on it.
 * Unlocks are derived from level rather than stored, which means they can never
 * drift out of sync with progress; `grantedThemeIds` remains for one-off
 * achievement unlocks added later.
 */
export function ThemeProvider({ children, level = 1, entitledThemeIds = [], entitlementLoading = false }) {
  const [themeId, setThemeId] = useState(DEFAULT_THEME_ID);
  const [grantedThemeIds, setGrantedThemeIds] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getThemeData()
      .then(data => {
        const granted = Array.isArray(data?.grantedThemeIds)
          ? data.grantedThemeIds
          // Migrate the old field, which stored every unlocked id directly.
          : Array.isArray(data?.unlockedThemeIds) ? data.unlockedThemeIds : [];
        setGrantedThemeIds(granted.filter(id => !!APP_THEMES[id] && id !== DEFAULT_THEME_ID));
        if (data?.selectedThemeId && APP_THEMES[data.selectedThemeId]) {
          setThemeId(data.selectedThemeId);
        }
      })
      .catch(error => reportError(error, 'load-theme'))
      .finally(() => setLoaded(true));
  }, []);

  const effectiveGrantedIds = useMemo(
    () => [...new Set([...grantedThemeIds, ...(entitledThemeIds || [])])],
    [grantedThemeIds, entitledThemeIds]
  );

  const unlockedThemeIds = useMemo(
    () => getUnlockedThemeIds(level, effectiveGrantedIds),
    [level, effectiveGrantedIds]
  );

  // If a stored selection is no longer valid (legacy data, or a theme that used
  // to be unlocked by other means), fall back to the default rather than
  // rendering an undefined palette.
  const safeThemeId = useMemo(
    () => resolveSafeThemeId(themeId, level, effectiveGrantedIds),
    [themeId, level, effectiveGrantedIds]
  );

  useEffect(() => {
    if (loaded && !entitlementLoading && safeThemeId !== themeId) setThemeId(safeThemeId);
  }, [entitlementLoading, loaded, safeThemeId, themeId]);

  const persist = useCallback(async (selectedThemeId, granted) => {
    try {
      await saveThemeData({ selectedThemeId, grantedThemeIds: granted });
    } catch (error) {
      reportError(error, 'save-theme');
    }
  }, []);

  const equipTheme = useCallback(async id => {
    if (!isThemeUnlocked(id, level, effectiveGrantedIds)) return false;
    setThemeId(id);
    await persist(id, grantedThemeIds);
    trackEvent('theme.equipped', { theme_id: id });
    return true;
  }, [effectiveGrantedIds, grantedThemeIds, level, persist]);

  // Explicit grant path for future achievement-based unlocks.
  const unlockTheme = useCallback(async id => {
    if (!APP_THEMES[id] || grantedThemeIds.includes(id)) return false;
    const updated = [...grantedThemeIds, id];
    setGrantedThemeIds(updated);
    await persist(safeThemeId, updated);
    return true;
  }, [grantedThemeIds, persist, safeThemeId]);

  const value = useMemo(() => ({
    ...APP_THEMES[safeThemeId],
    themeId: safeThemeId,
    unlockedThemeIds,
    availableThemes: THEME_LIST,
    level,
    equipTheme,
    unlockTheme,
    isUnlocked: id => isThemeUnlocked(id, level, effectiveGrantedIds),
  }), [safeThemeId, unlockedThemeIds, level, equipTheme, unlockTheme, effectiveGrantedIds]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
