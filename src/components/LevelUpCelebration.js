import React, { useRef, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, useWindowDimensions } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { getAccentColorFromLevel, getLevelName } from '../utils/xpSystem';
import { reportError } from '../utils/errorReporter';

function LevelBar({ index, progress, accent }) {
  const style = useAnimatedStyle(() => ({ opacity: interpolate(progress.value, [0, 1], [0, 0.55 + index * 0.1]), transform: [{ scaleY: interpolate(progress.value, [0, 1], [0.05, 1]) }] }));
  return <Animated.View style={[styles.bar, { backgroundColor: accent, height: 20 + index * 8 }, style]} />;
}

function XpCounter({ xp, accent, reduceMotion }) {
  const [display, setDisplay] = useState(reduceMotion ? xp : Math.max(0, xp - 100));
  useEffect(() => {
    if (reduceMotion) { setDisplay(xp); return; }
    const startValue = Math.max(0, xp - 100);
    const started = Date.now();
    let frame;
    const tick = () => {
      const progress = Math.min(1, (Date.now() - started) / 300);
      setDisplay(Math.round(startValue + (xp - startValue) * progress));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [xp, reduceMotion]);
  return <Text style={[styles.xpText, { color: accent }]}>{display.toLocaleString()} total XP</Text>;
}

export default function LevelUpCelebration({ oldLevel, newLevel, xp, onDismiss }) {
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const accent = getAccentColorFromLevel(newLevel);
  const levelName = getLevelName(newLevel);
  const scaleAnim = useSharedValue(reduceMotion ? 1 : 0.82);
  const glowAnim = useSharedValue(reduceMotion ? 0.5 : 0);
  const barsAnim = useSharedValue(reduceMotion ? 1 : 0);
  const cardRef = useRef(null);

  useEffect(() => {
    scaleAnim.value = reduceMotion ? 1 : withDelay(80, withSpring(1, { damping: 13, stiffness: 190 }));
    glowAnim.value = reduceMotion ? 0.5 : withDelay(80, withTiming(1, { duration: 300 }));
    barsAnim.value = reduceMotion ? 1 : withDelay(80, withTiming(1, { duration: 300 }));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [scaleAnim, glowAnim, barsAnim, reduceMotion]);

  const contentStyle = useAnimatedStyle(() => ({ transform: [{ scale: scaleAnim.value }] }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glowAnim.value }));

  const handleShare = async () => {
    try {
      const uri = await captureRef(cardRef, { format: 'png', quality: 1 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: `I reached Level ${newLevel}!` });
      }
    } catch (e) {
      reportError(e, 'share-level-up');
      Alert.alert('Share failed', 'We could not share this level-up. Please try again.');
    }
  };

  return (
    <View style={styles.overlay}>
      <View collapsable={false} ref={cardRef} style={[styles.card, { borderColor: accent, width: Math.min(width - 60, 300) }]}>
        <Animated.View style={[styles.glow, { backgroundColor: accent + '12' }, glowStyle]} />
        <Animated.View style={[{ alignItems: 'center' }, contentStyle]}>
          <View style={[styles.barGraph, { marginBottom: 16 }]}>
            {[0, 1, 2, 3, 4].map(index => <LevelBar key={index} index={index} progress={barsAnim} accent={accent} />)}
          </View>
          <Text style={styles.label}>LEVEL UP</Text>
          <Text style={[styles.levelNum, { color: accent }]}>{newLevel}</Text>
          <Text style={[styles.levelName, { color: accent }]}>{levelName}</Text>
          <View style={[styles.xpBadge, { backgroundColor: accent + '22', borderColor: accent }]}>
            <XpCounter xp={xp} accent={accent} reduceMotion={reduceMotion} />
          </View>
          <Text style={styles.tagline}>MYPRS</Text>
        </Animated.View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={[styles.btn, { backgroundColor: accent }]} onPress={onDismiss} activeOpacity={0.7}>
          <Text style={[styles.btnText, { color: '#000' }]}>Let's Go!</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, styles.btnOutline, { borderColor: accent }]} onPress={handleShare} activeOpacity={0.7}>
          <Text style={[styles.btnText, { color: accent }]}>Share</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    aspectRatio: 1,
    borderRadius: 32,
    backgroundColor: '#0D0D0D',
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.6,
    shadowRadius: 30,
    elevation: 15,
  },
  glow: {
    position: 'absolute',
    top: -40, left: -40, right: -40, bottom: -40,
    borderRadius: 60,
  },
  barGraph: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    height: 60,
  },
  bar: {
    width: 12,
    borderRadius: 6,
  },
  label: {
    fontSize: 11,
    letterSpacing: 5,
    color: '#888',
    fontFamily: 'Inter_700Bold',
    marginBottom: 4,
  },
  levelNum: {
    fontSize: 64,
    fontFamily: 'Inter_700Bold',
    lineHeight: 72,
  },
  levelName: {
    fontSize: 16,
    letterSpacing: 4,
    fontFamily: 'Inter_700Bold',
    marginBottom: 12,
  },
  xpBadge: {
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 18,
    marginBottom: 16,
  },
  xpText: {
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
  },
  tagline: {
    fontSize: 10,
    letterSpacing: 4,
    color: '#444',
    fontFamily: 'Inter_700Bold',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 32,
  },
  btn: {
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignItems: 'center',
  },
  btnOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
  },
  btnText: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
  },
});
