import React, { useState, useCallback, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, Modal, Platform, Alert, Linking } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, Inter_400Regular, Inter_600SemiBold, Inter_700Bold, Inter_900Black } from '@expo-google-fonts/inter';
import * as Updates from 'expo-updates';
import * as SplashScreen from 'expo-splash-screen';
import { WorkoutProvider, useWorkouts } from './src/context/WorkoutContext';
import { ThemeProvider } from './src/context/ThemeContext';
import { SoundProvider } from './src/context/SoundContext';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import AccountScreen from './src/components/account-screen';
import HomeScreen from './src/components/HomeScreen';
import WorkoutWizard from './src/components/WorkoutWizard';
import IntroSlides from './src/components/IntroSlides';
import MedalGallery from './src/components/MedalGallery';
import MedalCelebration from './src/components/MedalCelebration';
import LevelUpCelebration from './src/components/LevelUpCelebration';
import { getIntroSeen, setIntroSeen } from './src/utils/storage';
import { getFriendlyError, reportError, initErrorReporting } from './src/utils/errorReporter';
import AppErrorBoundary from './src/components/AppErrorBoundary';
import { trackEvent } from './src/utils/product-analytics';
import { parseChallengeToken } from './src/utils/friend-challenges';
import AppLaunchScreen from './src/components/app-launch-screen';
import { saveWorkoutAndCreateWrapped } from './src/utils/save-workout-flow';

if (Platform.OS !== 'web') {
  SplashScreen.preventAutoHideAsync().catch(() => {});
}

// Bridges account level from workout state into the theme layer so level-gated
// themes unlock automatically as XP grows.
function LevelAwareThemeProvider({ children }) {
  const { xpProgress } = useWorkouts();
  const { accountProfile, loading: accountLoading } = useAuth();
  const founderThemes = accountProfile?.founder_number ? ['founder'] : [];
  return <ThemeProvider level={xpProgress?.level || 1} entitledThemeIds={founderThemes} entitlementLoading={accountLoading}>{children}</ThemeProvider>;
}

