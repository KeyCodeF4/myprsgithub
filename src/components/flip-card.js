import React from 'react';
import { StyleSheet, View, AccessibilityInfo } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';

const FLIP_DURATION = 460;
const PERSPECTIVE = 1200;

/**
 * 3D flip container.
 *
 * Notes on the tricky parts:
 * - The back face is pre-rotated 180°, so when the container reaches 180° the
 *   back reads the right way round instead of mirrored.
 * - `backfaceVisibility` is unreliable across RN platforms, so visibility is
 *   driven explicitly by opacity AND pointerEvents. That also guarantees the
 *   hidden face can never intercept touches.
 * - Flipping is triggered by the parent (via a Tap gesture composed with the
 *   deck's Pan gesture) so a swipe never flips and a tap never swipes.
 */
export default function FlipCard({
  flipProgress,          // shared value, 0 = front, 1 = back
  front,
  back,
  width,
  height,
  isFlipped = false,
  reduceMotion = false,
}) {
  const rotation = useDerivedValue(() => flipProgress.value * 180);

  const frontStyle = useAnimatedStyle(() => {
    const angle = rotation.value;
    const visible = angle < 90;
    return {
      transform: [{ perspective: PERSPECTIVE }, { rotateY: `${angle}deg` }],
      opacity: visible ? 1 : 0,
    };
  });

  const backStyle = useAnimatedStyle(() => {
    const angle = rotation.value;
    const visible = angle >= 90;
    return {
      transform: [{ perspective: PERSPECTIVE }, { rotateY: `${angle + 180}deg` }],
      opacity: visible ? 1 : 0,
    };
  });

  return (
    <View style={{ width, height }}>
      <Animated.View
        accessibilityElementsHidden={isFlipped}
        importantForAccessibility={isFlipped ? 'no-hide-descendants' : 'yes'}
        style={[styles.face, { width, height, pointerEvents: isFlipped ? 'none' : 'auto' }, frontStyle]}
      >
        {front}
      </Animated.View>
      <Animated.View
        accessibilityElementsHidden={!isFlipped}
        importantForAccessibility={isFlipped ? 'yes' : 'no-hide-descendants'}
        style={[styles.face, { width, height, pointerEvents: isFlipped ? 'auto' : 'none' }, backStyle]}
      >
        {back}
      </Animated.View>
    </View>
  );
}

/** Drives a flip shared value, honouring the OS reduce-motion setting. */
export function flipTo(flipProgress, toBack, reduceMotion = false) {
  flipProgress.value = withTiming(toBack ? 1 : 0, {
    duration: reduceMotion ? 0 : FLIP_DURATION,
    easing: Easing.inOut(Easing.cubic),
  });
}

export function useReduceMotion() {
  const [reduce, setReduce] = React.useState(false);
  React.useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then(value => { if (mounted) setReduce(!!value); })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', value => setReduce(!!value));
    return () => {
      mounted = false;
      sub?.remove?.();
    };
  }, []);
  return reduce;
}

const styles = StyleSheet.create({
  face: { position: 'absolute', top: 0, left: 0, backfaceVisibility: 'hidden' },
});
