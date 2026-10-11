import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform,
  ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useWorkouts } from '../context/WorkoutContext';
import { restoreFromCloud, deleteAccount } from '../utils/backupService';
import { queueAllUserData } from '../utils/syncService';
import { getAnalyticsConsent, getBackupMeta, saveAnalyticsConsent } from '../utils/storage';
import { clearAnalyticsQueue, flushAnalytics } from '../utils/product-analytics';
import { reportError } from '../utils/errorReporter';
import PrivacyPolicy from './privacy-policy';
import { checkSupabaseReachability } from '../lib/supabase';
import { friendlyAuthError } from '../utils/auth-errors';

// An account is entirely optional — the app works offline and always has. This
// screen exists so progress survives losing or changing a phone, which is the
// single biggest data-loss risk in an app about long-term progress.
export default function AccountScreen({ visible, onClose }) {
  const theme = useTheme();
  const D = theme.home;
  const { user, accountProfile, isAuthenticated, signIn, signUp, signOut, loading } = useAuth();
  const { reloadFromStorage, syncIssue } = useWorkouts();

  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);
  const [backupMeta, setBackupMeta] = useState({ lastBackupAt: null });
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false);
  const [cloudReachable, setCloudReachable] = useState(null);

  useEffect(() => {
    if (visible) {
      getBackupMeta().then(setBackupMeta).catch(() => {});
      getAnalyticsConsent().then(setAnalyticsEnabled).catch(() => {});
    }
  }, [visible, isAuthenticated, syncIssue]);

  useEffect(() => {
    let active = true;
    if (!visible || isAuthenticated) return () => { active = false; };
    setCloudReachable(null);
    checkSupabaseReachability().then(result => {
      if (active) setCloudReachable(result.reachable);
    });
    return () => { active = false; };
  }, [visible, isAuthenticated]);

  const handleAnalyticsToggle = useCallback(async (enabled) => {
    setAnalyticsEnabled(enabled);
    await saveAnalyticsConsent(enabled);
    if (enabled) flushAnalytics();
    else await clearAnalyticsQueue();
  }, []);

  const note = (text, tone = 'info') => setStatus({ text, tone });

  const handleAuth = useCallback(async () => {
    const trimmed = email.trim();
    if (!trimmed || !password) return note('Enter your email and password.', 'error');
    if (password.length < 8) return note('Password must be at least 8 characters.', 'error');

    setBusy(true);
    setStatus(null);
    try {
      const result = mode === 'signup'
        ? await signUp(trimmed, password)
        : await signIn(trimmed, password);

      if (result.error) {
        note(friendlyAuthError(result.error, mode), 'error');
        return;
      }

      if (mode === 'signup' && result.requiresEmailConfirmation) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setPassword('');
        setMode('signin');
        note('Account created. Check your email for the confirmation link, then return here to sign in and back up.', 'ok');
        return;
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setPassword('');

      // Signing in on a fresh device pulls progress down. Creating an account
      // queues existing local records for the same automatic, retryable backup
      // used whenever a workout or Wrapped card is saved.
      const uid = result.data?.session?.user?.id || result.data?.user?.id;
      if (uid) {
        if (mode === 'signup') {
          await queueAllUserData(uid);
          note('Account created. Automatic backup is on.', 'ok');
        } else {
          const result = await restoreFromCloud(uid);
          if (result.success) {
            await reloadFromStorage?.();
            note('Signed in. Your progress has been restored.', 'ok');
          } else {
            note('Signed in, but restoring your data failed.', 'error');
          }
        }
        getBackupMeta().then(setBackupMeta).catch(() => {});
      }
    } catch (error) {
      reportError(error, 'account-auth', { type: mode });
      note(friendlyAuthError(error, mode), 'error');
    } finally {
      setBusy(false);
    }
  }, [email, password, mode, signIn, signUp, reloadFromStorage]);

  const handleRestore = useCallback(async () => {
    setBusy(true);
    setStatus(null);
    const result = await restoreFromCloud(user?.id);
    setBusy(false);
    if (result.success) {
      await reloadFromStorage?.();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      note(`Restored ${result.counts.workouts} workouts and ${result.counts.cards} Wrapped cards.`, 'ok');
    } else {
      note(result.error || 'Restore failed.', 'error');
    }
  }, [user, reloadFromStorage]);

  const handleDelete = useCallback(() => {
    Alert.alert(
      'Delete account?',
      'This permanently erases your account and everything backed up to it. Data already on this phone stays until you reset the app. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            const result = await deleteAccount(user?.id);
            setBusy(false);
            if (result.success) {
              note(result.authRecordPending
                ? 'Your data was deleted. Removing the login record needs a moment — contact support if you can still sign in.'
                : 'Your account and cloud data have been deleted.', 'ok');
            } else {
              note(result.error || 'Could not delete the account.', 'error');
            }
          },
        },
      ]
    );
  }, [user]);

  const statusColor = status?.tone === 'error' ? '#FF6B6B' : status?.tone === 'ok' ? theme.primary : D.textSecondary;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.container, { backgroundColor: D.background }]}>
          <View style={[styles.header, { borderBottomColor: D.separator }]}>
            <View>
              <Text style={[styles.eyebrow, { color: theme.primary }]}>PROGRESS BACKUP</Text>
              <Text style={styles.title}>{isAuthenticated ? 'Your Account' : 'Save Your Progress'}</Text>
            </View>
            <TouchableOpacity style={[styles.close, { backgroundColor: D.surfaceSecondary }]} onPress={onClose} accessibilityLabel="Close">
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" contentInsetAdjustmentBehavior="automatic">
            {loading ? (
              <ActivityIndicator color={theme.primary} style={{ marginTop: 40 }} />
            ) : isAuthenticated ? (
              <>
                <View style={[styles.card, { backgroundColor: D.surface, borderColor: D.border }]}>
                  <Text style={[styles.label, { color: D.textSecondary }]}>SIGNED IN AS</Text>
                  <Text style={styles.email}>{user?.email}</Text>
                  <Text style={[styles.meta, { color: D.textTertiary }]}>
                    {syncIssue || (backupMeta?.lastBackupAt
                      ? `Last backed up ${new Date(backupMeta.lastBackupAt).toLocaleString()}`
                      : 'Automatic backup is on')}
                  </Text>
                  {accountProfile?.founder_number && (
                    <View style={styles.founderAccountPill}>
                      <Text style={styles.founderAccountText}>
                        GENESIS FOUNDER #{String(accountProfile.founder_number).padStart(3, '0')} / 100
                      </Text>
                    </View>
                  )}
                </View>

                <View style={[styles.analyticsRow, { backgroundColor: D.surface, borderColor: D.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.analyticsTitle}>Share anonymous usage</Text>
                    <Text style={[styles.analyticsCopy, { color: D.textSecondary }]}>Helps improve onboarding, logging and Wrapped. Never sends exercise names, weights, titles or email.</Text>
                  </View>
                  <Switch value={analyticsEnabled} onValueChange={handleAnalyticsToggle} trackColor={{ true: theme.primary }} />
                </View>

                <TouchableOpacity style={[styles.secondaryBtn, { borderColor: D.border }]} onPress={handleRestore} disabled={busy}>
                  <Text style={[styles.secondaryBtnText, { color: D.textPrimary }]}>Restore from cloud</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.secondaryBtn, { borderColor: D.border }]} onPress={() => signOut()} disabled={busy}>
                  <Text style={[styles.secondaryBtnText, { color: D.textPrimary }]}>Sign out</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.dangerBtn} onPress={handleDelete} disabled={busy}>
                  <Text style={styles.dangerBtnText}>Delete account</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                {cloudReachable === false && (
                  <View accessibilityRole="alert" style={styles.cloudWarning}>
                    <View style={styles.cloudWarningDot} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cloudWarningTitle}>Cloud accounts are unavailable</Text>
                      <Text selectable style={styles.cloudWarningText}>Your local workouts are safe. Account creation and backup will work again when the configured Supabase project is restored.</Text>
                    </View>
                  </View>
                )}
                <Text style={[styles.blurb, { color: D.textSecondary }]}>
                  MyPRS works fully offline — an account is optional. Add one and your
                  workouts, Wrapped cards, medals and level are backed up, so nothing
                  is lost if you change or lose your phone.
                </Text>

                <View style={styles.tabs}>
                  {['signin', 'signup'].map(m => (
                    <TouchableOpacity
                      key={m}
                      style={[styles.tab, {
                        borderColor: mode === m ? theme.primary : D.border,
                        backgroundColor: mode === m ? theme.primaryBg : 'transparent',
                      }]}
                      onPress={() => { setMode(m); setStatus(null); }}
                    >
                      <Text style={[styles.tabText, { color: mode === m ? theme.primary : D.textSecondary }]}>
                        {m === 'signin' ? 'Sign in' : 'Create account'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <TextInput
                  style={[styles.input, { backgroundColor: D.surfaceSecondary, borderColor: D.border, color: '#FFF' }]}
                  placeholder="Email"
                  placeholderTextColor={D.textTertiary}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  autoComplete="email"
                  accessibilityLabel="Email address"
                />
                <TextInput
                  style={[styles.input, { backgroundColor: D.surfaceSecondary, borderColor: D.border, color: '#FFF' }]}
                  placeholder="Password (min 8 characters)"
                  placeholderTextColor={D.textTertiary}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoCapitalize="none"
                  textContentType={mode === 'signup' ? 'newPassword' : 'password'}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  accessibilityLabel={mode === 'signup' ? 'Create password' : 'Password'}
                />

                <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: theme.primary }]} onPress={handleAuth} disabled={busy}>
                  <Text style={styles.primaryBtnText}>
                    {busy ? 'Working…' : mode === 'signup' ? 'Create account & back up' : 'Sign in & restore'}
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {status && (
              <Text selectable accessibilityRole={status.tone === 'error' ? 'alert' : 'text'} style={[styles.status, { color: statusColor }]}>{status.text}</Text>
            )}

            <TouchableOpacity style={styles.privacyLink} onPress={() => setShowPrivacy(true)}>
              <Text style={[styles.privacyLinkText, { color: D.textSecondary }]}>Privacy Policy & data use</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>

      <PrivacyPolicy visible={showPrivacy} onClose={() => setShowPrivacy(false)} />
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 22, paddingTop: 22, paddingBottom: 16, borderBottomWidth: 1 },
  eyebrow: { fontSize: 10, letterSpacing: 3, fontFamily: 'Inter_700Bold' },
  title: { color: '#FFF', fontSize: 26, fontFamily: 'Inter_700Bold', marginTop: 3 },
  close: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  closeText: { color: '#FFF', fontSize: 15, fontFamily: 'Inter_700Bold' },
  scroll: { padding: 20, paddingBottom: 48 },
  blurb: { fontSize: 14, lineHeight: 21, marginBottom: 20 },
  tabs: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  tab: { flex: 1, borderWidth: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  tabText: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  input: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, marginBottom: 12, fontFamily: 'Inter_400Regular' },
  primaryBtn: { borderRadius: 15, paddingVertical: 16, alignItems: 'center', marginTop: 6 },
  primaryBtnText: { color: '#0A0A0A', fontSize: 15, fontFamily: 'Inter_700Bold' },
  secondaryBtn: { borderWidth: 1, borderRadius: 15, paddingVertical: 15, alignItems: 'center', marginTop: 10 },
  secondaryBtnText: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  dangerBtn: { paddingVertical: 16, alignItems: 'center', marginTop: 18 },
  dangerBtnText: { color: '#FF6B6B', fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  card: { borderWidth: 1, borderRadius: 16, padding: 18, marginBottom: 18 },
  label: { fontSize: 9, letterSpacing: 1.4, fontFamily: 'Inter_700Bold' },
  email: { color: '#FFF', fontSize: 17, fontFamily: 'Inter_700Bold', marginTop: 6 },
  meta: { fontSize: 12, marginTop: 8, fontFamily: 'Inter_400Regular' },
  founderAccountPill: { alignSelf: 'flex-start', marginTop: 14, borderWidth: 1, borderColor: '#74F8FF88', backgroundColor: '#74F8FF10', borderRadius: 999, paddingVertical: 6, paddingHorizontal: 10 },
  founderAccountText: { color: '#BDFBFF', fontSize: 8, letterSpacing: 1.2, fontFamily: 'Inter_700Bold' },
  analyticsRow: { flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 8 },
  analyticsTitle: { color: '#FFF', fontSize: 14, fontFamily: 'Inter_700Bold' },
  analyticsCopy: { fontSize: 11, lineHeight: 16, fontFamily: 'Inter_400Regular', marginTop: 4 },
  status: { fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 18, fontFamily: 'Inter_600SemiBold' },
  privacyLink: { alignItems: 'center', paddingVertical: 22 },
  privacyLinkText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', textDecorationLine: 'underline' },
  cloudWarning: { flexDirection: 'row', alignItems: 'flex-start', gap: 11, borderWidth: 1, borderColor: '#6A2B35', backgroundColor: '#251419', borderRadius: 16, padding: 14, marginBottom: 16 },
  cloudWarningDot: { width: 9, height: 9, borderRadius: 5, marginTop: 5, backgroundColor: '#FF5264' },
  cloudWarningTitle: { color: '#FFF', fontSize: 13, fontFamily: 'Inter_700Bold' },
  cloudWarningText: { color: '#C49EA5', fontSize: 11, lineHeight: 16, marginTop: 3, fontFamily: 'Inter_400Regular' },
});
