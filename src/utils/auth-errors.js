export function friendlyAuthError(error, mode = 'signin') {
  const message = String(error?.message || '').toLowerCase();
  if (message.includes('failed to fetch') || message.includes('network')) {
    return 'The cloud account service cannot be reached right now. Your workouts are still safe on this phone. Check your connection and try again.';
  }
  if (message.includes('already registered') || message.includes('already exists')) return 'An account already exists for this email. Choose Sign in instead.';
  if (message.includes('invalid login')) return 'That email and password combination is not correct.';
  if (message.includes('email not confirmed')) return 'Confirm your email using the link Supabase sent, then sign in.';
  if (message.includes('rate limit') || error?.status === 429) return 'Too many attempts. Wait a minute and try again.';
  if (message.includes('signup') && message.includes('disabled')) return 'Account creation is temporarily disabled.';
  return error?.message || `Could not ${mode === 'signup' ? 'create the account' : 'sign in'}. Please try again.`;
}

