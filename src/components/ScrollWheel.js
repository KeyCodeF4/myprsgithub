import React, { useEffect, useCallback, useRef, useState } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { getWheelIndexForOffset, WHEEL_ITEM_HEIGHT } from '../utils/scroll-wheel';

const ITEM_HEIGHT = WHEEL_ITEM_HEIGHT;
const VISIBLE_ITEMS = 3;

export default function ScrollWheel({ options, value, onSelect, suffix = '', textColor, selectedBg }) {
  const theme = useTheme();
  const resolvedTextColor = textColor || theme.textSecondary;
  const resolvedSelectedBg = selectedBg || theme.selectedBg;
  const listRef = useRef(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selectedIndexRef = useRef(0);
  const lastOffsetRef = useRef(ITEM_HEIGHT);
  const wheelTimerRef = useRef(null);

  const data = ['', ...options, ''];

  const selectIndex = useCallback((nextIndex, scrollToSelection = false) => {
    if (options.length === 0) return;
    const clamped = Math.max(0, Math.min(nextIndex, options.length - 1));
    if (clamped !== selectedIndexRef.current) {
      selectedIndexRef.current = clamped;
      setSelectedIndex(clamped);
      onSelect(options[clamped]);
    }
    if (scrollToSelection) {
      const offset = (clamped + 1) * ITEM_HEIGHT;
      lastOffsetRef.current = offset;
      listRef.current?.scrollToOffset({ offset, animated: true });
    }
  }, [options, onSelect]);

  const selectFromOffset = useCallback((offsetY, snap = false) => {
    lastOffsetRef.current = offsetY;
    const nextIndex = getWheelIndexForOffset(offsetY, options.length);
    if (nextIndex >= 0) selectIndex(nextIndex, snap);
  }, [options.length, selectIndex]);

  const handleScroll = useCallback((e) => {
    selectFromOffset(e.nativeEvent.contentOffset.y, false);
  }, [selectFromOffset]);

  const handleScrollEnd = useCallback((e) => {
    selectFromOffset(e.nativeEvent.contentOffset.y, true);
  }, [selectFromOffset]);

  // Browsers do not consistently emit momentum/end-drag events for mouse-wheel
  // input. Track every scroll frame, then snap to the nearest value after the
  // wheel settles so weight/reps are actually committed on desktop.
  const handleWheel = useCallback(() => {
    if (wheelTimerRef.current) clearTimeout(wheelTimerRef.current);
    wheelTimerRef.current = setTimeout(() => {
      const nextIndex = getWheelIndexForOffset(lastOffsetRef.current, options.length);
      if (nextIndex >= 0) selectIndex(nextIndex, true);
    }, 90);
  }, [options.length, selectIndex]);

  const handleKeyDown = useCallback((e) => {
    const key = e?.nativeEvent?.key;
    if (key !== 'ArrowUp' && key !== 'ArrowDown') return;
    e.preventDefault?.();
    selectIndex(selectedIndexRef.current + (key === 'ArrowDown' ? 1 : -1), true);
  }, [selectIndex]);

  const handleAccessibilityAction = useCallback((e) => {
    if (e.nativeEvent.actionName === 'increment') selectIndex(selectedIndexRef.current + 1, true);
    if (e.nativeEvent.actionName === 'decrement') selectIndex(selectedIndexRef.current - 1, true);
  }, [selectIndex]);

  const renderItem = useCallback(({ item, index }) => {
    const realIndex = index - 1;
    const isSelected = realIndex === selectedIndex;
    if (item === '') return <View style={{ height: ITEM_HEIGHT }} />;
    const displayText = `${item}${suffix}`;
    return (
      <View style={[styles.item, { height: ITEM_HEIGHT }]}>
        <View style={[
          styles.itemInner,
          isSelected && { backgroundColor: resolvedSelectedBg }
        ]}>
          <Text style={[
            styles.itemText,
            { color: resolvedTextColor, fontSize: 19 },
            isSelected && { color: theme.primary, fontSize: 22, fontWeight: '700' }
          ]}>
            {displayText}
          </Text>
        </View>
      </View>
    );
  }, [selectedIndex, suffix, theme, resolvedTextColor, resolvedSelectedBg]);

  const getItemLayout = useCallback((_, index) => ({
    length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index,
  }), []);

  useEffect(() => {
    if (listRef.current) {
      setTimeout(() => {
        listRef.current?.scrollToOffset({ offset: ITEM_HEIGHT, animated: false });
      }, 50);
    }
  }, []);

  useEffect(() => () => {
    if (wheelTimerRef.current) clearTimeout(wheelTimerRef.current);
  }, []);

  useEffect(() => {
    if (value !== undefined && value !== null) {
      const idx = options.indexOf(value);
      if (idx >= 0 && idx !== selectedIndex) {
        selectedIndexRef.current = idx;
        setSelectedIndex(idx);
        const offset = (idx + 1) * ITEM_HEIGHT;
        lastOffsetRef.current = offset;
        listRef.current?.scrollToOffset({ offset, animated: false });
      }
    }
  }, [options, selectedIndex, value]);

  return (
    <View
      style={styles.wrapper}
      pointerEvents="box-none"
      onWheel={handleWheel}
      onKeyDown={handleKeyDown}
      focusable
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="Select value"
      accessibilityValue={{ text: `${options[selectedIndex] ?? ''}${suffix}` }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={handleAccessibilityAction}
    >
      <View style={[styles.container, { height: ITEM_HEIGHT * VISIBLE_ITEMS }]}>
        <FlatList
          ref={listRef}
          data={data}
          renderItem={renderItem}
          keyExtractor={(_, i) => String(i)}
          snapToInterval={ITEM_HEIGHT}
          snapToAlignment="start"
          decelerationRate="fast"
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
          onScrollEndDrag={handleScrollEnd}
          onMomentumScrollEnd={handleScrollEnd}
          onWheel={handleWheel}
          scrollEventThrottle={16}
          getItemLayout={getItemLayout}
          contentContainerStyle={{ paddingVertical: ITEM_HEIGHT }}
          bounces={false}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center', width: '100%', paddingHorizontal: 24 },
  container: { justifyContent: 'center', overflow: 'hidden', width: '100%', maxWidth: 360 },
  item: { justifyContent: 'center', alignItems: 'center', paddingHorizontal: 12 },
  itemInner: {
    paddingVertical: 10, paddingHorizontal: 24, borderRadius: 12,
  },
  itemText: { fontWeight: '500' },
});
