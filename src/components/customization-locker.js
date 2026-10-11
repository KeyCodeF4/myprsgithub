import React, { useMemo, useRef, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInUp, LinearTransition } from 'react-native-reanimated';
import { useTheme } from '../context/ThemeContext';
import { useWorkouts } from '../context/WorkoutContext';
import { RARITY_COLORS } from '../data/medalsConfig';
import { resolveUnlockedMedals, MAX_EQUIPPED_MEDALS } from '../utils/equippedMedals';

const TABS = [
  { id: 'titles', label: 'Titles' },
  { id: 'themes', label: 'Themes' },
  { id: 'medals', label: 'Medals' },
];

// One visual language for equipped / owned / locked across every tab, so the
// state of an item is readable at a glance without reading the label.
function StatePill({ state, lockedLabel = 'LOCKED', accent, mutedColor }) {
  if (state === 'equipped') {
    return (
      <View style={[styles.pill, { backgroundColor: accent }]}>
        <Text style={[styles.pillText, { color: '#0A0A0A' }]}>✓ EQUIPPED</Text>
      </View>
    );
  }
  if (state === 'owned') {
    return (
      <View style={[styles.pill, styles.pillOutline, { borderColor: accent }]}>
        <Text style={[styles.pillText, { color: accent }]}>EQUIP</Text>
      </View>
    );
  }
  return (
    <View style={[styles.pill, styles.pillOutline, { borderColor: mutedColor }]}>
      <Text style={[styles.pillText, { color: mutedColor }]}>🔒 {lockedLabel}</Text>
    </View>
  );
}

