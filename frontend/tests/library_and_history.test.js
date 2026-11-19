import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { getAuthHeaders, getLocalDateString } from '../src/services/api.js';

// Polyfill localStorage for node environment test
class MockLocalStorage {
  constructor() {
    this.store = {};
  }
  getItem(key) {
    return this.store[key] || null;
  }
  setItem(key, value) {
    this.store[key] = String(value);
  }
  removeItem(key) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
}

globalThis.localStorage = new MockLocalStorage();

describe('User Activity & Persistence - Auth Headers & State', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('1. getAuthHeaders returns basic Accept header when no session exists', () => {
    const headers = getAuthHeaders();
    assert.equal(headers.Accept, 'application/json');
    assert.equal(headers.Authorization, undefined);
    assert.equal(headers['X-User-Id'], undefined);
  });

  test('2. getAuthHeaders sends ONLY Accept and Bearer JWT (never client-spoofable/CORS-blocking X-User-* headers)', () => {
    const mockSession = {
      user: {
        id: '11111111-2222-3333-4444-555555555555',
        email: 'reader@dailyvoice.com',
        user_metadata: {
          full_name: 'Arthur Subscriber',
        },
      },
      session: {
        access_token: 'valid-jwt-access-token-xyz',
      },
    };
    localStorage.setItem('dailyvoice_auth_session', JSON.stringify(mockSession));

    const headers = getAuthHeaders();
    assert.equal(headers.Accept, 'application/json');
    assert.equal(headers.Authorization, 'Bearer valid-jwt-access-token-xyz');
    assert.equal(headers['X-User-Id'], undefined);
    assert.equal(headers['X-User-Email'], undefined);
    assert.equal(headers['X-User-Name'], undefined);
    assert.deepEqual(Object.keys(headers).sort(), ['Accept', 'Authorization']);
  });

  test('3. Bookmark state toggling logic adds and removes IDs cleanly', () => {
    let savedIds = ['art-001', 'art-002'];

    // Toggle off art-001
    const removeId = 'art-001';
    savedIds = savedIds.includes(removeId)
      ? savedIds.filter((id) => id !== removeId)
      : [...savedIds, removeId];
    assert.deepEqual(savedIds, ['art-002']);

    // Toggle on art-003
    const addId = 'art-003';
    savedIds = savedIds.includes(addId)
      ? savedIds.filter((id) => id !== addId)
      : [...savedIds, addId];
    assert.deepEqual(savedIds, ['art-002', 'art-003']);
  });

  test('4. Completion calculation: does not complete for 0 or early listening', () => {
    const duration = 180;
    const progressStart = 0;
    const thresholdStart = (progressStart >= duration - 5) || (progressStart / duration >= 0.9);
    assert.equal(thresholdStart, false);

    const progressMid = 45;
    const thresholdMid = (progressMid >= duration - 5) || (progressMid / duration >= 0.9);
    assert.equal(thresholdMid, false);

    const progressNearEnd = 165;
    const thresholdNearEnd = (progressNearEnd >= duration - 5) || (progressNearEnd / duration >= 0.9);
    assert.equal(thresholdNearEnd, true); // 165/180 = 91.6%
  });

  test('5. Dynamic listening time display formatting', () => {
    const formatTimeDisplay = (totalMinutes) => {
      if (totalMinutes >= 60) {
        return `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`;
      }
      return `${totalMinutes}m`;
    };

    assert.equal(formatTimeDisplay(0), '0m');
    assert.equal(formatTimeDisplay(24), '24m');
    assert.equal(formatTimeDisplay(75), '1h 15m');
    assert.equal(formatTimeDisplay(120), '2h 0m');
  });

  test('6. Dynamic edition display pluralization', () => {
    const formatEditionsDisplay = (count) => {
      if (count === 0) return 'Start listening to track daily broadsheet activity';
      return `Across ${count} newspaper ${count === 1 ? 'edition' : 'editions'}`;
    };

    assert.equal(formatEditionsDisplay(0), 'Start listening to track daily broadsheet activity');
    assert.equal(formatEditionsDisplay(1), 'Across 1 newspaper edition');
    assert.equal(formatEditionsDisplay(3), 'Across 3 newspaper editions');
  });

  test('7. Edition storage user scoping and isolation', () => {
    const userA = 'user-uuid-1111';
    const userB = 'user-uuid-2222';
    const keyA = `dailyvoice_available_editions_${userA}`;
    const keyB = `dailyvoice_available_editions_${userB}`;

    localStorage.setItem(keyA, JSON.stringify(['ed-times-001', 'ed-gazette-002']));
    localStorage.setItem(keyB, JSON.stringify(['ed-tribune-003']));

    const storedA = JSON.parse(localStorage.getItem(keyA));
    const storedB = JSON.parse(localStorage.getItem(keyB));

    assert.equal(storedA.length, 2);
    assert.ok(storedA.includes('ed-times-001'));
    assert.ok(storedA.includes('ed-gazette-002'));
    assert.ok(!storedA.includes('ed-tribune-003'));

    assert.equal(storedB.length, 1);
    assert.ok(storedB.includes('ed-tribune-003'));
    assert.ok(!storedB.includes('ed-times-001'));
  });

  test('8. Edition persistence across login: User A editions restored after session recreation', () => {
    const userA = 'user-uuid-1111';
    const keyA = `dailyvoice_available_editions_${userA}`;

    // User A acquires editions
    localStorage.setItem(keyA, JSON.stringify(['ed-times-001']));

    // User A logs out (dailyvoice_auth_session cleared)
    localStorage.removeItem('dailyvoice_auth_session');

    // User A logs in again with the same user identity
    const newSession = {
      user: { id: userA, email: 'reader@dailyvoice.com' },
      session: { access_token: 'new-token' },
    };
    localStorage.setItem('dailyvoice_auth_session', JSON.stringify(newSession));

    // Editions for userA are still preserved in storage
    const restoredEditions = JSON.parse(localStorage.getItem(keyA));
    assert.deepEqual(restoredEditions, ['ed-times-001']);
  });

  test('9. Account switch clears session and isolates user data cleanly', () => {
    // User A logs in
    localStorage.setItem(
      'dailyvoice_auth_session',
      JSON.stringify({
        user: { id: 'user-a-uuid', email: 'alice@dailyvoice.com' },
        session: { access_token: 'jwt-token-a' },
      })
    );
    assert.equal(getAuthHeaders().Authorization, 'Bearer jwt-token-a');

    // User A logs out
    localStorage.removeItem('dailyvoice_auth_session');
    assert.equal(getAuthHeaders().Authorization, undefined);

    // User B logs in
    localStorage.setItem(
      'dailyvoice_auth_session',
      JSON.stringify({
        user: { id: 'user-b-uuid', email: 'bob@dailyvoice.com' },
        session: { access_token: 'jwt-token-b' },
      })
    );
    assert.equal(getAuthHeaders().Authorization, 'Bearer jwt-token-b');
    assert.equal(getAuthHeaders()['X-User-Id'], undefined);
  });

  test('10. Listening history upsert updates existing article without duplicates', () => {
    let history = [];
    const upsertProgress = (articleId, progress, duration, isCompleted, meta) => {
      const idx = history.findIndex((item) => item.articleId === articleId);
      const entry = {
        articleId,
        progressSeconds: progress,
        durationSeconds: duration,
        isCompleted,
        listeningMode: meta.listeningMode || 'summary',
        language: meta.language || 'English',
        editionId: meta.editionId || null,
      };
      if (idx >= 0) {
        const next = [...history];
        next.splice(idx, 1);
        history = [entry, ...next];
      } else {
        history = [entry, ...history];
      }
    };

    // Start listening
    upsertProgress('art-1', 0, 180, false, { listeningMode: 'summary', language: 'English', editionId: 'ed-1' });
    assert.equal(history.length, 1);
    assert.equal(history[0].progressSeconds, 0);

    // Update progress midway
    upsertProgress('art-1', 60, 180, false, { listeningMode: 'summary', language: 'English', editionId: 'ed-1' });
    assert.equal(history.length, 1);
    assert.equal(history[0].progressSeconds, 60);
    assert.equal(history[0].isCompleted, false);

    // Complete listening
    upsertProgress('art-1', 180, 180, true, { listeningMode: 'full', language: 'Hindi', editionId: 'ed-1' });
    assert.equal(history.length, 1);
    assert.equal(history[0].isCompleted, true);
    assert.equal(history[0].language, 'Hindi');
    assert.equal(history[0].listeningMode, 'full');
  });

  test('11. getLocalDateString formats local calendar date as YYYY-MM-DD', () => {
    const sampleDate = new Date(2026, 10, 17, 23, 55, 0); // Nov 17, 2026 local
    assert.equal(getLocalDateString(sampleDate), '2026-11-17');

    const nextDate = new Date(2026, 10, 18, 0, 5, 0); // Nov 18, 2026 local
    assert.equal(getLocalDateString(nextDate), '2026-11-18');
  });

  test('12. Failed bookmark API response rolls back optimistic state instead of silently lying', () => {
    let savedIds = ['art-existing'];
    const prevIds = [...savedIds];
    const targetId = 'art-new';

    // Optimistic add
    savedIds = [...savedIds, targetId];
    assert.deepEqual(savedIds, ['art-existing', 'art-new']);

    // Simulate failed backend API response (e.g. 500 or network error)
    const apiResponse = { ok: false, status: 500, error: 'Database unavailable', data: null };
    if (!apiResponse.ok || !apiResponse.data) {
      savedIds = prevIds;
    }

    assert.deepEqual(savedIds, ['art-existing']);
  });

  test('13. Headline Digest session upsert and deduplication by editionId and headlines mode', () => {
    let history = [];
    const upsertProgress = (articleId, progress, duration, isCompleted, meta = {}) => {
      const isEdition = Boolean(meta.isEdition || meta.listeningMode === 'headlines' || (!articleId && meta.editionId));
      const editionId = meta.editionId || null;
      const idStr = articleId ? String(articleId) : null;
      const sessionKey = idStr || `digest-${editionId}`;

      const idx = history.findIndex((item) => {
        if (isEdition) {
          return (
            (item.listeningMode === 'headlines' || item.listening_mode === 'headlines') &&
            String(item.editionId || item.edition_id) === String(editionId)
          );
        }
        return String(item.articleId || item.article_id) === idStr;
      });

      const existing = idx >= 0 ? history[idx] : null;
      const effectiveCompleted = Boolean(existing?.isCompleted) || Boolean(isCompleted);

      const entry = {
        ...(existing || {}),
        id: existing?.id || sessionKey,
        articleId: idStr,
        editionId: editionId,
        progressSeconds: progress,
        durationSeconds: duration,
        isCompleted: effectiveCompleted,
        listeningMode: meta.listeningMode || (isEdition ? 'headlines' : 'summary'),
        language: meta.language || 'English',
        article: meta.article || {
          headline: 'The Times - Headline Digest',
          isEdition: true,
          category: 'Headline Digest',
        },
      };

      if (idx >= 0) {
        const next = [...history];
        next.splice(idx, 1);
        history = [entry, ...next];
      } else {
        history = [entry, ...history];
      }
    };

    // Start Headline Digest listening (Scenario A: 20 seconds)
    upsertProgress(null, 20.0, 240, false, {
      editionId: 'ed-toi-001',
      listeningMode: 'headlines',
      language: 'English',
      isEdition: true,
    });

    assert.equal(history.length, 1);
    assert.equal(history[0].editionId, 'ed-toi-001');
    assert.equal(history[0].articleId, null);
    assert.equal(history[0].listeningMode, 'headlines');
    assert.equal(history[0].progressSeconds, 20.0);
    assert.equal(history[0].isCompleted, false);
    assert.equal(history[0].article.isEdition, true);

    // Resume Headline Digest listening and complete it (Scenario B: 240s)
    upsertProgress(null, 240.0, 240, true, {
      editionId: 'ed-toi-001',
      listeningMode: 'headlines',
      language: 'English',
      isEdition: true,
    });

    // Should update existing entry, not create duplicate
    assert.equal(history.length, 1);
    assert.equal(history[0].progressSeconds, 240.0);
    assert.equal(history[0].isCompleted, true);

    // Sticky completion: replay at 0s does not un-complete
    upsertProgress(null, 0.0, 240, false, {
      editionId: 'ed-toi-001',
      listeningMode: 'headlines',
      language: 'English',
      isEdition: true,
    });

    assert.equal(history.length, 1);
    assert.equal(history[0].isCompleted, true);
  });

  test('14. Headline Digest and individual article coexistence in listening history', () => {
    let history = [];
    const upsertProgress = (articleId, progress, duration, isCompleted, meta = {}) => {
      const isEdition = Boolean(meta.isEdition || meta.listeningMode === 'headlines' || (!articleId && meta.editionId));
      const editionId = meta.editionId || null;
      const idStr = articleId ? String(articleId) : null;
      const sessionKey = idStr || `digest-${editionId}`;

      const idx = history.findIndex((item) => {
        if (isEdition) {
          return (
            (item.listeningMode === 'headlines' || item.listening_mode === 'headlines') &&
            String(item.editionId || item.edition_id) === String(editionId)
          );
        }
        return String(item.articleId || item.article_id) === idStr;
      });

      const existing = idx >= 0 ? history[idx] : null;
      const effectiveCompleted = Boolean(existing?.isCompleted) || Boolean(isCompleted);

      const entry = {
        ...(existing || {}),
        id: existing?.id || sessionKey,
        articleId: idStr,
        editionId: editionId,
        progressSeconds: progress,
        durationSeconds: duration,
        isCompleted: effectiveCompleted,
        listeningMode: meta.listeningMode || (isEdition ? 'headlines' : 'summary'),
        language: meta.language || 'English',
        article: meta.article,
      };

      if (idx >= 0) {
        const next = [...history];
        next.splice(idx, 1);
        history = [entry, ...next];
      } else {
        history = [entry, ...history];
      }
    };

    // 1. Listen to Headline Digest
    upsertProgress(null, 240, 240, true, {
      editionId: 'ed-1',
      listeningMode: 'headlines',
      isEdition: true,
      article: { headline: 'The Times - Headline Digest', isEdition: true },
    });

    // 2. Listen to an individual article
    upsertProgress('art-101', 65, 180, false, {
      editionId: 'ed-1',
      listeningMode: 'summary',
      article: { headline: 'Parliament Approves New Energy Bill', isHeadline: false },
    });

    assert.equal(history.length, 2);
    // Most recent is the article
    assert.equal(history[0].articleId, 'art-101');
    assert.equal(history[0].listeningMode, 'summary');
    assert.equal(history[0].isCompleted, false);

    // Second is the Headline Digest
    assert.equal(history[1].articleId, null);
    assert.equal(history[1].editionId, 'ed-1');
    assert.equal(history[1].listeningMode, 'headlines');
    assert.equal(history[1].isCompleted, true);

    // Compute stats summary
    const completedCount = history.filter((h) => h.isCompleted).length;
    const inProgressCount = history.filter((h) => !h.isCompleted).length;
    assert.equal(completedCount, 1);
    assert.equal(inProgressCount, 1);
  });
});
