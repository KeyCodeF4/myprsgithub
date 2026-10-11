import React, { useCallback, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  FadeIn,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../context/ThemeContext';
import ShareableWrappedCard from './ShareableWrappedCard';
import { useReduceMotion } from './flip-card';

const MAX_TITLE_LENGTH = 28;

export default function TitleStampCeremony({ card, medals, onStamp, onDone, onCancel }) {
  const theme = useTheme();
  const { width, height } = useWindowDimensions();
  const reduceMotion = useReduceMotion();
  const [title, setTitle] = useState('');
  const [createdTitle, setCreatedTitle] = useState(null);
  const [saving, setSaving] = useState(false);
  const stampProgress = useSharedValue(0);
  const cardPulse = useSharedValue(1);
  const compact = height < 720;
  const cardWidth = Math.min(width - 92, compact ? 190 : 230);
  const cardHeight = cardWidth * 16 / 9;

  const celebrate = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  useEffect(() => {
    if (!createdTitle) return;
    if (reduceMotion) {
      stampProgress.value = 1;
      cardPulse.value = 1;
      celebrate();
      return;
    }
    stampProgress.value = 0;
    cardPulse.value = 0.96;
    stampProgress.value = withSpring(1, { damping: 10, stiffness: 180, mass: 0.65 }, finished => {
      if (finished) runOnJS(celebrate)();
    });
    cardPulse.value = withTiming(1, { duration: 280 });
  }, [cardPulse, celebrate, createdTitle, reduceMotion, stampProgress]);

  const stampStyle = useAnimatedStyle(() => ({
    opacity: stampProgress.value,
    transform: [
      { translateY: interpolate(stampProgress.value, [0, 1], [-120, 0]) },
      { rotateZ: `${interpolate(stampProgress.value, [0, 1], [-11, -3])}deg` },
      { scale: interpolate(stampProgress.value, [0, 0.72, 1], [2.2, 0.9, 1]) },
    ],
  }));

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cardPulse.value }],
  }));

  const handleStamp = useCallback(async () => {
    const trimmed = title.trim();
    if (trimmed.length < 2 || saving) return;
    setSaving(true);
    try {
      const result = await onStamp(trimmed);
      if (result) setCreatedTitle(result);
    } finally {
      setSaving(false);
    }
  }, [onStamp, saving, title]);

  if (createdTitle) {
    return (
      <Animated.View entering={FadeIn.duration(180)} style={styles.reveal}>
        <Text style={[styles.eyebrow, { color: theme.primary }]}>CARD #001</Text>
        <Text style={styles.revealTitle}>Your title is locked in.</Text>
        <Text style={[styles.revealCopy, { color: theme.home.textSecondary }]}>Future cards use this title until you equip another. Existing cards keep the title they were made with.</Text>
        <View style={{ width: cardWidth, height: cardHeight }}>
          <Animated.View style={[StyleSheet.absoluteFill, cardStyle]}>
            <ShareableWrappedCard
              variant="hero"
              heroWidth={cardWidth}
              stats={card?.stats || card?.headlineStat}
              cardNumber={card?.cardNumber || 1}
              wrappedCount={1}
              level={card?.level || 1}
              medals={medals}
              userTitle={createdTitle.text}
              headlineFactId={card?.headlineFactId}
            />
          </Animated.View>
          <Animated.View pointerEvents="none" style={[styles.stamp, { borderColor: theme.primary }, stampStyle]}>
            <Text style={[styles.stampText, { color: theme.primary }]}>TITLE STAMPED</Text>
          </Animated.View>
        </View>
        <TouchableOpacity accessibilityRole="button" onPress={onDone} activeOpacity={0.82} style={[styles.primaryButton, { backgroundColor: theme.primary }]}>
          <Text style={styles.primaryButtonText}>See my collection</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined} style={styles.form}>
      <Text style={[styles.eyebrow, { color: theme.primary }]}>MAKE IT YOURS</Text>
      <Text style={styles.formTitle}>Create your first title</Text>
      <Text style={[styles.formCopy, { color: theme.home.textSecondary }]}>This is the name stamped onto card #001 and every new card until you equip something else.</Text>
      <TextInput
        accessibilityLabel="Your first title"
        value={title}
        onChangeText={setTitle}
        placeholder="e.g. The Bench Demon"
        placeholderTextColor={theme.home.textTertiary}
        maxLength={MAX_TITLE_LENGTH}
        autoCapitalize="words"
        returnKeyType="done"
        onSubmitEditing={handleStamp}
        style={[
          styles.input,
          {
            color: theme.home.textPrimary,
            borderColor: title.trim().length >= 2 ? theme.primary : theme.home.border,
            backgroundColor: theme.home.surfaceSecondary,
            fontFamily: theme.font.semiBold,
          },
        ]}
      />
      <Text style={[styles.counter, { color: theme.home.textSecondary }]}>{title.length}/{MAX_TITLE_LENGTH}</Text>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Stamp title onto first card"
        accessibilityState={{ disabled: title.trim().length < 2 || saving }}
        disabled={title.trim().length < 2 || saving}
        onPress={handleStamp}
        activeOpacity={0.82}
        style={[
          styles.primaryButton,
          { backgroundColor: title.trim().length >= 2 ? theme.primary : theme.home.surfaceSecondary },
        ]}
      >
        <Text style={[styles.primaryButtonText, title.trim().length < 2 && { color: theme.home.textTertiary }]}>{saving ? 'Stamping...' : 'Stamp my title'}</Text>
      </TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" onPress={onCancel} style={styles.laterButton}>
        <Text style={[styles.laterText, { color: theme.home.textSecondary }]}>Not now</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  form: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 26 },
  eyebrow: { fontSize: 10, letterSpacing: 2.8, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  formTitle: { color: '#FFF', fontSize: 29, lineHeight: 35, fontFamily: 'Inter_700Bold', textAlign: 'center', marginTop: 9 },
  formCopy: { maxWidth: 520, fontSize: 14, lineHeight: 21, fontFamily: 'Inter_400Regular', textAlign: 'center', marginTop: 12 },
  input: { width: '100%', maxWidth: 520, borderWidth: 1.5, borderRadius: 17, borderCurve: 'continuous', paddingHorizontal: 18, paddingVertical: 16, fontSize: 18, textAlign: 'center', marginTop: 28 },
  counter: { fontSize: 11, marginTop: 8, fontVariant: ['tabular-nums'] },
  primaryButton: { width: '100%', maxWidth: 520, borderRadius: 16, borderCurve: 'continuous', paddingVertical: 16, alignItems: 'center', marginTop: 22, boxShadow: '0 9px 28px rgba(230,57,70,0.22)' },
  primaryButtonText: { color: '#080808', fontSize: 15, fontFamily: 'Inter_700Bold' },
  laterButton: { paddingHorizontal: 22, paddingVertical: 14, marginTop: 5 },
  laterText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  reveal: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22, paddingVertical: 18 },
  revealTitle: { color: '#FFF', fontSize: 25, lineHeight: 30, fontFamily: 'Inter_700Bold', textAlign: 'center', marginTop: 7 },
  revealCopy: { maxWidth: 500, fontSize: 12, lineHeight: 18, fontFamily: 'Inter_400Regular', textAlign: 'center', marginTop: 8, marginBottom: 14 },
  stamp: { position: 'absolute', left: -26, right: -26, top: '44%', borderWidth: 4, borderRadius: 10, paddingVertical: 10, backgroundColor: 'rgba(13,13,13,0.88)' },
  stampText: { textAlign: 'center', fontSize: 20, letterSpacing: 2.2, fontFamily: 'Inter_700Bold' },
});
