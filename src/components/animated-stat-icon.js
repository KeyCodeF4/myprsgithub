import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

export function getStatIconType(fact) {
  const source = `${fact?.id || ''} ${fact?.label || ''}`.toLowerCase();
  if (source.includes('streak')) return 'streak';
  if (source.includes('volume')) return 'volume';
  if (source.includes('weight') || source.includes('heavy') || source.includes('heaviest') || source.includes('lift') || source.includes('1rm')) return 'strength';
  if (source.includes('record') || /\bpr\b/.test(source)) return 'record';
  if (source.includes('calor')) return 'energy';
  if (source.includes('duration') || source.includes('time')) return 'time';
  if (source.includes('rep')) return 'reps';
  if (source.includes('set')) return 'sets';
  if (source.includes('frequency') || source.includes('workout') || source.includes('days')) return 'frequency';
  if (source.includes('distance')) return 'distance';
  if (source.includes('muscle') || source.includes('body')) return 'muscle';
  return 'progress';
}

function Flame({ size, color, phase }) {
  const outerStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(phase.value, [0, 1], [0, -size * 0.035]) },
      { rotateZ: `${interpolate(phase.value, [0, 1], [0, -5])}deg` },
      { scaleX: interpolate(phase.value, [0, 1], [1, 0.94]) },
      { scaleY: interpolate(phase.value, [0, 1], [1, 1.1]) },
    ],
  }));
  const innerStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(phase.value, [0, 1], [0, size * 0.045]) },
      { translateY: interpolate(phase.value, [0, 1], [0, -size * 0.025]) },
      { rotateZ: `${interpolate(phase.value, [0, 1], [0, 5])}deg` },
      { scaleY: interpolate(phase.value, [0, 1], [1, 1.16]) },
    ],
  }));

  return (
    <View style={{ width: size, height: size }}>
      <Animated.View style={[StyleSheet.absoluteFill, outerStyle]}>
        <Svg width={size} height={size} viewBox="0 0 100 100">
          <Path
            d="M51 3 C59 20 76 27 72 48 C83 42 91 55 87 70 C82 89 66 98 50 98 C30 98 14 86 14 67 C14 51 23 40 37 31 C35 45 42 51 48 43 C56 32 42 19 51 3 Z"
            fill={color}
          />
          <Path
            d="M48 32 C58 42 72 51 68 67 C76 62 78 74 72 83 C66 92 56 96 47 94 C34 92 26 82 28 70 C30 60 37 54 44 48 C42 58 48 62 53 57 C58 51 48 42 48 32 Z"
            fill="#FF7A1A"
          />
        </Svg>
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, innerStyle]}>
        <Svg width={size} height={size} viewBox="0 0 100 100">
          <Path
            d="M50 52 C56 62 64 67 61 78 C65 76 67 82 64 87 C60 93 53 96 47 93 C38 90 36 82 39 75 C41 69 46 66 48 61 C48 67 52 69 55 66 C57 62 51 57 50 52 Z"
            fill="#FFD166"
          />
        </Svg>
      </Animated.View>
    </View>
  );
}

function StrengthLifter({ size, color, phase }) {
  const liftStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(phase.value, [0, 1], [size * 0.32, 0]) }],
  }));
  const restPoseStyle = useAnimatedStyle(() => ({
    opacity: interpolate(phase.value, [0, 0.42, 0.72], [1, 1, 0], 'clamp'),
  }));
  const lockoutPoseStyle = useAnimatedStyle(() => ({
    opacity: interpolate(phase.value, [0.28, 0.62, 1], [0, 0, 1], 'clamp'),
  }));

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Circle cx="50" cy="30" r="8" fill={`${color}25`} stroke={color} strokeWidth="4" />
        <Path d="M50 39 L50 67 M50 67 L34 91 M50 67 L66 91" fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        <Line x1="43" y1="43" x2="57" y2="43" stroke={color} strokeWidth="5" strokeLinecap="round" />
      </Svg>
      <Animated.View style={[StyleSheet.absoluteFill, restPoseStyle]}>
        <Svg width={size} height={size} viewBox="0 0 100 100">
          <Path d="M46 44 L35 55 L27 48 M54 44 L65 55 L73 48" fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, lockoutPoseStyle]}>
        <Svg width={size} height={size} viewBox="0 0 100 100">
          <Path d="M46 44 L36 30 L28 16 M54 44 L64 30 L72 16" fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, liftStyle]}>
        <Svg width={size} height={size} viewBox="0 0 100 100">
          <Line x1="11" y1="16" x2="89" y2="16" stroke={color} strokeWidth="4" strokeLinecap="round" />
          <Rect x="8" y="7" width="7" height="18" rx="2" fill={color} />
          <Rect x="16" y="10" width="5" height="12" rx="2" fill={color} />
          <Rect x="79" y="10" width="5" height="12" rx="2" fill={color} />
          <Rect x="85" y="7" width="7" height="18" rx="2" fill={color} />
        </Svg>
      </Animated.View>
    </View>
  );
}

