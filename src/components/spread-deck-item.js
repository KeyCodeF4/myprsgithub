import React from 'react';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

// One continuous position drives a physical deck: the active card moves fully
// left, while the cards still to come remain stacked behind the next front card.
export default function SpreadDeckItem({
  cardIndex,
  deckPosition,
  width,
  height,
  stackOffset,
  spreadOffset,
  stackScale,
  isInteractive,
  gesture,
  children,
}) {
  const animatedStyle = useAnimatedStyle(() => {
    const relativePosition = cardIndex - deckPosition.value;
    const isAlreadyViewed = relativePosition < 0;
    const distance = Math.abs(relativePosition);
    const scale = isAlreadyViewed
      ? 1
      : Math.max(0.88, 1 - distance * stackScale);

    const viewedOpacity = Math.max(0.12, 0.4 - Math.max(0, distance - 1) * 0.1);

    return {
      // Whichever card is closest to the selected position owns the front layer.
      zIndex: Math.max(1, 1000 - Math.round(distance * 100)),
      opacity: isAlreadyViewed
        ? viewedOpacity
        : Math.max(0.82, 1 - distance * 0.025),
      transform: [
        {
          // Completed cards clear the current card by its full width. Cards yet
          // to be viewed retain the compact deck offset instead of spreading.
          translateX: isAlreadyViewed
            ? relativePosition * spreadOffset
            : relativePosition * stackOffset,
        },
        { scale },
      ],
    };
  });

  const cardView = (
    <Animated.View
      style={[
        {
          position: 'absolute',
          top: 0,
          left: 0,
          width,
          height,
          pointerEvents: isInteractive ? 'auto' : 'none',
        },
        animatedStyle,
      ]}
    >
      {children}
    </Animated.View>
  );

  return gesture ? <GestureDetector gesture={gesture}>{cardView}</GestureDetector> : cardView;
}
