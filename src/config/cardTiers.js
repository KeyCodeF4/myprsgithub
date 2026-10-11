import { RED } from './accentConfig';

export const CARD_TIERS = [
  {
    minLevel: 1, maxLevel: 5,
    id: 'starter', name: 'Starter',
    palette: {
      primary: RED[300],
      secondary: RED[200],
      background: '#0D0D0D',
      surface: '#161616',
      border: RED[300] + '44',
      text: RED[300],
      textBright: '#E8A0A0',
      accent: RED[300],
    },
    frame: { borderWidth: 1, borderStyle: 'solid', borderRadius: 20, cornerAccents: false },
    effects: { shimmer: false, glowPulse: false, particles: false, animatedBorder: false, animatedBackground: false, particleBurst: false },
    bgGradient: ['#0D0D0D', '#141414'],
  },
  {
    minLevel: 6, maxLevel: 15,
    id: 'grinder', name: 'Grinder',
    palette: {
      primary: RED[400],
      secondary: RED[300],
      background: '#0D0D0D',
      surface: '#181818',
      border: RED[400] + '55',
      text: RED[400],
      textBright: '#C77B7B',
      accent: RED[400],
    },
    frame: { borderWidth: 2, borderStyle: 'solid', borderRadius: 22, cornerAccents: false },
    effects: { shimmer: true, glowPulse: false, particles: false, animatedBorder: false, animatedBackground: false, particleBurst: false },
    bgGradient: ['#0D0D0D', '#161616'],
  },
  {
    minLevel: 16, maxLevel: 30,
    id: 'veteran', name: 'Veteran',
    palette: {
      primary: RED[500],
      secondary: RED[400],
      background: '#0E0D0D',
      surface: '#1A1414',
      border: RED[500] + '66',
      text: '#DDC0C0',
      textBright: '#FFE0E0',
      accent: RED[500],
    },
    frame: { borderWidth: 2.5, borderStyle: 'solid', borderRadius: 24, cornerAccents: true },
    effects: { shimmer: false, glowPulse: true, particles: false, animatedBorder: false, animatedBackground: false, particleBurst: false },
    bgGradient: ['#0E0D0D', '#1A1414'],
  },
  {
    minLevel: 31, maxLevel: 50,
    id: 'elite', name: 'Elite',
    palette: {
      primary: RED[600],
      secondary: RED[500],
      background: '#0E0A0A',
      surface: '#1A1414',
      border: RED[600] + '77',
      text: '#DDC0C0',
      textBright: '#FFE0E0',
      accent: RED[600],
    },
    frame: { borderWidth: 2.5, borderStyle: 'solid', borderRadius: 26, cornerAccents: true },
    effects: { shimmer: false, glowPulse: true, particles: true, animatedBorder: true, animatedBackground: false, particleBurst: false },
    bgGradient: ['#0E0A0A', '#1A1414'],
  },
  {
    minLevel: 51, maxLevel: Infinity,
    id: 'legendary', name: 'Legendary',
    palette: {
      primary: RED[900],
      secondary: RED[400],
      background: '#0A0D0A',
      surface: '#141A14',
      border: RED[900] + '88',
      text: '#DDF0DD',
      textBright: '#E0FFE0',
      accent: RED[900],
    },
    frame: { borderWidth: 3, borderStyle: 'solid', borderRadius: 28, cornerAccents: true },
    effects: { shimmer: true, glowPulse: true, particles: true, animatedBorder: true, animatedBackground: true, particleBurst: true },
    bgGradient: ['#0A0D0A', '#141A14'],
  },
];

export function getCardTier(level) {
  for (const tier of CARD_TIERS) {
    if (level <= tier.maxLevel) return tier;
  }
  return CARD_TIERS[0];
}

export function getTierById(id) {
  return CARD_TIERS.find(t => t.id === id) || CARD_TIERS[0];
}

export const TIER_ANIMATED_BORDER_COLORS = {
  elite: [RED[600] + '88', RED[500], RED[600], RED[500], RED[600] + '88'],
  legendary: [RED[900] + '44', RED[900], RED[900] + 'AA', RED[900], RED[900] + '44'],
};

export const TIER_PARTICLE_COLORS = {
  elite: [RED[500], RED[600], RED[400], RED[500]],
  legendary: [RED[900], RED[400], RED[900] + 'AA', RED[300]],
};
