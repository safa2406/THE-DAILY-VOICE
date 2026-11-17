/**
 * Dynamic Greeting & User Name Utility
 * Computes time-of-day greetings and extracts authenticated user display names.
 */

/**
 * Returns greeting based on browser local time:
 * - 5:00 AM – 11:59 AM: Good morning
 * - 12:00 PM – 4:59 PM: Good afternoon
 * - 5:00 PM – 4:59 AM: Good evening
 *
 * @param {Date} [date=new Date()]
 * @returns {string}
 */
export function getTimeOfDayGreeting(date = new Date()) {
  const hours = date.getHours();

  if (hours >= 5 && hours < 12) {
    return 'Good morning';
  } else if (hours >= 12 && hours < 17) {
    return 'Good afternoon';
  } else {
    return 'Good evening';
  }
}

/**
 * Extracts display name from authenticated user profile or metadata.
 * Falls back to 'Reader' if unauthenticated or no name is provided.
 *
 * @param {object|null} user
 * @returns {string}
 */
export function getUserDisplayName(user) {
  if (!user) return 'Reader';

  // 1. Check user metadata fields
  const meta = user.user_metadata || {};
  const candidateName = meta.full_name || meta.name || meta.display_name;

  if (candidateName && typeof candidateName === 'string' && candidateName.trim().length > 0) {
    return candidateName.trim();
  }

  // 2. Derive from email address if available (e.g. safa@example.com -> Safa)
  if (user.email && typeof user.email === 'string') {
    const localPart = user.email.split('@')[0];
    if (localPart) {
      // Split on dots or dashes if present, capitalize words
      const cleaned = localPart
        .replace(/[._-]+/g, ' ')
        .trim()
        .split(' ')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');
      if (cleaned.length > 0) {
        return cleaned;
      }
    }
  }

  return 'Reader';
}
