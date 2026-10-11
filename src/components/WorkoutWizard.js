import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, useWindowDimensions } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../context/ThemeContext';
import { useWorkouts } from '../context/WorkoutContext';
import { EXERCISES } from '../data/exercises';
import { calculateStreak, checkPersonalRecords } from '../utils/calculations';
import { validateWeight, computeCappedStats, computeCappedCalories, logFlaggedEntry } from '../utils/exerciseValidation';
import ScrollWheel from './ScrollWheel';
import ProgressBar from './ProgressBar';
import { useReduceMotion } from './flip-card';

const EDGE_TAP_WIDTH = 48;

function ChevronIcon({ direction, color, size = 28 }) {
  const path = direction === 'left'
    ? 'M16.5 5.5L10 12l6.5 6.5'
    : 'M7.5 5.5L14 12l-6.5 6.5';

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Path d={path} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function RepeatIcon({ color, size = 24 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Path d="M20 7v5h-5" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M18.2 16.2A8 8 0 1 1 19.7 9" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

// Matches HomeScreen.js's DARK palette so the wizard doesn't pop up bright white
// against the dark main screen.
const WIZ_DARK_FALLBACK = {
  background: '#0D0D0D',
  surface: '#161616',
  surfaceSecondary: '#1F1F1F',
  border: '#262626',
  textPrimary: '#FFFFFF',
  textSecondary: '#9A9A9A',
};

const BODY_PARTS = [
  { id: 'chest', label: 'Chest' }, { id: 'back', label: 'Back' },
  { id: 'arms', label: 'Arms' }, { id: 'shoulders', label: 'Shoulders' },
  { id: 'legs', label: 'Legs' }, { id: 'core', label: 'Core' },
  { id: 'cardio', label: 'Cardio' },
];

const MUSCLE_GROUP_MAP = {
  chest: 'Chest', back: 'Back', arms: 'Arms', shoulders: 'Shoulders',
  legs: 'Legs', core: 'Core', cardio: 'Cardio',
};

const WEIGHT_OPTIONS = [2.5, 5, 7.5, 10, 12.5, 15, 17.5, 20, 22.5, 25, 27.5, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200, 210, 220, 230, 240, 250, 260, 270, 280, 290, 300, 320, 340, 355];
const REPS_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 22, 25, 28, 30, 35, 40, 50, 60, 70, 80, 100];
const SETS_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 15];
const DURATION_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 18, 20, 25, 30, 35, 40, 45, 50, 55, 60, 70, 80, 90, 100, 110, 120, 150, 180, 210, 240];
const DISTANCE_OPTIONS = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 6, 7, 8, 10, 12, 15, 18, 21, 30, 42, 50, 60, 80, 100];

function isCardio(name) {
  return EXERCISES.find(e => e.name === name)?.muscleGroup === 'Cardio';
}

function isBodyweight(name) {
  return EXERCISES.find(e => e.name === name)?.bodyweight === true;
}

// Session length isn't logged directly, so derive it from the work actually
// recorded (~3 min per working set, including rest) plus any cardio minutes.
// This used to be hardcoded to 45 min for every strength session, which made
// all the "time spent" statistics fabricated rather than data-derived.
const MINUTES_PER_SET = 3;
function estimateSessionMinutes(exercises, cardioMinutes) {
  const strengthSets = exercises.reduce(
    (sum, e) => sum + (e.muscleGroup === 'Cardio' ? 0 : (e.sets || 0)),
    0
  );
  return Math.round(strengthSets * MINUTES_PER_SET + (cardioMinutes || 0));
}

function getExercisesForPart(bpId) {
  return EXERCISES.filter(e => e.muscleGroup === MUSCLE_GROUP_MAP[bpId]).map(e => e.name);
}

