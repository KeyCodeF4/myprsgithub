import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';

export default function ProgressBar({ total, current }) {
  const theme = useTheme();
  return (
    <View style={[styles.container, { gap: 3, paddingHorizontal: 16, paddingVertical: 8 }]}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.segment,
            { height: 3, borderRadius: 2 },
            i < current && { backgroundColor: theme.primary },
            i === current && { backgroundColor: theme.primary },
            i > current && { backgroundColor: '#222' },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row' },
  segment: { flex: 1 },
});