function AppShell() {
  const {
    workouts, medals, wrappedCards, xpTotal,
    addWorkout, updateStartingStats, generateWrapped,
    newUnlock, dismissUnlock, levelUp, dismissLevelUp,
    togglePin, resetState,
  } = useWorkouts();

  const [showWizard, setShowWizard] = useState(false);
  const [showMedals, setShowMedals] = useState(false);
  const [showIntro, setShowIntro] = useState(false);
  const [challengeToken, setChallengeToken] = useState(null);

  useEffect(() => {
    (async () => {
      const seen = await getIntroSeen();
      if (!seen) setShowIntro(true);
    })();
  }, []);

  useEffect(() => {
    const receiveUrl = ({ url } = {}) => {
      const token = parseChallengeToken(url);
      if (token) setChallengeToken(token);
    };
    Linking.getInitialURL().then(url => receiveUrl({ url })).catch(error => reportError(error, 'initial-challenge-link'));
    const subscription = Linking.addEventListener('url', receiveUrl);
    return () => subscription.remove();
  }, []);

  const handleWizardSave = useCallback(async (data) => {
    try {
      const result = await saveWorkoutAndCreateWrapped({ data, addWorkout, generateWrapped });
      setShowWizard(false);
      if (!result.wrappedCreated) {
        reportError(result.wrappedError, 'generate-wrapped-after-save');
        Alert.alert(
          'Workout saved',
          'Your workout is safe, but its Wrapped card could not be created. You can create it later from the menu.'
        );
      }
    } catch (error) {
      reportError(error, 'save-workout');
      Alert.alert('Workout not saved', getFriendlyError(error, 'We could not save this workout. Please try again.'));
    }
  }, [addWorkout, generateWrapped]);

  const handleIntroComplete = useCallback(async () => {
    // Onboarding now earns trust by getting the user to their first workout.
    // Baseline stats and the custom title are no longer gates before value.
    await updateStartingStats({});
    await setIntroSeen();
    trackEvent('onboarding.completed', {
      starting_stats_count: 0,
      has_custom_title: false,
    });
    setShowIntro(false);
    setShowWizard(true);
  }, [updateStartingStats]);

  const handleHardReset = useCallback(async () => {
    await new Promise(r => setTimeout(r, 100));
    // expo-updates reloadAsync isn't supported on web — reload the page instead.
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') window.location.reload();
      return;
    }
    await Updates.reloadAsync();
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <StatusBar style="light" />

      <HomeScreen
        onOpenWizard={() => setShowWizard(true)}
        onOpenMedals={() => setShowMedals(true)}
        onHardReset={handleHardReset}
        challengeToken={challengeToken}
        onChallengeHandled={() => setChallengeToken(null)}
      />

      <Modal visible={showWizard} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowWizard(false)}>
        <WorkoutWizard onSave={handleWizardSave} onClose={() => setShowWizard(false)} />
      </Modal>

      <Modal visible={showMedals} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowMedals(false)}>
        <MedalGallery medals={medals} onClose={() => setShowMedals(false)} onTogglePin={togglePin} />
      </Modal>

      {/* Celebration modals are prioritized so only one native Modal is ever visible
          at once — medal, then level-up, then (in HomeScreen) title, then new-wrapped
          congrats. Showing several simultaneously is a known cause of frozen touch
          handling on iOS. Each dismissal reveals the next in line automatically. */}
      <Modal visible={!!newUnlock} animationType="fade" statusBarTranslucent onRequestClose={dismissUnlock}>
        {newUnlock && <MedalCelebration medal={newUnlock} onDismiss={dismissUnlock} />}
      </Modal>

      <Modal visible={!!levelUp && !newUnlock} animationType="fade" statusBarTranslucent onRequestClose={dismissLevelUp}>
        {levelUp && <LevelUpCelebration oldLevel={levelUp.oldLevel} newLevel={levelUp.newLevel} xp={levelUp.xp} onDismiss={dismissLevelUp} />}
      </Modal>

      <Modal visible={showIntro} animationType="fade" statusBarTranslucent onRequestClose={() => {}}>
        <IntroSlides onComplete={handleIntroComplete} />
      </Modal>
    </View>
  );
}

function BootExperience() {
  const { loading: workoutLoading } = useWorkouts();
  const { loading: accountLoading } = useAuth();

  return (
    <AppLaunchScreen ready={!workoutLoading && !accountLoading}>
      <AppShell />
    </AppLaunchScreen>
  );
}

// Initialise before the tree mounts so startup crashes are captured too.
// No-ops when EXPO_PUBLIC_SENTRY_DSN is unset (local dev, tests, CI).
initErrorReporting();

export default function App() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular, Inter_600SemiBold, Inter_700Bold, Inter_900Black,
  });

  useEffect(() => {
    if (__DEV__) {
      (async () => {
        try {
          const { supabase } = await import('./src/lib/supabase');
          const { data, error } = await supabase.auth.getSession();
          if (error) {
            console.log('[Supabase] Connection test FAILED:', error.message);
          } else if (data?.session) {
            console.log('[Supabase] Connected — active session for', data.session.user.email);
          } else {
            console.log('[Supabase] Connected — no active session (OK)');
          }
        } catch (e) {
          console.log('[Supabase] Connection test threw:', e.message);
        }
        const { getIntroSeen } = await import('./src/utils/storage');
        const introSeen = await getIntroSeen();
        console.log('[DevReset] App mount — hasSeenIntro:', introSeen);
      })();
    }
  }, []);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <SoundProvider>
          <AppErrorBoundary>
            {/* AuthProvider wraps WorkoutProvider so the account screen can
                restore cloud data and then ask the workout store to reload.
                Auth is optional — nothing below requires a signed-in user. */}
            <AuthProvider>
              {/* ThemeProvider sits inside WorkoutProvider because themes are
                  gated on account level, which comes from XP state. Nothing
                  between here and WorkoutProvider consumes the theme. */}
              <WorkoutProvider>
                <LevelAwareThemeProvider>
                  <BootExperience />
                </LevelAwareThemeProvider>
              </WorkoutProvider>
            </AuthProvider>
          </AppErrorBoundary>
        </SoundProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
