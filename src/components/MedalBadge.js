import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { RARITY_COLORS } from '../data/medalsConfig';

export default function MedalBadge({ medal, size = 60, showName = true }) {
  const { name, icon, rarity, tier } = medal;
  const rarityKey = rarity || tier;
  const colors = RARITY_COLORS[rarityKey] || RARITY_COLORS.bronze;

  return (
    <View style={[styles.container, { width: size + 20, backgroundColor: colors.bg, borderColor: colors.border }]}>
      <Text style={[styles.icon, { fontSize: size * 0.5 }]}>{icon}</Text>
      <Text style={[styles.rarityLabel, { color: colors.text }]}>{rarityKey.toUpperCase()}</Text>
      {showName && <Text style={styles.name}>{name}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    borderWidth: 2,
    margin: 6,
  },
  icon: {
    marginBottom: 4,
  },
  rarityLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: 2,
  },
  name: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
});
