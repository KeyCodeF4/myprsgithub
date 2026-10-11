import React, { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../context/ThemeContext';
import { MEDAL_LIST, TIERS } from '../data/medalsConfig';

const TIER_ORDER = ['founder', 'platinum', 'gold', 'silver', 'bronze'];

function getSlotLabel(medals, id) {
  const pinned = medals.filter(m => m.unlockedAt && m.pinned);
  const idx = pinned.findIndex(m => m.id === id);
  if (idx < 0) return '✓';
  return `${idx + 1}`;
}

export default function MedalGallery({ medals, onClose, onTogglePin }) {
  const theme = useTheme();
  const [selected, setSelected] = useState(null);
  const galleryScrollRef = useRef(null);

  const medalMap = {};
  for (const m of medals) medalMap[m.id] = m;

  const grouped = {};
  for (const config of MEDAL_LIST) {
    const g = config.category;
    if (!grouped[g]) grouped[g] = [];
    grouped[g].push(config);
  }

  const unlockedCount = medals.filter(m => m.unlockedAt).length;
  const totalCount = MEDAL_LIST.length;

  const renderMedalItem = (config) => {
    const state = medalMap[config.id];
    const unlocked = state?.unlockedAt;
    const tier = TIERS[config.tier];
    const progress = state ? (state.progressTarget > 0 ? state.progressCurrent / state.progressTarget : 0) : 0;
    const isSelected = selected === config.id;

    return (
      <TouchableOpacity
        key={config.id}
        style={[
          styles.medalItem,
          { borderColor: unlocked ? tier.color : '#222' },
          isSelected && { borderColor: theme.textPrimary, borderWidth: 2 },
        ]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setSelected(isSelected ? null : config.id);
          if (!isSelected) {
            setTimeout(() => galleryScrollRef.current?.scrollTo({ y: 0, animated: true }), 50);
          }
        }}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`${unlocked ? config.name : 'Locked medal'}, ${tier.name}. Tap for details.`}
        accessibilityState={{ selected: isSelected }}
      >
        <Text style={[styles.medalIcon, !unlocked && styles.lockedIcon]}>
          {unlocked ? config.icon : '?'}
        </Text>
        {!unlocked && progress > 0 && (
          <View style={styles.miniProgressBg}>
            <View style={[styles.miniProgressFill, { width: `${Math.min(progress * 100, 100)}%`, backgroundColor: tier.color }]} />
          </View>
        )}
        {state?.pinned && unlocked && (
          <View style={[styles.pinBadge, { backgroundColor: tier.color }]}>
            <Text style={styles.pinBadgeText}>{getSlotLabel(medals, config.id)}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const selectedConfig = selected ? MEDAL_LIST.find(c => c.id === selected) : null;
  const selectedState = selected ? medalMap[selected] : null;
  const selectedTier = selectedConfig ? TIERS[selectedConfig.tier] : null;
  const selectedDetail = selectedConfig && selectedState ? (
    <View style={[styles.detail, styles.detailAtTop, { backgroundColor: theme.surface, borderColor: selectedTier.color }]}> 
      <Text style={styles.detailIcon}>{selectedConfig.hidden && !selectedState.unlockedAt ? '?' : selectedConfig.icon}</Text>
      <Text style={[styles.detailName, { color: selectedTier.color, fontFamily: theme.font.bold }]}> 
        {selectedConfig.hidden && !selectedState.unlockedAt ? '???' : selectedConfig.name}
      </Text>
      <Text style={[styles.detailTier, { color: selectedTier.color, fontFamily: theme.font.semiBold }]}> 
        {selectedTier.name.toUpperCase()}
        {selectedState.serialNumber && <Text> · #{String(selectedState.serialNumber).padStart(3, '0')} / 100</Text>}
        {selectedConfig.hidden && <Text style={{ color: '#888' }}> · HIDDEN</Text>}
      </Text>
      <Text style={[styles.detailDesc, { color: theme.textSecondary, fontFamily: theme.font.regular }]}> 
        {selectedState.unlockedAt
          ? selectedConfig.description
          : selectedConfig.category === 'hidden'
            ? 'Keep pushing to discover this medal.'
            : `${selectedConfig.category} medal`}
      </Text>
      {selectedState.progressTarget > 1 && !selectedState.unlockedAt && (
        <View style={styles.progressSection}>
          <View style={styles.progressBg}>
            <View style={[styles.progressFill, {
              width: `${Math.min((selectedState.progressCurrent / selectedState.progressTarget) * 100, 100)}%`,
              backgroundColor: selectedTier.color,
            }]} />
          </View>
          <Text style={[styles.progressText, { color: theme.textSecondary, fontFamily: theme.font.regular }]}> 
            {selectedState.progressCurrent} / {selectedState.progressTarget}
          </Text>
        </View>
      )}
      {selectedState.unlockedAt && (
        <Text style={[styles.unlockedDate, { color: theme.textSecondary, fontFamily: theme.font.regular }]}> 
          Unlocked {new Date(selectedState.unlockedAt).toLocaleDateString()}
        </Text>
      )}
      {selectedState.unlockedAt && (
        <View style={styles.pinRow}>
          <TouchableOpacity
            style={[styles.pinBtn, { borderColor: selectedTier.color }]}
            onPress={() => onTogglePin(selectedConfig.id)}
            activeOpacity={0.7}
          >
            <Text style={[styles.pinBtnText, { color: selectedTier.color, fontFamily: theme.font.semiBold }]}> 
              {selectedState.pinned ? 'Remove from Card' : 'Show on Card'}
            </Text>
          </TouchableOpacity>
          <Text style={[styles.pinHint, { color: theme.textSecondary, fontFamily: theme.font.regular }]}> 
            {selectedState.pinned ? 'Appears on your Wrapped card' : 'Equip up to 3 medals on your cards'}
          </Text>
        </View>
      )}
    </View>
  ) : null;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { borderBottomColor: theme.separator }]}>
        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
          <Text style={[styles.closeText, { color: theme.textPrimary, fontFamily: theme.font.bold }]}>X</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.textPrimary, fontFamily: theme.font.bold }]}>Medal Locker</Text>
        <Text style={[styles.count, { color: theme.textSecondary, fontFamily: theme.font.semiBold }]}>
          {unlockedCount}/{totalCount}
        </Text>
      </View>

      {unlockedCount === 0 && (
        <View style={styles.empty}>
          <Text style={[styles.emptyIcon, { color: theme.textSecondary }]}>🏅</Text>
          <Text style={[styles.emptyTitle, { color: theme.textPrimary, fontFamily: theme.font.bold }]}>No medals yet</Text>
          <Text style={[styles.emptySub, { color: theme.textSecondary, fontFamily: theme.font.regular }]}>
            Keep working out to earn them.{'\n'}Tap a medal to see its details and progress.
          </Text>
        </View>
      )}

      <ScrollView ref={galleryScrollRef} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {selectedDetail}
        {TIER_ORDER.map(tierId => {
          const tierConfigs = MEDAL_LIST.filter(m => m.tier === tierId);
          const tier = TIERS[tierId];
          return (
            <View key={tierId} style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.tierLabel, { color: tier.color, fontFamily: theme.font.bold }]}>{tier.name.toUpperCase()}</Text>
              </View>
              <View style={styles.grid}>
                {tierConfigs.map(renderMedalItem)}
              </View>
            </View>
          );
        })}

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 60, paddingBottom: 12,
    borderBottomWidth: 1,
  },
  closeBtn: { padding: 8, width: 40 },
  closeText: { fontSize: 18 },
  title: { fontSize: 18 },
  count: { fontSize: 14 },

  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 20, marginBottom: 8 },
  emptySub: { fontSize: 14, textAlign: 'center', lineHeight: 22 },

  scroll: { padding: 16 },
  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  tierLabel: { fontSize: 13, letterSpacing: 3 },

  grid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10,
  },
  medalItem: {
    width: '31%', aspectRatio: 1,
    borderRadius: 16, borderWidth: 1.5,
    backgroundColor: '#15171A',
    justifyContent: 'center', alignItems: 'center',
    position: 'relative',
  },
  medalIcon: { fontSize: 28 },
  lockedIcon: { opacity: 0.25 },

  miniProgressBg: {
    position: 'absolute', bottom: 4, left: 8, right: 8,
    height: 3, borderRadius: 1.5, backgroundColor: '#E5E5EA', overflow: 'hidden',
  },
  miniProgressFill: { height: '100%', borderRadius: 1.5 },

  pinBadge: {
    position: 'absolute', top: -6, right: -6,
    borderRadius: 12, width: 22, height: 22,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#000',
  },
  pinBadgeText: { fontSize: 11, fontFamily: 'Inter_700Bold', color: '#000' },

  detail: {
    borderRadius: 20, borderWidth: 1,
    padding: 24, alignItems: 'center', marginTop: 8,
  },
  detailAtTop: { marginTop: 0, marginBottom: 24 },
  detailIcon: { fontSize: 48, marginBottom: 8 },
  detailName: { fontSize: 20, textAlign: 'center', marginBottom: 4 },
  detailTier: { fontSize: 12, letterSpacing: 2, marginBottom: 12 },
  detailDesc: { fontSize: 14, textAlign: 'center', marginBottom: 16, lineHeight: 20 },

  progressSection: { width: '100%', marginBottom: 12 },
  progressBg: { height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: 6 },
  progressFill: { height: '100%', borderRadius: 3 },
  progressText: { fontSize: 12, textAlign: 'center' },

  unlockedDate: { fontSize: 12, marginBottom: 16 },
  pinRow: { alignItems: 'center', gap: 8 },
  pinBtn: { borderWidth: 1.5, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 20 },
  pinBtnText: { fontSize: 13 },
  pinHint: { fontSize: 11, textAlign: 'center' },
});