export default function CustomizationLocker({ visible, onClose, onOpenMedals, onCreateTitle }) {
  const theme = useTheme();
  const { earnedTitles, equippedTitle, equipTitle, medals, equippedMedals, togglePin, xpProgress } = useWorkouts();
  const [tab, setTab] = useState('titles');
  const [notice, setNotice] = useState(null);
  const [selectedMedalId, setSelectedMedalId] = useState(null);
  const lockerScrollRef = useRef(null);

  const level = xpProgress?.level || 1;

  const uniqueTitles = useMemo(() => {
    const byId = new Map();
    for (const title of earnedTitles || []) byId.set(title.id, title);
    return [...byId.values()].reverse();
  }, [earnedTitles]);

  // Hydrated + de-duplicated, so a removed/legacy medal id can't render a blank tile.
  const unlockedMedals = useMemo(() => resolveUnlockedMedals(medals), [medals]);
  const equippedIds = useMemo(() => equippedMedals.map(m => m.id), [equippedMedals]);
  const selectedMedal = useMemo(
    () => unlockedMedals.find(medal => medal.id === selectedMedalId) || null,
    [selectedMedalId, unlockedMedals]
  );

  const showNotice = message => {
    setNotice(message);
    setTimeout(() => setNotice(current => (current === message ? null : current)), 2200);
  };

  const handleToggleMedal = async medal => {
    const result = await togglePin(medal.id);
    if (result?.reason === 'limit') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      showNotice(`All ${MAX_EQUIPPED_MEDALS} slots are full — unequip one first.`);
      return;
    }
    Haptics.impactAsync(
      result?.equipped ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light
    );
    showNotice(result?.equipped ? `${medal.name} equipped` : `${medal.name} unequipped`);
  };

  const handleSelectMedal = medal => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const openingDetails = selectedMedalId !== medal.id;
    setSelectedMedalId(openingDetails ? medal.id : null);
    if (openingDetails) {
      setTimeout(() => lockerScrollRef.current?.scrollTo({ y: 0, animated: true }), 50);
    }
  };

  const handleEquipTitle = async title => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await equipTitle(title);
  };

  const handleEquipTheme = async id => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await theme.equipTheme(id);
  };

  const renderTitles = () => (
    <View style={styles.list}>
      <Text style={[styles.explainer, { color: theme.textSecondary }]}>Equip a title for future cards. Existing Wrapped cards keep the title they were created with.</Text>
      {uniqueTitles.map((title, index) => {
        const equipped = equippedTitle?.id === title.id;
        return (
          <Animated.View key={title.id} entering={FadeInUp.delay(Math.min(index, 3) * 45).duration(220)} layout={LinearTransition}>
            <TouchableOpacity
              style={[styles.inventoryRow, { backgroundColor: theme.home.surfaceSecondary, borderColor: equipped ? theme.primary : theme.home.border }]}
              onPress={() => handleEquipTitle(title)}
              activeOpacity={0.75}
            >
              <View style={styles.rowCopy}>
                <Text style={[styles.inventoryName, { color: '#FFF' }]}>{title.text}</Text>
                <Text style={[styles.inventoryMeta, { color: theme.textSecondary }]}>{title.custom ? 'ORIGINAL TITLE' : (title.category || 'EARNED').replaceAll('_', ' ').toUpperCase()}</Text>
              </View>
              <StatePill
                state={equipped ? 'equipped' : 'owned'}
                accent={theme.primary}
                mutedColor={theme.textSecondary}
              />
            </TouchableOpacity>
          </Animated.View>
        );
      })}
      {uniqueTitles.length === 0 && (
        <>
          <Text style={[styles.empty, { color: theme.textSecondary }]}>Create a title and stamp it onto your first Wrapped.</Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Create your first title"
            onPress={onCreateTitle}
            activeOpacity={0.82}
            style={[styles.manageButton, { backgroundColor: theme.primary }]}
          >
            <Text style={styles.manageButtonText}>Create my first title</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );

  const renderThemes = () => (
    <View style={styles.list}>
      <Text style={[styles.explainer, { color: theme.textSecondary }]}>Themes recolour the app. Keep levelling to unlock rarer palettes — you are level {level}.</Text>
      {theme.availableThemes.map((item, index) => {
        const unlocked = theme.unlockedThemeIds.includes(item.id);
        const equipped = theme.themeId === item.id;
        return (
          <Animated.View key={item.id} entering={FadeInUp.delay(Math.min(index, 3) * 45).duration(220)}>
            <TouchableOpacity
              style={[styles.themeRow, { backgroundColor: item.home.surface, borderColor: equipped ? item.primary : item.home.border, opacity: unlocked ? 1 : 0.55 }]}
              onPress={() => (unlocked ? handleEquipTheme(item.id) : showNotice(item.unlockDescription))}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel={`${item.name} theme, ${unlocked ? (equipped ? 'equipped' : 'unlocked') : `locked until level ${item.requiredLevel}`}`}
            >
              <View style={[styles.themeSwatch, { backgroundColor: item.primary }]} />
              <View style={styles.rowCopy}>
                <Text style={styles.inventoryName}>{item.name}</Text>
                <Text style={[styles.inventoryMeta, { color: item.home.textSecondary }]}>
                  {unlocked ? (equipped ? 'EQUIPPED' : 'UNLOCKED') : item.unlockDescription.toUpperCase()}
                </Text>
              </View>
              <StatePill
                state={equipped ? 'equipped' : unlocked ? 'owned' : 'locked'}
                lockedLabel={item.limited ? 'FOUNDERS' : `LVL ${item.requiredLevel}`}
                accent={item.primary}
                mutedColor={item.home.textSecondary}
              />
            </TouchableOpacity>
          </Animated.View>
        );
      })}
    </View>
  );

  const renderMedals = () => (
    <View style={styles.list}>
      <Text style={[styles.explainer, { color: theme.textSecondary }]}>
        {unlockedMedals.length} unlocked. Tap a medal to see what it means, then choose whether to show it on your cards. {equippedIds.length}/{MAX_EQUIPPED_MEDALS} slots used.
      </Text>
      {selectedMedal && (() => {
        const slot = equippedIds.indexOf(selectedMedal.id) + 1;
        const equipped = slot > 0;
        const rarity = RARITY_COLORS[selectedMedal.tier] || { border: theme.primary, text: '#FFF' };
        return (
          <Animated.View
            entering={FadeInUp.duration(180)}
            style={[styles.medalDetail, { backgroundColor: theme.home.surfaceSecondary, borderColor: rarity.border }]}
          >
            <View style={styles.medalDetailHeader}>
              <Text style={styles.medalDetailIcon}>{selectedMedal.icon}</Text>
              <View style={styles.medalDetailCopy}>
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.75}
                  style={styles.medalDetailName}
                >
                  {selectedMedal.name}
                </Text>
                <Text style={[styles.medalDetailMeta, { color: rarity.text || rarity.border }]}> 
                  {(selectedMedal.tier || 'earned').toUpperCase()}
                  {selectedMedal.serialNumber ? ` · #${String(selectedMedal.serialNumber).padStart(3, '0')} / 100` : ''}
                </Text>
              </View>
            </View>
            <Text style={[styles.medalDetailDescription, { color: theme.textSecondary }]}> 
              {selectedMedal.description || 'An earned medal from your training journey.'}
            </Text>
            <TouchableOpacity
              style={[styles.medalDetailButton, { borderColor: rarity.border }]}
              onPress={() => handleToggleMedal(selectedMedal)}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel={equipped ? `Remove ${selectedMedal.name} from cards` : `Show ${selectedMedal.name} on cards`}
            >
              <Text style={[styles.medalDetailButtonText, { color: rarity.text || rarity.border }]}> 
                {equipped ? 'Remove from Card' : 'Show on Card'}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        );
      })()}
      <View style={styles.medalGrid}>
        {unlockedMedals.map((medal, index) => {
          const slot = equippedIds.indexOf(medal.id) + 1;
          const equipped = slot > 0;
          const selected = selectedMedalId === medal.id;
          const rarity = RARITY_COLORS[medal.tier] || { border: theme.home.border, text: '#FFF' };
          return (
            <Animated.View key={medal.id} style={styles.medalCell} entering={FadeInUp.delay(Math.min(index, 3) * 35).duration(200)} layout={LinearTransition}>
              <TouchableOpacity
                style={[
                  styles.medalTile,
                  {
                    backgroundColor: theme.home.surfaceSecondary,
                    borderColor: selected || equipped ? rarity.border : theme.home.border,
                    borderWidth: selected ? 3 : equipped ? 2 : 1,
                  },
                ]}
                onPress={() => handleSelectMedal(medal)}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel={`${medal.name}, ${medal.tier} medal, ${equipped ? `shown on cards in slot ${slot}` : 'not shown on cards'}. Tap for details.`}
                accessibilityState={{ selected }}
              >
                <Text style={styles.medalIcon}>{medal.icon}</Text>
                {equipped && (
                  <View style={[styles.medalSlotBadge, { backgroundColor: rarity.border }]}>
                    <Text style={styles.medalSlotBadgeText}>{slot}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </View>
      {unlockedMedals.length === 0 && (
        <Text style={[styles.empty, { color: theme.textSecondary }]}>Earn your first medal to start building a loadout.</Text>
      )}
      <TouchableOpacity style={[styles.manageButton, { backgroundColor: theme.primary }]} onPress={() => { onClose(); setTimeout(onOpenMedals, 220); }}>
        <Text style={styles.manageButtonText}>View all medals & progress</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: theme.home.background }]}>
        <View style={[styles.header, { borderBottomColor: theme.home.separator }]}>
          <View>
            <Text style={[styles.eyebrow, { color: theme.primary }]}>COLLECTION</Text>
            <Text style={styles.title}>Your Locker</Text>
          </View>
          <TouchableOpacity style={[styles.close, { backgroundColor: theme.home.surfaceSecondary }]} onPress={onClose}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.tabs}>
          {TABS.map(item => (
            <TouchableOpacity key={item.id} onPress={() => setTab(item.id)} style={[styles.tab, { borderColor: tab === item.id ? theme.primary : theme.home.border, backgroundColor: tab === item.id ? theme.primaryBg : theme.home.surface }]}>
              <Text style={[styles.tabText, { color: tab === item.id ? theme.primary : theme.textSecondary }]}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <ScrollView ref={lockerScrollRef} contentContainerStyle={styles.scrollContent} contentInsetAdjustmentBehavior="automatic">
          {tab === 'titles' ? renderTitles() : tab === 'themes' ? renderThemes() : renderMedals()}
        </ScrollView>
        {notice && (
          <Animated.View
            entering={FadeInUp.duration(180)}
            style={[styles.notice, { backgroundColor: theme.home.surfaceSecondary, borderColor: theme.primary }]}
            pointerEvents="none"
          >
            <Text style={styles.noticeText}>{notice}</Text>
          </Animated.View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 22, paddingTop: 22, paddingBottom: 16, borderBottomWidth: 1 },
  eyebrow: { fontSize: 10, letterSpacing: 3, fontFamily: 'Inter_700Bold' },
  title: { color: '#FFF', fontSize: 28, fontFamily: 'Inter_700Bold', marginTop: 3 },
  close: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  closeText: { color: '#FFF', fontSize: 15, fontFamily: 'Inter_700Bold' },
  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 18, paddingTop: 16 },
  tab: { flex: 1, borderWidth: 1, borderRadius: 12, paddingVertical: 11, alignItems: 'center' },
  tabText: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  scrollContent: { padding: 18, paddingBottom: 40 },
  list: { gap: 10 },
  explainer: { fontSize: 13, lineHeight: 19, marginBottom: 8 },
  inventoryRow: { borderWidth: 1, borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowCopy: { flex: 1 },
  inventoryName: { color: '#FFF', fontSize: 16, fontFamily: 'Inter_700Bold' },
  inventoryMeta: { fontSize: 9, letterSpacing: 1.2, fontFamily: 'Inter_600SemiBold', marginTop: 5 },
  equipState: { fontSize: 10, letterSpacing: 1.1, fontFamily: 'Inter_700Bold' },
  pill: { borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6, minWidth: 66, alignItems: 'center' },
  pillOutline: { borderWidth: 1, backgroundColor: 'transparent' },
  pillText: { fontSize: 9, letterSpacing: 0.9, fontFamily: 'Inter_700Bold' },
  medalSlotBadge: {
    position: 'absolute', top: -7, right: -7, width: 22, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#0D0D0D',
  },
  medalSlotBadgeText: { fontSize: 11, fontFamily: 'Inter_700Bold', color: '#0A0A0A' },
  notice: {
    position: 'absolute', left: 20, right: 20, bottom: 28,
    borderRadius: 14, borderWidth: 1, paddingVertical: 13, paddingHorizontal: 16,
  },
  noticeText: { color: '#FFF', fontSize: 13, fontFamily: 'Inter_600SemiBold', textAlign: 'center' },
  themeRow: { borderWidth: 1.5, borderRadius: 16, padding: 15, flexDirection: 'row', alignItems: 'center', gap: 13 },
  themeSwatch: { width: 32, height: 32, borderRadius: 16, boxShadow: '0 0 12px rgba(255,255,255,0.18)' },
  lockState: { fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 0.8 },
  empty: { textAlign: 'center', paddingVertical: 30, fontSize: 14 },
  medalGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  medalCell: { width: '31%' },
  medalTile: { width: '100%', aspectRatio: 1, borderWidth: 1, borderRadius: 15, alignItems: 'center', justifyContent: 'center', padding: 8 },
  medalIcon: { fontSize: 34 },
  medalDetail: { borderRadius: 18, borderWidth: 1.5, padding: 16, gap: 12, marginBottom: 4 },
  medalDetailHeader: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  medalDetailIcon: { fontSize: 42 },
  medalDetailCopy: { flex: 1 },
  medalDetailName: { color: '#FFF', fontSize: 18, fontFamily: 'Inter_700Bold' },
  medalDetailMeta: { fontSize: 9, letterSpacing: 1.4, fontFamily: 'Inter_700Bold', marginTop: 4 },
  medalDetailDescription: { fontSize: 13, lineHeight: 19 },
  medalDetailButton: { borderWidth: 1.5, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  medalDetailButtonText: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  manageButton: { borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 12 },
  manageButtonText: { color: '#080808', fontSize: 14, fontFamily: 'Inter_700Bold' },
});
