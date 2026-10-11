import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { PRIVACY_POLICY, PRIVACY_LAST_UPDATED, SUPPORT_EMAIL } from '../config/privacy-content';

// In-app privacy policy. Both stores require a reachable policy, and Apple
// expects the disclosures here to match the App Privacy answers in App Store
// Connect — keep src/config/privacy-content.js and those answers in step.
export default function PrivacyPolicy({ visible, onClose }) {
  const theme = useTheme();
  const D = theme.home;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: D.background }]}>
        <View style={[styles.header, { borderBottomColor: D.separator }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.eyebrow, { color: theme.primary }]}>LEGAL</Text>
            <Text style={styles.title}>Privacy Policy</Text>
            <Text style={[styles.updated, { color: D.textTertiary }]}>Last updated {PRIVACY_LAST_UPDATED}</Text>
          </View>
          <TouchableOpacity style={[styles.close, { backgroundColor: D.surfaceSecondary }]} onPress={onClose} accessibilityLabel="Close privacy policy">
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          {PRIVACY_POLICY.map(section => (
            <View key={section.heading} style={styles.section}>
              <Text style={styles.heading}>{section.heading}</Text>
              {section.body.map((paragraph, i) => (
                <Text key={i} style={[styles.paragraph, { color: D.textSecondary }]}>{paragraph}</Text>
              ))}
              {section.bullets?.map((bullet, i) => (
                <View key={i} style={styles.bulletRow}>
                  <Text style={[styles.bulletDot, { color: theme.primary }]}>•</Text>
                  <Text style={[styles.bullet, { color: D.textSecondary }]}>{bullet}</Text>
                </View>
              ))}
            </View>
          ))}

          <Text style={[styles.contact, { color: D.textTertiary }]}>
            Questions or data requests: {SUPPORT_EMAIL}
          </Text>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 22, paddingTop: 22, paddingBottom: 16, borderBottomWidth: 1, gap: 12 },
  eyebrow: { fontSize: 10, letterSpacing: 3, fontFamily: 'Inter_700Bold' },
  title: { color: '#FFF', fontSize: 24, fontFamily: 'Inter_700Bold', marginTop: 3 },
  updated: { fontSize: 11, marginTop: 4, fontFamily: 'Inter_400Regular' },
  close: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  closeText: { color: '#FFF', fontSize: 15, fontFamily: 'Inter_700Bold' },
  scroll: { padding: 22, paddingBottom: 60 },
  section: { marginBottom: 26 },
  heading: { color: '#FFF', fontSize: 16, fontFamily: 'Inter_700Bold', marginBottom: 10 },
  paragraph: { fontSize: 14, lineHeight: 21, marginBottom: 10, fontFamily: 'Inter_400Regular' },
  bulletRow: { flexDirection: 'row', gap: 9, marginBottom: 7, paddingRight: 6 },
  bulletDot: { fontSize: 15, lineHeight: 20 },
  bullet: { flex: 1, fontSize: 14, lineHeight: 20, fontFamily: 'Inter_400Regular' },
  contact: { fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 10, fontFamily: 'Inter_400Regular' },
});
