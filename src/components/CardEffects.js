import React, { useEffect, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, { Easing, interpolate, runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { TIER_ANIMATED_BORDER_COLORS, TIER_PARTICLE_COLORS } from '../config/cardTiers';

const PARTICLE_COUNT = 8;
const SEGMENT_COUNT = 8;

export function ShimmerBorder({ tier, cardWidth, accentColor }) {
  const progress = useSharedValue(0);
  const reduceMotion = useReducedMotion();
  const borderW = tier.frame.borderWidth * 2;

  useEffect(() => {
    progress.value = reduceMotion ? 1 : withDelay(80, withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) }));
  }, [progress, reduceMotion]);
  const motion = useAnimatedStyle(() => ({ transform: [{ translateX: interpolate(progress.value, [0, 1], [-cardWidth, cardWidth * 1.2]) }], opacity: interpolate(progress.value, [0, 0.15, 0.8, 1], [0, 0.65, 0.65, 0]) }));

  return <View style={[StyleSheet.absoluteFill, { pointerEvents: 'none', borderRadius: tier.frame.borderRadius, overflow: 'hidden' }]}><Animated.View style={[{ position: 'absolute', top: -borderW, left: 0, width: cardWidth * 0.5, height: borderW, backgroundColor: (accentColor || tier.palette.accent) + '88' }, motion]} /></View>;
}

export function GlowPulse({ tier, size = 140 }) {
  const progress = useSharedValue(0);
  const reduceMotion = useReducedMotion();
  useEffect(() => {
    progress.value = reduceMotion ? 0.45 : withRepeat(withSequence(withTiming(1, { duration: 260 }), withTiming(0.25, { duration: 260 })), 2, true);
  }, [progress, reduceMotion]);
  const motion = useAnimatedStyle(() => ({ opacity: interpolate(progress.value, [0, 1], [0.08, 0.2]), transform: [{ scale: interpolate(progress.value, [0, 1], [0.9, 1.08]) }] }));
  return <Animated.View style={[{ position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: tier.palette.primary }, motion]} />;
}

export function CornerAccents({ tier }) {
  const s = 20;
  const Corner = ({ style }) => <View style={[{ width: s, height: s, borderColor: tier.palette.accent + '44', position: 'absolute' }, style]} />;
  return <View style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}><Corner style={{ top: 8, left: 8, borderTopWidth: 2, borderLeftWidth: 2, borderTopLeftRadius: 6 }} /><Corner style={{ top: 8, right: 8, borderTopWidth: 2, borderRightWidth: 2, borderTopRightRadius: 6 }} /><Corner style={{ bottom: 8, left: 8, borderBottomWidth: 2, borderLeftWidth: 2, borderBottomLeftRadius: 6 }} /><Corner style={{ bottom: 8, right: 8, borderBottomWidth: 2, borderRightWidth: 2, borderBottomRightRadius: 6 }} /></View>;
}

function Particle({ particle }) {
  const progress = useSharedValue(0);
  const reduceMotion = useReducedMotion();
  useEffect(() => {
    progress.value = reduceMotion ? 1 : withDelay(particle.delay, withTiming(1, { duration: particle.duration }));
  }, [progress, reduceMotion, particle]);
  const motion = useAnimatedStyle(() => ({ opacity: reduceMotion ? 0 : interpolate(progress.value, [0, 0.25, 1], [0, 0.7, 0]), transform: [{ translateY: interpolate(progress.value, [0, 1], [particle.startY, particle.startY - 180]) }] }));
  return <Animated.View style={[{ position: 'absolute', left: `${particle.x}%`, width: 3, height: 3, borderRadius: 2, backgroundColor: particle.color }, motion]} />;
}

export function ParticleEffect({ tier }) {
  const colors = TIER_PARTICLE_COLORS[tier.id] || ['#888'];
  const particles = useMemo(() => Array.from({ length: PARTICLE_COUNT }, (_, i) => ({ id: i, color: colors[i % colors.length], x: 8 + ((i * 37) % 84), startY: 80 + ((i * 47) % 220), delay: i * 45, duration: 420 + (i % 3) * 70 })), [tier.id]);
  if (!tier.effects.particles) return null;
  return <View style={[StyleSheet.absoluteFill, { pointerEvents: 'none', overflow: 'hidden' }]}>{particles.map(particle => <Particle key={particle.id} particle={particle} />)}</View>;
}

