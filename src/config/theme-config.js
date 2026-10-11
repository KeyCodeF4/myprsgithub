import { RED } from './accentConfig';

const FONTS = {
  regular: 'Inter_400Regular',
  semiBold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
};

function createTheme(id, name, primary, home, unlockDescription, requiredLevel = 1) {
  return {
    id,
    name,
    unlockDescription,
    // Level gate. Kept as data (not hardcoded checks) so achievement-based
    // unlocks can be layered on later without reworking the theme model.
    requiredLevel,
    font: FONTS,
    background: home.background,
    surface: home.surface,
    surfaceSecondary: home.surfaceSecondary,
    border: home.border,
    separator: home.separator,
    textPrimary: '#FFFFFF',
    textSecondary: '#A4A4AA',
    textTertiary: '#66666E',
    overlay: 'rgba(0,0,0,0.65)',
    primary,
    primaryDim: primary,
    primaryBg: `${primary}22`,
    selectedBg: `${primary}22`,
    selectedBorder: primary,
    accent: primary,
    highlight: primary,
    accentScale: id === 'iron' ? RED : { 100: `${primary}18`, 300: primary, 400: primary, 500: primary, 600: primary, brand: primary },
    home,
  };
}

export const APP_THEMES = {
  iron: createTheme('iron', 'Iron Red', '#E63946', {
    background: '#0D0D0D', surface: '#161616', surfaceSecondary: '#1F1F1F', border: '#262626', separator: '#232323',
    textPrimary: '#FFFFFF', textSecondary: '#9A9A9A', textTertiary: '#5C5C5C',
  }, 'Available from the start', 1),
  electric: createTheme('electric', 'Electric Blue', '#30A7FF', {
    background: '#071018', surface: '#0D1B27', surfaceSecondary: '#132737', border: '#1D3A50', separator: '#163044',
    textPrimary: '#F5FBFF', textSecondary: '#8FB7D1', textTertiary: '#4F7188',
  }, 'Reach level 5', 5),
  toxic: createTheme('toxic', 'Toxic Lime', '#B7FF3C', {
    background: '#0B1007', surface: '#141D0E', surfaceSecondary: '#1D2A14', border: '#30431E', separator: '#26371A',
    textPrimary: '#F9FFF2', textSecondary: '#ABC18E', textTertiary: '#647552',
  }, 'Reach level 10', 10),
  royal: createTheme('royal', 'Royal Pulse', '#B47CFF', {
    background: '#0D0814', surface: '#181020', surfaceSecondary: '#24182F', border: '#3B2850', separator: '#30203F',
    textPrimary: '#FCF7FF', textSecondary: '#B7A0C8', textTertiary: '#715E80',
  }, 'Reach level 18', 18),
  champion: createTheme('champion', 'Champion Gold', '#FFD45A', {
    background: '#110E06', surface: '#1E190D', surfaceSecondary: '#2B2412', border: '#493D1D', separator: '#3A3018',
    textPrimary: '#FFFDF5', textSecondary: '#C9B981', textTertiary: '#7A6C3E',
  }, 'Reach level 28', 28),
  founder: {
    ...createTheme('founder', 'Founders Void', '#74F8FF', {
      background: '#05070A', surface: '#0C1118', surfaceSecondary: '#111B25', border: '#22414A', separator: '#183039',
      textPrimary: '#F4FFFF', textSecondary: '#9BC7CB', textTertiary: '#52777B',
    }, 'Only for the first 100 MyPRS accounts', 1),
    limited: true,
  },
};

export const DEFAULT_THEME_ID = 'iron';

export const THEME_LIST = Object.values(APP_THEMES);

// A theme is usable when the account level meets its requirement, or when it was
// explicitly granted (kept so achievement-based unlocks can be added later).
export function isThemeUnlocked(themeId, level = 1, grantedIds = []) {
  const theme = APP_THEMES[themeId];
  if (!theme) return false;
  if (themeId === DEFAULT_THEME_ID) return true;
  if (Array.isArray(grantedIds) && grantedIds.includes(themeId)) return true;
  if (theme.limited) return false;
  return (level || 1) >= theme.requiredLevel;
}

export function getUnlockedThemeIds(level = 1, grantedIds = []) {
  return THEME_LIST.filter(t => isThemeUnlocked(t.id, level, grantedIds)).map(t => t.id);
}

// Legacy/corrupt selections must never leave the app themeless.
export function resolveSafeThemeId(themeId, level = 1, grantedIds = []) {
  return isThemeUnlocked(themeId, level, grantedIds) ? themeId : DEFAULT_THEME_ID;
}