function StackPlate({ size, color, phase, index }) {
  const start = index * 0.17;
  const end = start + 0.3;
  const targetY = 78 - index * 15;
  const width = 78 - index * 4;
  const x = (100 - width) / 2;
  const plateStyle = useAnimatedStyle(() => ({
    opacity: interpolate(phase.value, [start, end], [0, 1], 'clamp'),
    transform: [{ translateY: interpolate(phase.value, [start, end], [-size * 0.46, 0], 'clamp') }],
  }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, plateStyle]}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Rect x={x} y={targetY} width={width} height="12" rx="6" fill={index === 0 ? `${color}42` : '#090A0D'} stroke={color} strokeWidth="3.5" />
        <Rect x="45" y={targetY + 4} width="10" height="4" rx="2" fill={color} />
      </Svg>
    </Animated.View>
  );
}

function VolumeStack({ size, color, phase }) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center' }}>
      {[0, 1, 2, 3].map(index => <StackPlate key={index} index={index} size={size} color={color} phase={phase} />)}
    </View>
  );
}

function Trophy({ size, color }) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center' }}>
      <View style={{ width: size * 0.58, height: size * 0.43, marginTop: size * 0.1, borderWidth: Math.max(1.5, size * 0.05), borderColor: color, borderBottomLeftRadius: size * 0.25, borderBottomRightRadius: size * 0.25, backgroundColor: `${color}20` }} />
      <View style={{ width: size * 0.07, height: size * 0.2, backgroundColor: color }} />
      <View style={{ width: size * 0.48, height: size * 0.08, borderRadius: size * 0.04, backgroundColor: color }} />
      <View style={[styles.trophyHandle, { left: size * 0.08, top: size * 0.17, width: size * 0.22, height: size * 0.25, borderColor: color, borderWidth: Math.max(1.5, size * 0.05) }]} />
      <View style={[styles.trophyHandle, { right: size * 0.08, top: size * 0.17, width: size * 0.22, height: size * 0.25, borderColor: color, borderWidth: Math.max(1.5, size * 0.05) }]} />
    </View>
  );
}

function Clock({ size, color }) {
  return (
    <View style={{ width: size * 0.82, height: size * 0.82, borderRadius: size, borderWidth: Math.max(1.5, size * 0.055), borderColor: color, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ position: 'absolute', width: size * 0.055, height: size * 0.26, borderRadius: size, backgroundColor: color, transform: [{ translateY: -size * 0.1 }] }} />
      <View style={{ position: 'absolute', width: size * 0.24, height: size * 0.055, borderRadius: size, backgroundColor: color, transform: [{ translateX: size * 0.09 }, { translateY: size * 0.05 }, { rotateZ: '35deg' }] }} />
      <View style={{ width: size * 0.11, height: size * 0.11, borderRadius: size, backgroundColor: color }} />
    </View>
  );
}

function ListIcon({ size, color }) {
  return (
    <View style={{ width: size * 0.82, height: size * 0.7, justifyContent: 'space-between' }}>
      {[0, 1, 2].map(index => <View key={index} style={{ height: size * 0.12, flexDirection: 'row', alignItems: 'center', gap: size * 0.12 }}><View style={{ width: size * 0.12, height: size * 0.12, borderRadius: size, backgroundColor: color }} /><View style={{ flex: 1, height: size * 0.065, borderRadius: size, backgroundColor: color, opacity: 1 - index * 0.18 }} /></View>)}
    </View>
  );
}