export function AnimatedBorder({ tier }) {
  const colors = TIER_ANIMATED_BORDER_COLORS[tier.id];
  const progress = useSharedValue(0);
  const reduceMotion = useReducedMotion();
  useEffect(() => {
    progress.value = reduceMotion ? 0 : withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) });
  }, [progress, reduceMotion]);
  const motionX = useAnimatedStyle(() => ({ transform: [{ translateX: interpolate(progress.value, [0, 1], [0, -96]) }] }));
  if (!colors || !tier.effects.animatedBorder) return null;
  const segments = Array.from({ length: SEGMENT_COUNT * 4 }, (_, index) => <View key={index} style={{ width: 24, height: 2, backgroundColor: colors[index % colors.length] }} />);
  return <View style={[StyleSheet.absoluteFill, { pointerEvents: 'none', borderRadius: tier.frame.borderRadius, overflow: 'hidden' }]}><Animated.View style={[{ position: 'absolute', top: 0, left: 0, width: 768, height: 2, flexDirection: 'row' }, motionX]}>{segments}</Animated.View></View>;
}

export function AnimatedBackground({ tier }) {
  const dots = useMemo(() => Array.from({ length: 24 }, (_, i) => ({ id: i, x: (i * 41) % 100, y: (i * 67) % 100, size: 1 + (i % 3) * 0.6, opacity: 0.05 + (i % 4) * 0.025 })), [tier.id]);
  if (!tier.effects.animatedBackground) return null;
  return <View style={[StyleSheet.absoluteFill, { pointerEvents: 'none', overflow: 'hidden', borderRadius: tier.frame.borderRadius }]}>{dots.map(dot => <View key={dot.id} style={{ position: 'absolute', left: `${dot.x}%`, top: `${dot.y}%`, width: dot.size, height: dot.size, borderRadius: dot.size / 2, backgroundColor: tier.palette.primary, opacity: dot.opacity }} />)}</View>;
}

function BurstParticle({ item, cx, cy, color }) {
  const progress = useSharedValue(0);
  const reduceMotion = useReducedMotion();
  useEffect(() => { progress.value = reduceMotion ? 1 : withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) }); }, [progress, reduceMotion]);
  const motion = useAnimatedStyle(() => ({ opacity: interpolate(progress.value, [0, 0.35, 1], [1, 1, 0]), transform: [{ translateX: item.dx * progress.value }, { translateY: item.dy * progress.value }, { scale: 1 - progress.value }] }));
  return <Animated.View style={[{ position: 'absolute', left: cx - item.size / 2, top: cy - item.size / 2, width: item.size, height: item.size, borderRadius: item.size / 2, backgroundColor: color }, motion]} />;
}

export function ParticleBurst({ tier, cardWidth, cardHeight, onComplete }) {
  const reduceMotion = useReducedMotion();
  const particles = useMemo(() => Array.from({ length: 12 }, (_, i) => { const angle = (i / 12) * Math.PI * 2; const distance = 70 + (i % 4) * 14; return { id: i, dx: Math.cos(angle) * distance, dy: Math.sin(angle) * distance, size: 2 + (i % 3) }; }), []);
  useEffect(() => {
    if (!tier.effects.particleBurst) return;
    if (reduceMotion) { onComplete?.(); return; }
    const timer = setTimeout(() => onComplete?.(), 320);
    return () => clearTimeout(timer);
  }, [tier.effects.particleBurst, onComplete, reduceMotion]);
  if (!tier.effects.particleBurst) return null;
  return <View style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}>{particles.map(item => <BurstParticle key={item.id} item={item} cx={cardWidth / 2} cy={cardHeight / 2} color={tier.palette.primary} />)}</View>;
}
