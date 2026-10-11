import React, { useEffect, useRef } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../context/ThemeContext';
import { TIERS } from '../data/medalsConfig';
import { reportError } from '../utils/errorReporter';

function founderSerial(value) {
  return `#${String(value || 0).padStart(3, '0')} / 100`;
}

export default function MedalCelebration({ medal, onDismiss }) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const tier = TIERS[medal.tier];
  const isFounder = medal.tier === 'founder';
  const reduceMotion = useReducedMotion();
  const entry = useSharedValue(reduceMotion ? 1 : 0);
  const glow = useSharedValue(reduceMotion ? 0.65 : 0.25);
  const orbit = useSharedValue(0);
  const cardRef = useRef(null);

  useEffect(() => {
    if (!reduceMotion) {
      entry.value = withDelay(90, withSpring(1, { damping: 12, stiffness: 145, mass: 0.8 }));
      glow.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 260, easing: Easing.inOut(Easing.quad) }),
          withTiming(0.45, { duration: 260, easing: Easing.inOut(Easing.quad) })
        ),
        2,
        true
      );
      if (isFounder) {
        orbit.value = withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) });
      }
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    return () => {
      cancelAnimation(entry);
      cancelAnimation(glow);
      cancelAnimation(orbit);
    };
  }, [entry, glow, isFounder, orbit, reduceMotion]);

  const entryStyle = useAnimatedStyle(() => ({
    opacity: entry.value,
    transform: [
      { scale: 0.72 + entry.value * 0.28 },
      { translateY: (1 - entry.value) * 20 },
    ],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.16 + glow.value * 0.34,
    transform: [{ scale: 0.88 + glow.value * 0.2 }],
  }));

  const orbitStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${orbit.value * 360}deg` }],
  }));

  const handleShare = async () => {
    try {
      const uri = await captureRef(cardRef, { format: 'png', quality: 1 });
      if (await Sharing.isAvailableAsync()) {
        const serial = isFounder && medal.serialNumber ? ` ${founderSerial(medal.serialNumber)}` : '';
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: `I unlocked ${medal.name}${serial}!` });
      }
    } catch (error) {
      reportError(error, 'share-medal');
      Alert.alert('Share failed', 'We could not share this medal. Please try again.');
    }
  };

  const cardWidth = Math.min(width - 48, 320);

  return (
    <View style={styles.overlay}>
      <Animated.View style={entryStyle}>
        <View
          collapsable={false}
          ref={cardRef}
          style={[
            styles.card,
            {
              width: cardWidth,
              borderColor: isFounder ? tier.color : '#2A2A2A',
              boxShadow: isFounder
                ? `0 18px 70px ${tier.color}38`
                : '0 18px 54px rgba(0,0,0,0.68)',
            },
          ]}
        >
          <Animated.View style={[styles.glow, { backgroundColor: tier.color }, glowStyle]} />
          {isFounder && (
            <Animated.View style={[styles.founderOrbit, { borderColor: `${tier.color}66` }, orbitStyle]}>
              <View style={[styles.orbitGem, styles.orbitGemTop, { backgroundColor: tier.color }]} />
              <View style={[styles.orbitGem, styles.orbitGemBottom, { backgroundColor: '#B67CFF' }]} />
            </Animated.View>
          )}

          <Text style={[styles.unlockLabel, isFounder && { color: tier.color }]}>LIMITED DROP</Text>
          <Text style={[styles.icon, isFounder && styles.founderIcon]}>{medal.icon}</Text>
          <Text style={[styles.name, { color: tier.color }]}>{medal.name}</Text>
          <View style={[styles.tierBadge, { backgroundColor: `${tier.color}1F`, borderColor: tier.color }]}>
            <Text style={[styles.tierText, { color: tier.color }]}>
              {isFounder && medal.serialNumber ? founderSerial(medal.serialNumber) : tier.name.toUpperCase()}
            </Text>
          </View>
          <Text style={styles.desc}>{medal.description}</Text>
          {isFounder && <Text style={styles.provenance}>GENESIS SERIES · NEVER REISSUED</Text>}
          <Text style={styles.tagline}>MYPRS · BUILT, NOT GIVEN</Text>
        </View>
      </Animated.View>

      <View style={styles.actions}>
        <TouchableOpacity style={[styles.btn, { backgroundColor: tier.color }]} onPress={onDismiss} activeOpacity={0.72}>
          <Text style={styles.btnText}>Equip later</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, styles.btnOutline, { borderColor: tier.color }]} onPress={handleShare} activeOpacity={0.72}>
          <Text style={[styles.btnText, { color: tier.color }]}>Share drop</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#020304', justifyContent: 'center', alignItems: 'center', padding: 20 },
  card: {
    aspectRatio: 1,
    borderRadius: 32,
    borderCurve: 'continuous',
    backgroundColor: '#080B0F',
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    paddingHorizontal: 22,
  },
  glow: { position: 'absolute', width: 250, height: 250, borderRadius: 125 },
  founderOrbit: { position: 'absolute', width: 266, height: 266, borderRadius: 133, borderWidth: 1 },
  orbitGem: { position: 'absolute', width: 7, height: 7, transform: [{ rotate: '45deg' }] },
  orbitGemTop: { top: -4, left: 129 },
  orbitGemBottom: { bottom: -4, left: 129 },
  unlockLabel: { fontSize: 10, letterSpacing: 4, color: '#888', fontFamily: 'Inter_700Bold', marginBottom: 8 },
  icon: { fontSize: 64, marginBottom: 10 },
  founderIcon: { color: '#D7FDFF', textShadowColor: '#74F8FF', textShadowRadius: 18 },
  name: { fontSize: 27, fontFamily: 'Inter_700Bold', textAlign: 'center', marginBottom: 8, letterSpacing: -0.5 },
  tierBadge: { borderWidth: 1, borderRadius: 20, paddingVertical: 5, paddingHorizontal: 18, marginBottom: 12 },
  tierText: { fontSize: 10, letterSpacing: 2.4, fontFamily: 'Inter_700Bold' },
  desc: { fontSize: 13, color: '#A4A8AE', fontFamily: 'Inter_400Regular', textAlign: 'center', marginBottom: 10 },
  provenance: { fontSize: 8, letterSpacing: 1.7, color: '#74F8FF', fontFamily: 'Inter_700Bold', marginBottom: 16 },
  tagline: { fontSize: 8, letterSpacing: 2.5, color: '#51565E', fontFamily: 'Inter_700Bold' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 28 },
  btn: { borderRadius: 14, borderCurve: 'continuous', paddingVertical: 14, paddingHorizontal: 24, alignItems: 'center' },
  btnOutline: { backgroundColor: 'transparent', borderWidth: 1.5 },
  btnText: { color: '#050607', fontSize: 14, fontFamily: 'Inter_700Bold' },
});
