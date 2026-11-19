import { test, describe } from 'node:test';
import assert from 'node:assert';
import {
  getTimeOfDayGreeting,
  getUserDisplayName,
  getUserFirstName,
} from '../src/utils/greeting.js';

describe('Personalized Time-Based Greeting & User Name Extraction', () => {
  test('1. Time-of-day greeting maps to Good morning between 5:00 AM and 11:59 AM', () => {
    const earlyMorning = new Date('2026-11-19T05:00:00');
    const midMorning = new Date('2026-11-19T08:30:00');
    const lateMorning = new Date('2026-11-19T11:59:59');

    assert.strictEqual(getTimeOfDayGreeting(earlyMorning), 'Good morning');
    assert.strictEqual(getTimeOfDayGreeting(midMorning), 'Good morning');
    assert.strictEqual(getTimeOfDayGreeting(lateMorning), 'Good morning');
  });

  test('2. Time-of-day greeting maps to Good afternoon between 12:00 PM and 4:59 PM', () => {
    const noon = new Date('2026-11-19T12:00:00');
    const earlyAfternoon = new Date('2026-11-19T14:15:00');
    const lateAfternoon = new Date('2026-11-19T16:59:59');

    assert.strictEqual(getTimeOfDayGreeting(noon), 'Good afternoon');
    assert.strictEqual(getTimeOfDayGreeting(earlyAfternoon), 'Good afternoon');
    assert.strictEqual(getTimeOfDayGreeting(lateAfternoon), 'Good afternoon');
  });

  test('3. Time-of-day greeting maps to Good evening between 5:00 PM and 4:59 AM', () => {
    const evening = new Date('2026-11-19T17:00:00');
    const night = new Date('2026-11-19T21:02:30');
    const midnight = new Date('2026-11-19T00:00:00');
    const preDawn = new Date('2026-11-19T04:59:59');

    assert.strictEqual(getTimeOfDayGreeting(evening), 'Good evening');
    assert.strictEqual(getTimeOfDayGreeting(night), 'Good evening');
    assert.strictEqual(getTimeOfDayGreeting(midnight), 'Good evening');
    assert.strictEqual(getTimeOfDayGreeting(preDawn), 'Good evening');
  });

  test('4. Extracts dynamic user name from Supabase user_metadata', () => {
    const user = {
      id: 'usr_001',
      email: 'safa@example.com',
      user_metadata: {
        full_name: 'Safa Jenkins',
      },
    };

    assert.strictEqual(getUserFirstName(user), 'Safa');
    assert.strictEqual(getUserDisplayName(user), 'Safa Jenkins');
  });

  test('5. Extracts dynamic user name from local backend user record (user.full_name)', () => {
    const user = {
      id: 'usr_002',
      email: 'safa@dailyvoice.com',
      full_name: 'Safa',
    };

    assert.strictEqual(getUserFirstName(user), 'Safa');
    assert.strictEqual(getUserDisplayName(user), 'Safa');
  });

  test('6. Derives dynamic user name from subscriber email when metadata is absent', () => {
    const user = {
      id: 'usr_003',
      email: 'safa.shaikh@example.com',
    };

    assert.strictEqual(getUserFirstName(user), 'Safa');
    assert.strictEqual(getUserDisplayName(user), 'Safa Shaikh');
  });

  test('7. Handles missing, null, or empty user names gracefully without hardcoding', () => {
    assert.strictEqual(getUserFirstName(null), '');
    assert.strictEqual(getUserFirstName({}), '');
    assert.strictEqual(getUserFirstName({ email: '' }), '');
  });

  test('8. Full greeting composition outputs expected format (e.g. "Good evening, Safa")', () => {
    const eveningDate = new Date('2026-11-19T21:02:30');
    const greeting = getTimeOfDayGreeting(eveningDate);
    const user = {
      email: 'safa@example.com',
      full_name: 'Safa',
    };
    const name = getUserFirstName(user);

    const fullGreeting = `${greeting}${name ? `, ${name}` : ''}`;
    assert.strictEqual(fullGreeting, 'Good evening, Safa');

    // Without user name, gracefully yields "Good evening"
    const anonymousGreeting = `${greeting}${getUserFirstName(null) ? `, ${getUserFirstName(null)}` : ''}`;
    assert.strictEqual(anonymousGreeting, 'Good evening');
  });
});