function Layers({ size, color }) {
  return (
    <View style={{ width: size, height: size }}>
      {[2, 1, 0].map(index => <View key={index} style={{ position: 'absolute', width: size * 0.64, height: size * 0.46, left: size * (0.1 + index * 0.08), top: size * (0.28 - index * 0.08), borderWidth: Math.max(1.5, size * 0.045), borderRadius: size * 0.11, borderColor: color, backgroundColor: index === 0 ? `${color}25` : '#090A0D' }} />)}
    </View>
  );
}

function Calendar({ size, color }) {
  return (
    <View style={{ width: size * 0.82, height: size * 0.76, borderWidth: Math.max(1.5, size * 0.05), borderRadius: size * 0.12, borderColor: color, padding: size * 0.12, paddingTop: size * 0.25, flexDirection: 'row', flexWrap: 'wrap', gap: size * 0.07 }}>
      <View style={{ position: 'absolute', left: -2, right: -2, top: size * 0.18, height: Math.max(1.5, size * 0.05), backgroundColor: color }} />
      {[0, 1, 2, 3, 4, 5].map(index => <View key={index} style={{ width: size * 0.105, height: size * 0.105, borderRadius: size * 0.025, backgroundColor: color, opacity: index === 4 ? 1 : 0.42 }} />)}
    </View>
  );
}

function Route({ size, color }) {
  return (
    <View style={{ width: size, height: size }}>
      <View style={{ position: 'absolute', width: size * 0.62, height: Math.max(2, size * 0.065), left: size * 0.18, top: size * 0.48, borderRadius: size, backgroundColor: color, transform: [{ rotateZ: '-28deg' }] }} />
      <View style={{ position: 'absolute', width: size * 0.26, height: Math.max(2, size * 0.065), left: size * 0.4, top: size * 0.31, borderRadius: size, backgroundColor: color, transform: [{ rotateZ: '34deg' }] }} />
      <View style={{ position: 'absolute', width: size * 0.23, height: size * 0.23, left: size * 0.08, bottom: size * 0.16, borderRadius: size, borderWidth: Math.max(1.5, size * 0.055), borderColor: color, backgroundColor: '#090A0D' }} />
      <View style={{ position: 'absolute', width: size * 0.23, height: size * 0.23, right: size * 0.07, top: size * 0.11, borderRadius: size, backgroundColor: color }} />
    </View>
  );
}

function Energy({ size, color }) {
  return <View style={{ width: size * 0.38, height: size * 0.74, backgroundColor: color, transform: [{ skewY: '-18deg' }, { rotateZ: '12deg' }], borderTopRightRadius: size * 0.08, borderBottomLeftRadius: size * 0.08 }}><View style={{ position: 'absolute', width: size * 0.42, height: size * 0.25, left: -size * 0.19, top: size * 0.29, backgroundColor: '#090A0D', transform: [{ skewY: '18deg' }] }} /></View>;
}

function Person({ size, color }) {
  return <View style={{ width: size, height: size, alignItems: 'center' }}><View style={{ width: size * 0.34, height: size * 0.34, borderRadius: size, borderWidth: Math.max(1.5, size * 0.055), borderColor: color }} /><View style={{ width: size * 0.7, height: size * 0.36, marginTop: size * 0.08, borderTopLeftRadius: size, borderTopRightRadius: size, borderWidth: Math.max(1.5, size * 0.055), borderBottomWidth: 0, borderColor: color }} /></View>;
}

function Battle({ size, color }) {
  return <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}><View style={{ position: 'absolute', width: size * 0.78, height: size * 0.1, borderRadius: size, backgroundColor: color, transform: [{ rotateZ: '45deg' }] }} /><View style={{ position: 'absolute', width: size * 0.78, height: size * 0.1, borderRadius: size, backgroundColor: color, transform: [{ rotateZ: '-45deg' }] }} /><View style={{ position: 'absolute', width: size * 0.2, height: size * 0.2, borderWidth: Math.max(1.5, size * 0.05), borderColor: color, transform: [{ rotateZ: '45deg' }] }} /></View>;
}

