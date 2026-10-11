// Temporary testing tools sheet. The environment flag is checked at the call
// site, and the release preflight fails until that flag is removed.
import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ActivityIndicator, ScrollView } from 'react-native';
import * as Haptics from 'expo-haptics';
import { simulateHistory, simulateTierShowcase } from '../utils/devSimulator';
import { performDevReset } from '../utils/devReset';

const D = {
  surface: '#161616',
  surfaceSecondary: '#1F1F1F',
  border: '#262626',
  textPrimary: '#FFFFFF',
  textSecondary: '#9A9A9A',
  textTertiary: '#5C5C5C',
  accent: '#E63946',
};

const PRESETS = [
  { label: '1 Week', days: 7, hint: 'daily cards only' },
  { label: '1 Month', days: 35, hint: '+ weekly cards' },
  { label: '3 Months', days: 95, hint: '+ monthly cards' },
  { label: '6 Months', days: 190, hint: 'Veteran tier' },
  { label: 'All Card Tiers', days: 'tiers', hint: 'Starter → Legendary' },
];

export default function DevPanel({ visible, onClose, onDataChanged }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const handleSimulate = useCallback(async (days) => {
    setBusy(true);
    setResult(null);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const res = days === 'tiers' ? await simulateTierShowcase() : await simulateHistory(days);
      setResult(res);
      if (res.success) {
        await onDataChanged?.();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (e) {
      setResult({ success: false, error: e?.message || 'Simulation failed' });
    } finally {
      setBusy(false);
    }
  }, [onDataChanged]);

  const handleReset = useCallback(async () => {
    setBusy(true);
    setResult(null);
    try {
      const res = await performDevReset();
      if (res.success) {
        await onDataChanged?.();
        setResult({ success: true, cleared: true });
        setConfirmReset(false);
      } else {
        setResult({ success: false, error: res.error });
      }
    } finally {
      setBusy(false);
    }
  }, [onDataChanged]);

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Developer Tools</Text>
          <Text style={styles.subtitle}>
            Builds a real training history and replays it through the live Wrapped
            generators — not mock data.
          </Text>

          <ScrollView style={{ maxHeight: 340 }} contentContainerStyle={{ paddingBottom: 4 }}>
            <Text style={styles.sectionLabel}>SIMULATE HISTORY</Text>
            {PRESETS.map(p => (
              <TouchableOpacity
                key={p.days}
                accessibilityRole="button"
                accessibilityLabel={`Simulate ${p.label} of training history`}
                style={[styles.row, busy && styles.rowDisabled]}
                onPress={() => handleSimulate(p.days)}
                disabled={busy}
                activeOpacity={0.7}
              >
                <Text style={styles.rowLabel}>{p.label}</Text>
                <Text style={styles.rowHint}>{p.hint}</Text>
              </TouchableOpacity>
            ))}

            <View style={styles.divider} />

            {!confirmReset ? (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Reset to new user"
                style={[styles.row, busy && styles.rowDisabled]}
                onPress={() => setConfirmReset(true)}
                disabled={busy}
                activeOpacity={0.7}
              >
                <Text style={[styles.rowLabel, { color: D.accent }]}>Reset to new user</Text>
                <Text style={styles.rowHint}>wipes everything</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.confirmBox}>
                <Text style={styles.confirmText}>Wipe all data and start fresh?</Text>
                <View style={styles.confirmActions}>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Confirm reset to new user"
                    style={[styles.confirmBtn, { backgroundColor: D.accent }]}
                    onPress={handleReset}
                    disabled={busy}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.confirmBtnText}>Wipe</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Cancel reset"
                    style={[styles.confirmBtn, { backgroundColor: D.surfaceSecondary }]}
                    onPress={() => setConfirmReset(false)}
                    disabled={busy}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.confirmBtnText, { color: D.textPrimary }]}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {busy && (
              <View style={styles.busyRow}>
                <ActivityIndicator color={D.accent} />
                <Text style={styles.busyText}>Working…</Text>
              </View>
            )}

            {result && !busy && (
              <View style={styles.resultBox}>
                {result.success && result.cleared && (
                  <Text style={styles.resultText}>Data cleared. You're a new user.</Text>
                )}
                {result.success && result.showcase && (
                  <Text style={styles.resultText}>
                    {result.cards} cards, one per tier{'\n'}
                    Levels {result.levels.join(' · ')}{'\n'}
                    Swipe the deck to compare tiers
                  </Text>
                )}
                {result.success && !result.cleared && !result.showcase && (
                  <Text style={styles.resultText}>
                    {result.workouts} workouts over {result.days} days{'\n'}
                    {result.daily} daily · {result.weekly} weekly · {result.monthly} monthly{'\n'}
                    {result.medals} medals · Lv.{result.level} ({result.totalXp.toLocaleString()} XP)
                  </Text>
                )}
                {!result.success && (
                  <Text style={[styles.resultText, { color: D.accent }]}>{result.error}</Text>
                )}
              </View>
            )}
          </ScrollView>

          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close developer tools" style={styles.closeBtn} onPress={onClose} activeOpacity={0.7} disabled={busy}>
            <Text style={styles.closeText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center', paddingHorizontal: 24,
  },
  sheet: {
    backgroundColor: D.surface, borderColor: D.border, borderWidth: 1,
    borderRadius: 20, padding: 20,
  },
  title: {
    color: D.textPrimary, fontSize: 18, fontFamily: 'Inter_700Bold',
    textAlign: 'center',
  },
  subtitle: {
    color: D.textSecondary, fontSize: 12, fontFamily: 'Inter_400Regular',
    textAlign: 'center', lineHeight: 17, marginTop: 6, marginBottom: 16,
  },
  sectionLabel: {
    color: D.textTertiary, fontSize: 10, fontFamily: 'Inter_700Bold',
    letterSpacing: 2, marginBottom: 8,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: D.surfaceSecondary, borderRadius: 12,
    paddingVertical: 14, paddingHorizontal: 16, marginBottom: 8,
  },
  rowDisabled: { opacity: 0.4 },
  rowLabel: { color: D.textPrimary, fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  rowHint: { color: D.textTertiary, fontSize: 11, fontFamily: 'Inter_400Regular' },
  divider: { height: 1, backgroundColor: D.border, marginVertical: 12 },
  confirmBox: {
    backgroundColor: D.surfaceSecondary, borderRadius: 12, padding: 14,
  },
  confirmText: {
    color: D.textPrimary, fontSize: 14, fontFamily: 'Inter_600SemiBold',
    textAlign: 'center', marginBottom: 12,
  },
  confirmActions: { flexDirection: 'row', gap: 10 },
  confirmBtn: { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  confirmBtnText: { color: '#FFF', fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  busyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 14 },
  busyText: { color: D.textSecondary, fontSize: 13, fontFamily: 'Inter_400Regular' },
  resultBox: {
    backgroundColor: D.surfaceSecondary, borderRadius: 12, padding: 14, marginTop: 12,
  },
  resultText: {
    color: D.textPrimary, fontSize: 13, fontFamily: 'Inter_400Regular',
    textAlign: 'center', lineHeight: 20,
  },
  closeBtn: { alignItems: 'center', paddingVertical: 14, marginTop: 4 },
  closeText: { color: D.textSecondary, fontSize: 15, fontFamily: 'Inter_600SemiBold' },
});
