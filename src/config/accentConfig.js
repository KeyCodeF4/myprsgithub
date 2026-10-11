export const RED = {
  50:  '#FFF1F1',
  100: '#FDE8E8',
  200: '#F9D0D0',
  300: '#E8A0A0',
   400: '#D97A7A',
   500: '#E63946',
   600: '#BB2030',
  700: '#B71C2A',
  800: '#8A151F',
  900: '#5C0E14',

  brand: '#E63946',

  tierAccent: {
    starter: 300,
    grinder: 400,
    veteran: 500,
    elite: 600,
    legendary: 900,
  },
};

export function getAccentStop(tierId) {
  return RED.tierAccent[tierId] || 500;
}

export function getAccentFromTier(tierId) {
  const stop = getAccentStop(tierId);
  return RED[stop] || RED.brand;
}

export function getAccentForLevel(level) {
  if (level <= 5) return RED[300];
  if (level <= 15) return RED[400];
  if (level <= 30) return RED[500];
  if (level <= 50) return RED[600];
  return RED[500];
}

export function getAccentWithOpacity(stopOrColor, opacity) {
  const color = RED[stopOrColor] || stopOrColor || RED.brand;
  const hex = color.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${opacity})`;
}

export function getGradientFromTier(tierId) {
  const base = getAccentFromTier(tierId);
  return [getAccentWithOpacity(tierId === 'legendary' ? 500 : getAccentStop(tierId), 0.08), getAccentWithOpacity(tierId === 'legendary' ? 500 : getAccentStop(tierId), 0.02)];
}
