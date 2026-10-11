import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { RARITY_COLORS } from '../data/medalsConfig';

/**
 * Compact, static medal slot for Wrapped cards.
 * The old travelling highlight could visually merge into a shiny bar beneath
 * adjacent slots. A restrained rarity ring keeps each medal readable instead.
 */
export default function AnimatedMedalRing({ medal, size = 22, iconSize = 12 }) {
  const rarity = RARITY_COLORS[medal?.tier] || { border: '#777', text: '#FFF', bg: '#222' };
  const mark = String(medal?.name || 'Medal').split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase();

  return (
    <View
      accessible
      accessibilityLabel={`${medal?.name || 'Earned'} medal`}
      style={[
        styles.medal,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor: rarity.border,
          backgroundColor: rarity.bg,
        },
      ]}
    >
      <View pointerEvents="none" style={[styles.innerRing, { borderRadius: size / 2, borderColor: `${rarity.text || rarity.border}55` }]} />
      <Text style={[styles.icon, { color: rarity.text || '#FFF', fontSize: Math.max(6, iconSize - 4), lineHeight: Math.max(iconSize + 3, 16) }]}>{mark}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  medal: {
    position: 'relative',
    borderWidth: 1.25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerRing: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: StyleSheet.hairlineWidth,
    margin: 2,
  },
  icon: { textAlign: 'center', fontFamily: 'Inter_700Bold', letterSpacing: -0.4 },
});