function Progress({ size, color }) {
  return <View style={{ width: size * 0.78, height: size * 0.7, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>{[0.42, 0.68, 1].map((height, index) => <View key={height} style={{ width: size * 0.17, height: size * 0.62 * height, borderRadius: size * 0.07, backgroundColor: color, opacity: 0.5 + index * 0.25 }} />)}</View>;
}

function Glyph({ type, size, color, phase }) {
  if (type === 'streak') return <Flame size={size} color={color} phase={phase} />;
  if (type === 'strength') return <StrengthLifter size={size} color={color} phase={phase} />;
  if (type === 'volume') return <VolumeStack size={size} color={color} phase={phase} />;
  if (type === 'record') return <Trophy size={size} color={color} />;
  if (type === 'time') return <Clock size={size} color={color} />;
  if (type === 'reps' || type === 'menu') return <ListIcon size={size} color={color} />;
  if (type === 'sets' || type === 'archive' || type === 'locker') return <Layers size={size} color={color} />;
  if (type === 'frequency') return <Calendar size={size} color={color} />;
  if (type === 'distance') return <Route size={size} color={color} />;
  if (type === 'energy') return <Energy size={size} color={color} />;
  if (type === 'profile') return <Person size={size} color={color} />;
  if (type === 'battle') return <Battle size={size} color={color} />;
  return <Progress size={size} color={color} />;
}

export default function AnimatedStatIcon({ type = 'progress', size = 52, color = '#E63946', accessibilityLabel, playKey }) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(1);
  const accent = useSharedValue(type === 'volume' ? 1 : 0);

  useEffect(() => {
    progress.value = 1;
    if (reduceMotion) {
      accent.value = type === 'volume' ? 1 : 0;
      return;
    }

    progress.value = 0;
    progress.value = withTiming(1, { duration: 90 });
    accent.value = 0;

    if (type === 'strength') {
      // One complete rep: bar travels from the chest to lockout, then returns.
      accent.value = withDelay(40, withSequence(
        withTiming(1, { duration: 310, easing: Easing.out(Easing.cubic) }),
        withTiming(0, { duration: 280, easing: Easing.inOut(Easing.cubic) }),
      ));
    } else if (type === 'volume') {
      // Plates land one at a time and remain stacked when the animation ends.
      accent.value = withDelay(60, withTiming(1, { duration: 1080, easing: Easing.out(Easing.cubic) }));
    } else if (type === 'streak') {
      // A short flame flicker, not a permanent pulse.
      accent.value = withDelay(40, withSequence(
        withTiming(1, { duration: 100 }),
        withTiming(0.15, { duration: 95 }),
        withTiming(0.88, { duration: 105 }),
        withTiming(0.08, { duration: 100 }),
        withTiming(0.68, { duration: 110 }),
        withTiming(0, { duration: 140, easing: Easing.out(Easing.cubic) }),
      ));
    } else {
      accent.value = withDelay(40, withSequence(
        withTiming(1, { duration: 150, easing: Easing.out(Easing.cubic) }),
        withTiming(0, { duration: 170, easing: Easing.inOut(Easing.cubic) }),
      ));
    }
  }, [type, playKey, progress, accent, reduceMotion]);

  const entrance = useAnimatedStyle(() => ({ opacity: progress.value }));
  const gesture = useAnimatedStyle(() => {
    if (type === 'streak' || type === 'strength' || type === 'volume') return {};
    if (type === 'record') return { transform: [{ rotateZ: `${interpolate(accent.value, [0, 1], [0, 7])}deg` }, { scale: interpolate(accent.value, [0, 1], [1, 1.06]) }] };
    if (type === 'time') return { transform: [{ rotateZ: `${interpolate(accent.value, [0, 1], [0, 18])}deg` }] };
    if (type === 'frequency') return { transform: [{ translateY: interpolate(accent.value, [0, 1], [0, -3]) }] };
    return { transform: [{ scale: interpolate(accent.value, [0, 1], [1, 1.05]) }] };
  });

  return (
    <Animated.View accessible={!!accessibilityLabel} accessibilityLabel={accessibilityLabel} style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, entrance]}>
      <Animated.View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, gesture]}><Glyph type={type} size={size} color={color} phase={accent} /></Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  trophyHandle: { position: 'absolute', borderRadius: 999 },
});
