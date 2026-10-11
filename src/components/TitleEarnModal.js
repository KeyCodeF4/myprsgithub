import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../context/ThemeContext';
import { getCategoryInfo } from '../utils/titleSelector';

export default function TitleEarnModal({ visible, title, category, onEquip, onDiscard }) {
  const theme = useTheme();
  const catInfo = getCategoryInfo(category);

  if (!title) return null;

  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent onRequestClose={onDiscard}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={styles.emoji}>{catInfo.emoji}</Text>
          <Text style={[styles.badge, { color: theme.textSecondary, fontFamily: theme.font.semiBold }]}>
            NEW TITLE EARNED
          </Text>
          <Text style={[styles.title, { color: theme.textPrimary, fontFamily: theme.font.bold }]}>
            {title.text}
          </Text>
          <Text style={[styles.category, { color: theme.textSecondary, fontFamily: theme.font.regular }]}>
            {catInfo.label}
          </Text>
          <Text style={[styles.desc, { color: theme.textSecondary, fontFamily: theme.font.regular }]}>
            Equip it for future Wrapped cards, or keep your current title. Older cards never change.
          </Text>
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.btn, styles.equipBtn, { backgroundColor: theme.primary }]}
              onPress={() => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); onEquip(title); }}
              activeOpacity={0.8}
            >
              <Text style={[styles.btnText, { color: '#000', fontFamily: theme.font.bold }]}>Equip</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, styles.discardBtn, { backgroundColor: theme.surfaceSecondary, borderColor: theme.border }]}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onDiscard(); }}
              activeOpacity={0.8}
            >
              <Text style={[styles.btnText, { color: theme.textPrimary, fontFamily: theme.font.semiBold }]}>Keep current</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', paddingHorizontal: 32,
  },
  sheet: {
    borderRadius: 24, borderWidth: 1, padding: 28,
    alignItems: 'center',
  },
  emoji: { fontSize: 52, marginBottom: 12 },
  badge: { fontSize: 11, letterSpacing: 3, marginBottom: 8 },
  title: { fontSize: 26, textAlign: 'center', marginBottom: 6 },
  category: { fontSize: 14, marginBottom: 16 },
  desc: { fontSize: 13, textAlign: 'center', lineHeight: 20, marginBottom: 24, paddingHorizontal: 8 },
  actions: { flexDirection: 'row', gap: 10, width: '100%' },
  btn: {
    flex: 1, borderRadius: 14, paddingVertical: 14,
    alignItems: 'center', borderWidth: 1,
  },
  equipBtn: { borderColor: 'transparent' },
  discardBtn: {},
  btnText: { fontSize: 16 },
});
