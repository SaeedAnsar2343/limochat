/**
 * Converts backend authentication errors (Firebase, network, etc.)
 * into clear, user-friendly, professional messages without technical jargon or service names.
 */
export function formatAuthErrorMessage(error: any, context?: { email?: string; isGoogleUser?: boolean }): string {
  if (!error) return 'An unexpected error occurred. Please try again.';

  if (typeof error === 'string') {
    return cleanRawErrorString(error);
  }

  const code = (error.code || '').toLowerCase();
  const rawMsg = (error.message || '').toString();

  if (context?.isGoogleUser) {
    return 'This account is linked with Google Sign-In. Please click "Continue with Google" above to sign in.';
  }

  // 1. Invalid credential / wrong password / user not found
  if (
    code === 'auth/invalid-credential' ||
    code.includes('invalid-credential') ||
    code === 'auth/wrong-password' ||
    code.includes('wrong-password')
  ) {
    return 'Incorrect email or password. Please verify your credentials or tap "Forgot password?" to reset it.';
  }

  if (code === 'auth/user-not-found' || code.includes('user-not-found')) {
    return 'No account was found with this email. Switch to "Create Account" above to register.';
  }

  // 2. Formatting & Validation
  if (code === 'auth/invalid-email' || code.includes('invalid-email')) {
    return 'Please enter a valid email address.';
  }

  if (code === 'auth/email-already-in-use' || code.includes('email-already-in-use')) {
    return 'An account already exists with this email address. Please click "Sign In" to continue.';
  }

  if (code === 'auth/weak-password' || code.includes('weak-password')) {
    return 'Password is too short. Please choose a password with at least 6 characters.';
  }

  // 3. Account restrictions
  if (code === 'auth/user-disabled' || code.includes('user-disabled')) {
    return 'This account has been disabled. Please contact official support.';
  }

  if (code === 'auth/too-many-requests' || code.includes('too-many-requests')) {
    return 'Too many unsuccessful attempts. Access has been temporarily paused for your security. Please try again shortly or reset your password.';
  }

  // 4. Network and popups
  if (code === 'auth/network-request-failed' || code.includes('network-request-failed')) {
    return 'Unable to connect to the server. Please check your internet connection and try again.';
  }

  if (code === 'auth/popup-closed-by-user' || code.includes('popup-closed-by-user')) {
    return 'Sign-in window was closed before completion.';
  }

  if (code === 'auth/popup-blocked' || code.includes('popup-blocked')) {
    return 'Sign-in popup was blocked by your browser. Please allow popups for LimoChat and try again.';
  }

  if (code === 'auth/unauthorized-domain' || code.includes('unauthorized-domain')) {
    return 'Google Sign-In is not configured for this domain yet. Please sign in with your email or virtual number below.';
  }

  if (code === 'auth/account-exists-with-different-credential' || code.includes('account-exists-with-different-credential')) {
    return 'An account already exists with this email using a different sign-in method. Please use Google Sign-In or your password.';
  }

  return cleanRawErrorString(rawMsg);
}

function cleanRawErrorString(raw: string): string {
  let cleaned = raw
    // Remove "Firebase:" and "FirebaseError:"
    .replace(/FirebaseError:\s*/gi, '')
    .replace(/Firebase:\s*/gi, '')
    // Remove "Error (auth/xyz)." pattern
    .replace(/Error\s*\((auth\/[^)]+)\)\.?/gi, '')
    .replace(/\(auth\/[^)]+\)/gi, '')
    .replace(/auth\/[a-z0-9_-]+/gi, '')
    .trim();

  // Strip leading punctuation
  cleaned = cleaned.replace(/^[:\-–—\.]\s*/, '').trim();

  if (!cleaned || cleaned.toLowerCase() === 'error.' || cleaned.toLowerCase() === 'error') {
    return 'Sign-in failed. Please check your credentials and try again.';
  }

  return cleaned;
}
