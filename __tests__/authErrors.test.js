import { friendlyAuthError } from '../src/utils/auth-errors';

describe('account error messages', () => {
  test('explains unreachable cloud without implying local data was lost', () => {
    expect(friendlyAuthError(new TypeError('Failed to fetch'), 'signup')).toContain('workouts are still safe');
  });

  test('guides confirmed and existing accounts', () => {
    expect(friendlyAuthError({ message: 'Email not confirmed' })).toContain('Confirm your email');
    expect(friendlyAuthError({ message: 'User already registered' }, 'signup')).toContain('Sign in');
  });
});