function TapNavigator({ onLeft, onRight, leftDisabled, rightDisabled, children, showHints }) {
  const theme = useTheme();
  const reduceMotion = useReduceMotion();
  const rightScale = useSharedValue(1);

  useEffect(() => {
    if (showHints && !reduceMotion && !rightDisabled) {
      rightScale.value = withRepeat(
        withSequence(
          withTiming(1.12, { duration: 180 }),
          withTiming(1, { duration: 220 })
        ),
        2,
        false
      );
    }
  }, [reduceMotion, rightDisabled, rightScale, showHints]);

  const rightHintStyle = useAnimatedStyle(() => ({ transform: [{ scale: rightScale.value }] }));
  return (
    <View style={styles.tapNavigator}>
      <TouchableOpacity
        style={[styles.tapNavRail, leftDisabled && styles.tapNavDisabled]}
        onPress={onLeft}
        activeOpacity={0.6}
        disabled={leftDisabled}
        accessibilityRole="button"
        accessibilityLabel="Previous workout step"
        accessibilityState={{ disabled: leftDisabled }}
      >
        <View style={styles.tapNavPill}>
          <ChevronIcon direction="left" color={theme.primary} />
        </View>
      </TouchableOpacity>

      <View style={styles.tapNavContent} pointerEvents="box-none">
        {children}
      </View>

      <TouchableOpacity
        style={[styles.tapNavRail, rightDisabled && styles.tapNavDisabled]}
        onPress={onRight}
        activeOpacity={0.6}
        disabled={rightDisabled}
        accessibilityRole="button"
        accessibilityLabel="Next workout step"
        accessibilityState={{ disabled: rightDisabled }}
      >
        <Animated.View style={[styles.tapNavPill, rightHintStyle]}>
          <ChevronIcon direction="right" color={theme.primary} />
        </Animated.View>
      </TouchableOpacity>
    </View>
  );
}

