import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { reportError } from '../utils/errorReporter';

export default class AppErrorBoundary extends React.Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    reportError(error, 'app-crash', { componentStack: info?.componentStack });
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <View style={styles.container}>
        <Text style={styles.eyebrow}>MYPRS</Text>
        <Text style={styles.title}>That set didn’t land.</Text>
        <Text style={styles.body}>Your saved workouts are still on this device. Restart this screen and try again.</Text>
        <TouchableOpacity style={styles.button} onPress={() => this.setState({ hasError: false })}>
          <Text style={styles.buttonText}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D', alignItems: 'center', justifyContent: 'center', padding: 32 },
  eyebrow: { color: '#E63946', fontSize: 12, letterSpacing: 4, fontWeight: '800', marginBottom: 18 },
  title: { color: '#FFF', fontSize: 28, fontWeight: '800', textAlign: 'center' },
  body: { color: '#A0A0A0', fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 12 },
  button: { marginTop: 28, backgroundColor: '#E63946', paddingHorizontal: 28, paddingVertical: 14, borderRadius: 14 },
  buttonText: { color: '#FFF', fontSize: 15, fontWeight: '800' },
});