export default function WorkoutWizard({ onSave, onClose }) {
  const theme = useTheme();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const reduceMotion = useReduceMotion();
  const WIZ_DARK = theme.home || WIZ_DARK_FALLBACK;
  const { workouts, medals, equippedMedals, xpProgress, equippedTitle } = useWorkouts();
  // Frozen at mount so the summary card's "#N" footer doesn't visibly tick up
  // when Save triggers addWorkout — the wizard stays mounted for a moment
  // afterward while workouts.length (a live context value) updates.
  const wrappedCountRef = useRef(workouts.length);
  const [selectedParts, setSelectedParts] = useState([]);
  const [exercisesByPart, setExercisesByPart] = useState({});
  const [exerciseData, setExerciseData] = useState({});
  const [step, setStep] = useState(0);
  const [currentBpIdx, setCurrentBpIdx] = useState(0);
  const [currentExIdx, setCurrentExIdx] = useState(0);
  const [currentFieldIdx, setCurrentFieldIdx] = useState(0);
  const [currentFieldValue, setCurrentFieldValue] = useState(null);
  const slideAnim = useSharedValue(0);
  const fadeAnim = useSharedValue(1);
  const directionRef = useRef(1);
  const isFirstRenderRef = useRef(true);
  // Guards against a double-tap on Save creating two workouts / two Wrappeds.
  const savingRef = useRef(false);
  const [showHints, setShowHints] = useState(true);
  const [validationError, setValidationError] = useState(null);
  const lastWorkout = workouts.length > 0 ? workouts[workouts.length - 1] : null;

  const allBpIds = useMemo(() => {
    if (selectedParts.length === 0) return [];
    return selectedParts;
  }, [selectedParts]);

  const currentBp = allBpIds[currentBpIdx];
  const currentExercises = exercisesByPart[currentBp] || [];
  const currentExercise = currentExercises[currentExIdx];
  const fieldsForCurrent = currentExercise && (isCardio(currentExercise) ? ['duration', 'distance'] : ['weight', 'reps', 'sets']);
  const currentField = fieldsForCurrent?.[currentFieldIdx];

  const buildSteps = useCallback((bps, exByPart) => {
    const steps = [{ type: 'bodyParts' }];
    for (const bp of bps) {
      steps.push({ type: 'exercises', bp });
      for (const ex of (exByPart[bp] || [])) {
        for (const f of (isCardio(ex) ? ['duration', 'distance'] : ['weight', 'reps', 'sets'])) {
          steps.push({ type: 'field', bp, exercise: ex, field: f });
        }
      }
    }
    steps.push({ type: 'summary' });
    return steps;
  }, []);

  const steps = useMemo(() => buildSteps(allBpIds, exercisesByPart), [allBpIds, exercisesByPart, buildSteps]);
  const totalSteps = steps.length;
  const currentStepDef = steps[step];
  const isSummary = currentStepDef?.type === 'summary';
  const isFirstSlide = step === 0;

  const goNext = useCallback(() => {
    if (step < totalSteps - 1) {
      directionRef.current = 1;
      setStep(s => s + 1);
      setShowHints(false);
      setCurrentFieldValue(null);
      setValidationError(null);
    }
  }, [step, totalSteps]);

  const goBack = useCallback(() => {
    if (step > 0) {
      directionRef.current = -1;
      setStep(s => s - 1);
      setValidationError(null);
    }
  }, [step]);

  // Trigger the slide+fade transition only after React has committed the new step's
  // content — starting it eagerly (before the incoming content is laid out) let the
  // native-driven animation race ahead of the mount, producing a mid-flight pop/jump.
  useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      return;
    }
    const dir = directionRef.current;
    if (reduceMotion) {
      slideAnim.value = 0;
      fadeAnim.value = 1;
      return;
    }
    slideAnim.value = dir * screenWidth * 0.22;
    fadeAnim.value = 0.35;
    slideAnim.value = withTiming(0, { duration: 200, easing: Easing.out(Easing.cubic) });
    fadeAnim.value = withTiming(1, { duration: 200, easing: Easing.out(Easing.cubic) });
  }, [fadeAnim, reduceMotion, screenWidth, slideAnim, step]);

  const transitionStyle = useAnimatedStyle(() => ({
    opacity: fadeAnim.value,
    transform: [{ translateX: slideAnim.value }],
  }));

  useEffect(() => {
    if (currentStepDef?.type === 'field' && currentFieldValue === null) {
      const isCardioEx = isCardio(currentStepDef.exercise);
      let opts;
      if (isCardioEx && currentStepDef.field === 'duration') opts = DURATION_OPTIONS;
      else if (isCardioEx && currentStepDef.field === 'distance') opts = DISTANCE_OPTIONS;
      else if (currentStepDef.field === 'weight') opts = WEIGHT_OPTIONS;
      else if (currentStepDef.field === 'reps') opts = REPS_OPTIONS;
      else opts = SETS_OPTIONS;
      setCurrentFieldValue(opts[0]);
    }
  }, [currentStepDef, currentFieldValue]);

  const handleFieldConfirm = useCallback((val) => {
    if (!currentExercise) return;
    setValidationError(null);
    if (currentField === 'weight') {
      const result = validateWeight(currentExercise, val);
      if (!result.valid) {
        setValidationError(result);
        logFlaggedEntry(currentExercise, 'weight', val, result.max);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        return;
      }
    }
    setExerciseData(prev => ({ ...prev, [currentExercise]: { ...prev[currentExercise], [currentField]: val } }));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const fs = isCardio(currentExercise) ? ['duration', 'distance'] : ['weight', 'reps', 'sets'];
    if (currentFieldIdx < fs.length - 1) { setCurrentFieldIdx(i => i + 1); goNext(); }
    else if (currentExIdx < currentExercises.length - 1) { setCurrentExIdx(i => i + 1); setCurrentFieldIdx(0); goNext(); }
    else if (currentBpIdx < allBpIds.length - 1) { setCurrentBpIdx(i => i + 1); setCurrentExIdx(0); setCurrentFieldIdx(0); goNext(); }
    else { goNext(); }
  }, [currentExercise, currentField, currentFieldIdx, currentExIdx, currentExercises, currentBpIdx, allBpIds, goNext]);

  const handleLeftTap = useCallback(() => {
    if (isSummary) return;
    if (isFirstSlide) { onClose(); return; }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (currentStepDef?.type === 'field') {
      const ex = currentStepDef.exercise;
      const fs = isCardio(ex) ? ['duration', 'distance'] : ['weight', 'reps', 'sets'];
      if (currentFieldIdx > 0) { setCurrentFieldIdx(i => i - 1); goBack(); return; }
      if (currentExIdx > 0) { setCurrentExIdx(i => i - 1); const prevExs = currentExercises; const prevEx = prevExs[currentExIdx - 1]; const pfs = isCardio(prevEx) ? ['duration', 'distance'] : ['weight', 'reps', 'sets']; setCurrentFieldIdx(pfs.length - 1); goBack(); return; }
      if (currentBpIdx > 0) { setCurrentBpIdx(i => i - 1); setCurrentExIdx(0); setCurrentFieldIdx(0); goBack(); return; }
      goBack();
    } else if (currentStepDef?.type === 'exercises') {
      if (currentBpIdx > 0) { setCurrentBpIdx(i => i - 1); setCurrentExIdx(0); setCurrentFieldIdx(0); }
      goBack();
    } else {
      goBack();
    }
  }, [isFirstSlide, onClose, currentStepDef, currentFieldIdx, currentExIdx, currentExercises, currentBpIdx, goBack]);

  const handleRightTap = useCallback(() => {
    if (isSummary) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isFirstSlide) {
      if (selectedParts.length === 0) return;
      setCurrentBpIdx(0); setCurrentExIdx(0); setCurrentFieldIdx(0);
      goNext();
      return;
    }
    if (currentStepDef?.type === 'exercises') {
      const exs = exercisesByPart[currentStepDef.bp] || [];
      if (exs.length === 0) return;
      setCurrentExIdx(0); setCurrentFieldIdx(0);
      goNext();
      return;
    }
    if (currentStepDef?.type === 'field') {
      const val = currentFieldValue;
      if (val === null || val === undefined) return;
      handleFieldConfirm(val);
      return;
    }
  }, [isSummary, isFirstSlide, selectedParts, currentStepDef, exercisesByPart, currentFieldValue, handleFieldConfirm, goNext]);

  const handleBodyPartTap = useCallback((id) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedParts(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }, []);

  const handleExerciseToggle = useCallback((name) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExercisesByPart(prev => {
      const current = prev[currentBp] || [];
      return { ...prev, [currentBp]: current.includes(name) ? current.filter(x => x !== name) : [...current, name] };
    });
  }, [currentBp]);

  const handleScrollSelect = useCallback((val) => {
    setCurrentFieldValue(val);
  }, []);

  const submitWorkout = useCallback(async (workout) => {
    if (savingRef.current) return;
    savingRef.current = true;
    try {
      await onSave(workout);
    } finally {
      // The successful path normally unmounts the wizard. Resetting here keeps
      // a failed save retryable without weakening the double-tap guard.
      savingRef.current = false;
    }
  }, [onSave]);

  const handleSave = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const allExercises = [];
    let totalCardioMin = 0;
    for (const bp of allBpIds) {
      for (const name of (exercisesByPart[bp] || [])) {
        const d = exerciseData[name];
        const ex = EXERCISES.find(e => e.name === name);
        if (isCardio(name)) {
          totalCardioMin += (d?.duration || 0);
          allExercises.push({ name, muscleGroup: 'Cardio', duration: d?.duration || 0, distance: d?.distance || 0 });
        } else {
          allExercises.push({ name, muscleGroup: ex?.muscleGroup || 'Other', weight: d?.weight || 0, reps: d?.reps || 0, sets: d?.sets || 0 });
        }
      }
    }
    submitWorkout({ exercises: allExercises, duration: estimateSessionMinutes(allExercises, totalCardioMin), cardioMinutes: totalCardioMin });
  }, [allBpIds, exercisesByPart, exerciseData, submitWorkout]);

  const handleRepeatLastWorkout = useCallback(() => {
    if (!lastWorkout) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const exercises = (lastWorkout.exercises || []).map(exercise => ({ ...exercise }));
    submitWorkout({
      exercises,
      duration: lastWorkout.duration || estimateSessionMinutes(exercises, lastWorkout.cardioMinutes || 0),
      cardioMinutes: lastWorkout.cardioMinutes || 0,
      repeatedFrom: lastWorkout.id,
    });
  }, [lastWorkout, submitWorkout]);

  const renderBodyParts = () => (
    <View style={styles.screen} pointerEvents="box-none">
      <View style={styles.slideCentered} pointerEvents="box-none">
        <Text style={[styles.question, { color: WIZ_DARK.textPrimary, marginBottom: 8, paddingHorizontal: 20, fontSize: 22, fontFamily: theme.font.bold }]}>What did you work out?</Text>
        {lastWorkout && (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`Repeat last workout with ${(lastWorkout.exercises || []).length} ${(lastWorkout.exercises || []).length === 1 ? 'exercise' : 'exercises'}`}
            onPress={handleRepeatLastWorkout}
            activeOpacity={0.78}
            style={[styles.repeatButton, { borderColor: theme.primary, backgroundColor: theme.primary + '12' }]}
          >
            <View style={styles.repeatCopy}>
              <Text style={[styles.repeatTitle, { color: theme.primary, fontFamily: theme.font.bold }]}>Repeat last workout</Text>
              <Text style={[styles.repeatMeta, { color: WIZ_DARK.textSecondary, fontFamily: theme.font.regular }]}>
                {(lastWorkout.exercises || []).length} {(lastWorkout.exercises || []).length === 1 ? 'exercise' : 'exercises'} {' · '} {lastWorkout.duration || 0} min
              </Text>
            </View>
            <RepeatIcon color={theme.primary} />
          </TouchableOpacity>
        )}
        <View style={[styles.bpGrid, { padding: 12, paddingHorizontal: 8, gap: 10 }]} pointerEvents="box-none">
        {BODY_PARTS.map(bp => {
          const on = selectedParts.includes(bp.id);
          return (
            <TouchableOpacity key={bp.id} style={[styles.bpBtn, { backgroundColor: WIZ_DARK.surfaceSecondary, borderColor: on ? theme.primary : WIZ_DARK.border, borderRadius: 14, paddingVertical: 16, paddingHorizontal: 24, minWidth: '28%' }, on && { backgroundColor: theme.primary + '26' }]} onPress={() => handleBodyPartTap(bp.id)} activeOpacity={0.7}>
              <Text style={[styles.bpLabel, { color: on ? theme.primary : WIZ_DARK.textPrimary, fontSize: 16, fontFamily: theme.font.semiBold }]}>{bp.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      </View>
    </View>
  );

  const renderContent = () => {
    if (isFirstSlide) return renderBodyParts();

    if (currentStepDef?.type === 'exercises') {
      const bp = BODY_PARTS.find(b => b.id === currentStepDef.bp);
      const all = getExercisesForPart(currentStepDef.bp);
      const selected = exercisesByPart[currentStepDef.bp] || [];
      return (
        <View style={styles.screen} pointerEvents="box-none">
          <View style={[styles.slideCentered, { paddingHorizontal: 8 }]} pointerEvents="box-none">
            <Text style={[styles.question, { color: WIZ_DARK.textPrimary, marginBottom: 4, fontSize: 22, fontFamily: theme.font.bold }]}>{bp?.label}</Text>
            <Text style={[styles.subText, { color: WIZ_DARK.textSecondary, marginBottom: 12, fontSize: 14, fontFamily: theme.font.regular }]}>Select your exercises</Text>
            <View style={{ maxHeight: screenHeight * 0.34 }}>
              <ScrollView contentContainerStyle={{ gap: 8 }} contentInsetAdjustmentBehavior="automatic">
                <View style={[styles.exGrid, { gap: 8 }]}>
                  {all.map(name => {
                    const on = selected.includes(name);
                    return (
                      <TouchableOpacity key={name} style={[styles.exBtn, { backgroundColor: WIZ_DARK.surfaceSecondary, borderColor: on ? theme.primary : WIZ_DARK.border, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, borderWidth: 1 }, on && { backgroundColor: theme.primary + '26' }]} onPress={() => handleExerciseToggle(name)} activeOpacity={0.7}>
                        <Text style={[styles.exBtnText, { color: on ? theme.primary : WIZ_DARK.textPrimary, fontSize: 13, fontFamily: theme.font.regular }]}>{name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
          </View>
        </View>
      );
    }

    if (currentStepDef?.type === 'field') {
      const isCardioEx = isCardio(currentStepDef.exercise);
      const isBw = isBodyweight(currentStepDef.exercise);
      let options, suffix;
      if (isCardioEx && currentStepDef.field === 'duration') { options = DURATION_OPTIONS; suffix = ' min'; }
      else if (isCardioEx && currentStepDef.field === 'distance') { options = DISTANCE_OPTIONS; suffix = ' km'; }
      else if (currentStepDef.field === 'weight') { options = WEIGHT_OPTIONS; suffix = ' kg'; }
      else if (currentStepDef.field === 'reps') { options = REPS_OPTIONS; suffix = ' reps'; }
      else { options = SETS_OPTIONS; suffix = ' sets'; }

      const currentVal = exerciseData[currentStepDef.exercise]?.[currentStepDef.field];
      const getSub = () => {
        if (isCardioEx && currentStepDef.field === 'duration') return 'How long?';
        if (isCardioEx && currentStepDef.field === 'distance') return 'What distance?';
        if (currentStepDef.field === 'weight' && isBw) return 'Your weight + extra (kg)';
        if (currentStepDef.field === 'weight') return 'What weight?';
        if (currentStepDef.field === 'reps') return 'How many reps?';
        return 'How many sets?';
      };

      return (
        <View style={styles.screen} pointerEvents="box-none">
          <View style={[styles.slideCentered, { alignItems: 'center' }]} pointerEvents="box-none">
            <Text style={[styles.wheelLabel, { color: WIZ_DARK.textPrimary, fontSize: 24, marginBottom: 4, fontFamily: theme.font.bold }]}>{currentStepDef.exercise}</Text>
            <Text style={[styles.wheelSub, { color: WIZ_DARK.textSecondary, fontSize: 16, marginBottom: 24, fontFamily: theme.font.regular }]}>{getSub()}</Text>
            <ScrollWheel options={options} value={currentVal} onSelect={handleScrollSelect} suffix={suffix} textColor={WIZ_DARK.textSecondary} selectedBg={theme.primary + '26'} />
            {validationError && (
              <View style={[styles.validationError, { backgroundColor: theme.primaryBg, borderColor: theme.primary }]}>
                <Text style={[styles.validationErrorText, { color: theme.primaryDim, fontFamily: theme.font.regular }]}>{validationError.message}</Text>
              </View>
            )}
          </View>
        </View>
      );
    }

    if (isSummary) {
      const allExercises = [];
      let totalCardioMin = 0;
      for (const bp of allBpIds) {
        for (const name of (exercisesByPart[bp] || [])) {
          const d = exerciseData[name];
          const ex = EXERCISES.find(e => e.name === name);
          if (isCardio(name)) {
            totalCardioMin += (d?.duration || 0);
            allExercises.push({ name, muscleGroup: 'Cardio', duration: d?.duration || 0, distance: d?.distance || 0 });
          } else {
            allExercises.push({ name, muscleGroup: ex?.muscleGroup || 'Other', weight: d?.weight || 0, reps: d?.reps || 0, sets: d?.sets || 0 });
          }
        }
      }

      const capped = computeCappedStats(allExercises);
      const draftedWorkout = { id: Date.now().toString(), date: new Date().toISOString(), exercises: allExercises, duration: estimateSessionMinutes(allExercises, totalCardioMin), cardioMinutes: totalCardioMin };
      const streak = calculateStreak(workouts);
      const prs = checkPersonalRecords(draftedWorkout, workouts);

      const cardStats = {
        totalVolume: capped.totalVolume, totalReps: capped.totalReps,
        bestWeight: capped.bestWeight, heaviestName: capped.heaviestName,
        streak, prs,
      };

      // This step is a REVIEW, not the completion card. Rendering the full
      // ShareableWrappedCard here meant the user saw the identical completion
      // card twice — once before saving and again in the post-save modal. The
      // celebration now happens once, after the Wrapped is actually persisted.
      const totalSets = allExercises.reduce((sum, e) => sum + (e.sets || 0), 0);
      const totalReps = allExercises.reduce((sum, e) => sum + (e.sets || 0) * (e.reps || 0), 0);
      const estimatedMinutes = estimateSessionMinutes(allExercises, totalCardioMin);

      const reviewRows = [
        { label: 'Exercises', value: `${allExercises.length}` },
        totalSets > 0 && { label: 'Sets', value: `${totalSets}` },
        totalReps > 0 && { label: 'Reps', value: `${totalReps.toLocaleString()}` },
        capped.totalVolume > 0 && { label: 'Total volume', value: `${capped.totalVolume.toLocaleString()} kg` },
        capped.bestWeight > 0 && { label: 'Heaviest lift', value: `${capped.bestWeight} kg` },
        estimatedMinutes > 0 && { label: 'Time in the gym', value: `≈ ${estimatedMinutes} min` },
        prs > 0 && { label: 'Personal records', value: `${prs} new` },
      ].filter(Boolean);

      return (
        <ScrollView contentContainerStyle={styles.reviewScroll}>
          <Text style={[styles.reviewTitle, { color: WIZ_DARK.textPrimary, fontFamily: theme.font.bold }]}>
            Review your session
          </Text>
          <Text style={[styles.reviewSub, { color: WIZ_DARK.textSecondary, fontFamily: theme.font.regular }]}>
            Check it over — your Wrapped is generated once you save.
          </Text>

          <View style={[styles.reviewCard, { backgroundColor: WIZ_DARK.surface, borderColor: WIZ_DARK.border }]}>
            {reviewRows.map((row, i) => (
              <View
                key={row.label}
                style={[styles.reviewRow, i > 0 && { borderTopWidth: 1, borderTopColor: WIZ_DARK.border }]}
              >
                <Text style={[styles.reviewLabel, { color: WIZ_DARK.textSecondary, fontFamily: theme.font.regular }]}>
                  {row.label}
                </Text>
                <Text style={[styles.reviewValue, { color: WIZ_DARK.textPrimary, fontFamily: theme.font.semiBold }]}>
                  {row.value}
                </Text>
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.reviewSaveBtn, { backgroundColor: theme.primary }]}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Save workout and create your Wrapped"
            onPress={() => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              submitWorkout({ exercises: allExercises, duration: estimatedMinutes, cardioMinutes: totalCardioMin });
            }}
          >
            <Text style={[styles.reviewSaveText, { fontFamily: theme.font.bold }]}>Save workout</Text>
          </TouchableOpacity>
        </ScrollView>
      );
    }

    return null;
  };

  const rightDisabled = isSummary ||
    (isFirstSlide && selectedParts.length === 0) ||
    (currentStepDef?.type === 'exercises' && (exercisesByPart[currentStepDef?.bp] || []).length === 0) ||
    (currentStepDef?.type === 'field' && (currentFieldValue === null || currentFieldValue === undefined)) ||
    (currentStepDef?.type === 'field' && !!validationError);

  return (
    <View style={{ flex: 1, backgroundColor: WIZ_DARK.background }}>
      <WizardHeader onClose={onClose} title={isFirstSlide ? 'Log Workout' : currentStepDef?.type === 'exercises' ? BODY_PARTS.find(b => b.id === currentStepDef?.bp)?.label || '' : currentStepDef?.type === 'summary' ? 'Review Workout' : currentStepDef?.exercise || ''} />
      {!isFirstSlide && !isSummary && <ProgressBar total={totalSteps} current={step} />}
      <TapNavigator
        onLeft={handleLeftTap}
        onRight={handleRightTap}
        leftDisabled={false}
        rightDisabled={rightDisabled}
        showHints={isFirstSlide && showHints}
      >
        <Animated.View
          style={[{ flex: 1 }, transitionStyle]}
          pointerEvents="box-none"
        >
          {renderContent()}
        </Animated.View>
      </TapNavigator>
    </View>
  );
}

function WizardHeader({ onClose, title }) {
  const theme = useTheme();
  const WIZ_DARK = theme.home || WIZ_DARK_FALLBACK;
  return (
    <View style={[styles.wizardHeader, { backgroundColor: WIZ_DARK.surface, paddingTop: 50, paddingHorizontal: 16, paddingBottom: 8 }]}>
      <TouchableOpacity onPress={onClose} style={[styles.wizardCloseBtn, { padding: 8, width: 40 }]} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="Close workout logger">
        <Text style={[styles.wizardCloseText, { color: WIZ_DARK.textPrimary, fontSize: 18, fontFamily: 'Inter_700Bold' }]}>X</Text>
      </TouchableOpacity>
      <Text style={[styles.wizardHeaderTitle, { color: WIZ_DARK.textPrimary, fontSize: 16, fontFamily: 'Inter_700Bold' }]} numberOfLines={1}>{title}</Text>
      <View style={{ width: 40 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  wizardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: WIZ_DARK_FALLBACK.surface, zIndex: 20 },
  wizardCloseBtn: { alignItems: 'center' },
  wizardCloseText: {},
  wizardHeaderTitle: { flex: 1, textAlign: 'center' },

  screen: { flex: 1 },
  slideCentered: { flex: 1, justifyContent: 'center', paddingBottom: 150, paddingTop: 4 },

  question: { textAlign: 'center' },
  subText: { textAlign: 'center' },

  bpGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  bpBtn: { borderWidth: 2, alignItems: 'center' },
  bpLabel: {},

  exGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  exBtn: {},
  exBtnText: {},

  wheelLabel: { textAlign: 'center', paddingHorizontal: 20 },
  wheelSub: { textAlign: 'center', paddingHorizontal: 20 },

  tapNavigator: { flex: 1, flexDirection: 'row' },
  tapNavRail: {
    width: EDGE_TAP_WIDTH,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  tapNavContent: { flex: 1, minWidth: 0 },
  tapNavPill: {
    width: 40,
    height: 70,
    borderRadius: 20,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15,31,45,0.94)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    boxShadow: '0 7px 20px rgba(0,0,0,0.32)',
  },
  tapNavDisabled: { opacity: 0.26 },

  repeatButton: {
    width: '82%',
    maxWidth: 440,
    alignSelf: 'center',
    borderWidth: 1,
    borderRadius: 15,
    borderCurve: 'continuous',
    paddingVertical: 12,
    paddingHorizontal: 15,
    marginTop: 10,
    marginBottom: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  repeatCopy: { flex: 1 },
  repeatTitle: { fontSize: 14 },
  repeatMeta: { fontSize: 11, marginTop: 3 },

  reviewScroll: { flexGrow: 1, paddingHorizontal: 22, paddingTop: 12, paddingBottom: 48 },
  reviewTitle: { fontSize: 24, textAlign: 'center' },
  reviewSub: { fontSize: 13, textAlign: 'center', marginTop: 6, marginBottom: 20, lineHeight: 19 },
  reviewCard: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 18 },
  reviewRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14 },
  reviewLabel: { fontSize: 14 },
  reviewValue: { fontSize: 16 },
  reviewSaveBtn: { borderRadius: 16, paddingVertical: 17, alignItems: 'center', marginTop: 24 },
  reviewSaveText: { fontSize: 16, color: '#0A0A0A' },

  validationError: {
    marginHorizontal: 30, marginTop: 16, padding: 12,
    borderRadius: 10, borderWidth: 1,
  },
  validationErrorText: { fontSize: 13, lineHeight: 18, textAlign: 'center' },

});
