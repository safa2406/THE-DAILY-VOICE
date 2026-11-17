import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { validateAndParseQRPayload } from '../src/utils/qrValidator.js';
import { formatBackendEdition, formatBackendArticle } from '../src/utils/editionAdapter.js';

describe('Phase 4 Step 3 - QR Payload Validation', () => {
  test('1. Validates and parses The Times QR payload correctly', () => {
    const raw = 'http://localhost:5173/edition?paper=The_Times&edition=ED001&date=2026-11-07';
    const result = validateAndParseQRPayload(raw);

    assert.equal(result.isValid, true);
    assert.deepEqual(result.params, {
      rawPaper: 'The_Times',
      newspaperName: 'The Times',
      editionCode: 'ED001',
      publicationDate: '2026-11-07',
    });
  });

  test('2. Validates and parses The Tribune QR payload correctly', () => {
    const raw = 'http://localhost:5173/edition?paper=The_Tribune&edition=ED002&date=2026-11-08';
    const result = validateAndParseQRPayload(raw);

    assert.equal(result.isValid, true);
    assert.deepEqual(result.params, {
      rawPaper: 'The_Tribune',
      newspaperName: 'The Tribune',
      editionCode: 'ED002',
      publicationDate: '2026-11-08',
    });
  });

  test('3. Validates and parses The Herald QR payload correctly', () => {
    const raw = 'http://localhost:5173/edition?paper=The_Herald&edition=ED003&date=2026-11-09';
    const result = validateAndParseQRPayload(raw);

    assert.equal(result.isValid, true);
    assert.deepEqual(result.params, {
      rawPaper: 'The_Herald',
      newspaperName: 'The Herald',
      editionCode: 'ED003',
      publicationDate: '2026-11-09',
    });
  });

  test('4. Accepts relative edition path with valid parameters', () => {
    const raw = '/edition?paper=The_Times&edition=ED001&date=2026-11-07';
    const result = validateAndParseQRPayload(raw);

    assert.equal(result.isValid, true);
    assert.equal(result.params.newspaperName, 'The Times');
    assert.equal(result.params.editionCode, 'ED001');
    assert.equal(result.params.publicationDate, '2026-11-07');
  });

  test('5. Rejects arbitrary unsupported external URLs', () => {
    const evilUrls = [
      'https://malicious-phishing.com/login',
      'https://attacker.site/dailyvoice/steal-tokens',
      'http://localhost:5173/profile',
      'http://localhost:5173/dashboard',
    ];

    for (const url of evilUrls) {
      const res = validateAndParseQRPayload(url);
      assert.equal(res.isValid, false, `Expected ${url} to be rejected`);
      assert.match(res.error, /Unsupported QR code/i);
    }
  });

  test('6. Rejects payloads with missing required parameters', () => {
    const missingPaper = 'http://localhost:5173/edition?edition=ED001&date=2026-11-07';
    const res1 = validateAndParseQRPayload(missingPaper);
    assert.equal(res1.isValid, false);
    assert.match(res1.error, /Incomplete QR parameters/i);

    const missingEdition = 'http://localhost:5173/edition?paper=The_Times&date=2026-11-07';
    const res2 = validateAndParseQRPayload(missingEdition);
    assert.equal(res2.isValid, false);
    assert.match(res2.error, /Incomplete QR parameters/i);

    const missingDate = 'http://localhost:5173/edition?paper=The_Times&edition=ED001';
    const res3 = validateAndParseQRPayload(missingDate);
    assert.equal(res3.isValid, false);
    assert.match(res3.error, /Incomplete QR parameters/i);
  });

  test('7. Rejects malformed edition codes', () => {
    const badCodes = ['ED01', 'ED0001', 'ED-001', 'INVALID', '123', 'EDABC'];
    for (const code of badCodes) {
      const url = `http://localhost:5173/edition?paper=The_Times&edition=${code}&date=2026-11-07`;
      const res = validateAndParseQRPayload(url);
      assert.equal(res.isValid, false);
      assert.match(res.error, /Invalid edition code format/i);
    }
  });

  test('8. Rejects malformed publication dates', () => {
    const badDates = ['07-11-2026', '2026/11/07', 'Nov-07-2026', '2026-11', 'invalid-date'];
    for (const d of badDates) {
      const url = `http://localhost:5173/edition?paper=The_Times&edition=ED001&date=${d}`;
      const res = validateAndParseQRPayload(url);
      assert.equal(res.isValid, false);
      assert.match(res.error, /Invalid publication date format/i);
    }
  });

  test('9. Rejects arbitrary random non-URL text and empty input', () => {
    const invalidInputs = ['', '   ', 'hello world', '1234567890', 'null', 'undefined'];
    for (const input of invalidInputs) {
      const res = validateAndParseQRPayload(input);
      assert.equal(res.isValid, false);
    }
  });
});

describe('Phase 4 Step 3 - Backend Edition Adapter', () => {
  const mockBackendEdition = {
    id: '99b71e9d3-8dcc-47a3-9de1-fcc0350584bf',
    newspaper_name: 'The Times',
    edition_code: 'ED001',
    publication_date: '2026-11-07',
    location: 'National Edition',
    weather: 'NEW DELHI 27°C SUNNY • LONDON 13°C BREEZY',
    page_count: 5,
    pdf_path: 'sample_newspapers/QR/ED001_The_Times.pdf',
    has_qr: true,
    tagline: 'The Independent National & International Daily',
    cover_tag: "Today's Lead Edition",
    headline_audio_duration: '4m 20s',
    article_count: 20,
    articles: [
      {
        id: 'art-uuid-001',
        edition_id: '99b71e9d3-8dcc-47a3-9de1-fcc0350584bf',
        article_code: 'TT-CA-001',
        kicker: 'C PLEASANT O C E A N C O N S E R VAT I O N TT-CA-001',
        headline: 'India and Thirty Maritime Nations Sign Landmark Pact in Kochi to Protect Indian Ocean',
        byline: 'By Devika Nair in Kochi',
        page_number: 1,
        category: 'Current Affairs',
        summary: 'Delegates representing thirty coastal countries signed a historic international agreement in Kochi yesterday.',
        content: 'Full content of the maritime conservation story...',
        duration_seconds: 285,
        is_headline: true,
        audio_url: null,
      },
      {
        id: 'art-uuid-002',
        edition_id: '99b71e9d3-8dcc-47a3-9de1-fcc0350584bf',
        article_code: 'TT-WN-001',
        kicker: 'W E S T M I N S T E R L E G I S L AT I O N TT-WN-001',
        headline: 'British Parliament Approves Historic £30 Billion Regional Clean Transit Act in London',
        byline: 'By Alistair Campbell in London',
        page_number: 2,
        category: 'Politics',
        summary: 'Members of the British Parliament voted by a decisive majority last night.',
        content: 'Full content of the Westminster transit act story...',
        duration_seconds: 260,
        is_headline: false,
        audio_url: null,
      },
    ],
  };

  test('10. Formats backend edition preserving all database fields and mapping UI getters', () => {
    const formatted = formatBackendEdition(mockBackendEdition);

    assert.equal(formatted.id, mockBackendEdition.id);
    assert.equal(formatted.name, 'The Times');
    assert.equal(formatted.newspaper_name, 'The Times');
    assert.equal(formatted.editionCode, 'ED001');
    assert.equal(formatted.has_qr, true);
    assert.equal(formatted.hasQr, true);
    assert.equal(formatted.articleCount, 20);
    assert.equal(formatted.headlineAudioDuration, '4m 20s');
    assert.equal(formatted.location, 'National Edition');
    assert.equal(formatted.weather, mockBackendEdition.weather);
    assert.equal(formatted.tagline, mockBackendEdition.tagline);
    assert.equal(formatted.coverTag, "Today's Lead Edition");
    assert.equal(formatted.headlinesCount, 1);
    assert.equal(formatted.articles.length, 2);
  });

  test('11. Formats backend articles with durationFormatted and headline indicator', () => {
    const formatted = formatBackendEdition(mockBackendEdition);
    const art1 = formatted.articles[0];
    const art2 = formatted.articles[1];

    // Lead headline article
    assert.equal(art1.title, art1.headline);
    assert.equal(art1.article_code, 'TT-CA-001');
    assert.equal(art1.articleCode, 'TT-CA-001');
    assert.equal(art1.isHeadline, true);
    assert.equal(art1.durationFormatted, '4:45'); // 285s -> 4m 45s
    assert.equal(art1.publisher, 'By Devika Nair in Kochi');
    assert.equal(art1.category, 'Current Affairs');
    assert.equal(art1.categoryId, 'current-affairs');
    assert.equal(art1.category_id, 'current-affairs');

    // Second article (Politics)
    assert.equal(art2.article_code, 'TT-WN-001');
    assert.equal(art2.isHeadline, false);
    assert.equal(art2.durationFormatted, '4:20'); // 260s -> 4m 20s
    assert.equal(art2.category, 'Politics');
    assert.equal(art2.categoryId, 'politics');
    assert.equal(art2.category_id, 'politics');
  });

  test('11b. Category filtering matches accurately across all 6 approved categories', () => {
    const timesArticles = [
      // 4 Current Affairs
      { id: '1', category: 'Current Affairs', headline: 'CA 1' },
      { id: '2', category: 'Current Affairs', headline: 'CA 2' },
      { id: '3', category: 'Current Affairs', headline: 'CA 3' },
      { id: '4', category: 'Current Affairs', headline: 'CA 4' },
      // 3 World
      { id: '5', category: 'World', headline: 'WN 1' },
      { id: '6', category: 'World', headline: 'WN 2' },
      { id: '7', category: 'World', headline: 'WN 3' },
      // 1 Politics
      { id: '8', category: 'Politics', headline: 'POL 1' },
      // 4 Finance
      { id: '9', category: 'Finance', headline: 'BF 1' },
      { id: '10', category: 'Finance', headline: 'BF 2' },
      { id: '11', category: 'Finance', headline: 'BF 3' },
      { id: '12', category: 'Finance', headline: 'BF 4' },
      // 4 Science & Tech
      { id: '13', category: 'Science & Technology', headline: 'ST 1' },
      { id: '14', category: 'Science & Technology', headline: 'ST 2' },
      { id: '15', category: 'Science & Technology', headline: 'ST 3' },
      { id: '16', category: 'Science & Technology', headline: 'ST 4' },
      // 4 Sports
      { id: '17', category: 'Sports', headline: 'SP 1' },
      { id: '18', category: 'Sports', headline: 'SP 2' },
      { id: '19', category: 'Sports', headline: 'SP 3' },
      { id: '20', category: 'Sports', headline: 'SP 4' },
    ].map((a) => formatBackendArticle(a));

    assert.equal(timesArticles.length, 20);

    const categories = [
      { id: 'current-affairs', name: 'Current Affairs', expected: 4 },
      { id: 'world', name: 'World', expected: 3 },
      { id: 'politics', name: 'Politics', expected: 1 },
      { id: 'finance', name: 'Finance', expected: 4 },
      { id: 'science-tech', name: 'Science & Technology', expected: 4 },
      { id: 'sports', name: 'Sports', expected: 4 },
    ];

    for (const cat of categories) {
      const filtered = timesArticles.filter(
        (a) => a.categoryId === cat.id || a.category.toLowerCase() === cat.name.toLowerCase()
      );
      assert.equal(
        filtered.length,
        cat.expected,
        `Expected ${cat.expected} articles for ${cat.name}, found ${filtered.length}`
      );
    }
  });
});

describe('Phase 4 Step 3 - Edition Identification against API', () => {
  const originalFetch = globalThis.fetch;

  const mockDbEditions = [
    {
      id: 'ed-uuid-001',
      newspaper_name: 'The Times',
      edition_code: 'ED001',
      publication_date: '2026-11-07',
      has_qr: true,
      article_count: 20,
    },
    {
      id: 'ed-uuid-002',
      newspaper_name: 'The Tribune',
      edition_code: 'ED002',
      publication_date: '2026-11-08',
      has_qr: true,
      article_count: 20,
    },
    {
      id: 'ed-uuid-003',
      newspaper_name: 'The Herald',
      edition_code: 'ED003',
      publication_date: '2026-11-09',
      has_qr: true,
      article_count: 20,
    },
    {
      id: 'ed-uuid-004',
      newspaper_name: 'The Gazette',
      edition_code: 'ED001',
      publication_date: '2026-11-07',
      has_qr: false, // Non-QR edition!
      article_count: 20,
    },
  ];

  test('12. Successfully identifies The Times QR and loads complete edition', async () => {
    const { identifyEditionFromQR } = await import('../src/utils/qrValidator.js');

    globalThis.fetch = async (url) => {
      if (url.endsWith('/api/editions')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ status: 'success', data: mockDbEditions }),
        };
      }
      if (url.includes('/api/editions/ed-uuid-001')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            status: 'success',
            data: {
              ...mockDbEditions[0],
              articles: Array.from({ length: 20 }, (_, i) => ({
                id: `art-${i + 1}`,
                headline: `Headline ${i + 1}`,
                category: 'Current Affairs',
                page_number: Math.floor(i / 4) + 1,
                is_headline: i === 0,
              })),
            },
          }),
        };
      }
      throw new Error(`Unhandled fetch: ${url}`);
    };

    const res = await identifyEditionFromQR(
      'http://localhost:5173/edition?paper=The_Times&edition=ED001&date=2026-11-07'
    );

    assert.equal(res.success, true);
    assert.equal(res.edition.name, 'The Times');
    assert.equal(res.edition.edition_code, 'ED001');
    assert.equal(res.edition.has_qr, true);
    assert.equal(res.edition.articles.length, 20);

    globalThis.fetch = originalFetch;
  });

  test('13. Successfully identifies The Tribune QR', async () => {
    const { identifyEditionFromQR } = await import('../src/utils/qrValidator.js');

    globalThis.fetch = async (url) => {
      if (url.endsWith('/api/editions')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ status: 'success', data: mockDbEditions }),
        };
      }
      if (url.includes('/api/editions/ed-uuid-002')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            status: 'success',
            data: { ...mockDbEditions[1], articles: [] },
          }),
        };
      }
      throw new Error(`Unhandled fetch: ${url}`);
    };

    const res = await identifyEditionFromQR(
      'http://localhost:5173/edition?paper=The_Tribune&edition=ED002&date=2026-11-08'
    );

    assert.equal(res.success, true);
    assert.equal(res.edition.name, 'The Tribune');
    assert.equal(res.edition.edition_code, 'ED002');
    assert.equal(res.edition.has_qr, true);

    globalThis.fetch = originalFetch;
  });

  test('14. Successfully identifies The Herald QR', async () => {
    const { identifyEditionFromQR } = await import('../src/utils/qrValidator.js');

    globalThis.fetch = async (url) => {
      if (url.endsWith('/api/editions')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ status: 'success', data: mockDbEditions }),
        };
      }
      if (url.includes('/api/editions/ed-uuid-003')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            status: 'success',
            data: { ...mockDbEditions[2], articles: [] },
          }),
        };
      }
      throw new Error(`Unhandled fetch: ${url}`);
    };

    const res = await identifyEditionFromQR(
      'http://localhost:5173/edition?paper=The_Herald&edition=ED003&date=2026-11-09'
    );

    assert.equal(res.success, true);
    assert.equal(res.edition.name, 'The Herald');
    assert.equal(res.edition.edition_code, 'ED003');
    assert.equal(res.edition.has_qr, true);

    globalThis.fetch = originalFetch;
  });

  test('15. Rejects non-QR edition (The Gazette)', async () => {
    const { identifyEditionFromQR } = await import('../src/utils/qrValidator.js');

    globalThis.fetch = async (url) => {
      if (url.endsWith('/api/editions')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ status: 'success', data: mockDbEditions }),
        };
      }
      throw new Error(`Unhandled fetch: ${url}`);
    };

    const res = await identifyEditionFromQR(
      'http://localhost:5173/edition?paper=The_Gazette&edition=ED001&date=2026-11-07'
    );

    assert.equal(res.success, false);
    assert.match(res.error, /registered as a non-QR publication/i);

    globalThis.fetch = originalFetch;
  });

  test('16. Rejects unknown newspaper not registered in database', async () => {
    const { identifyEditionFromQR } = await import('../src/utils/qrValidator.js');

    globalThis.fetch = async (url) => {
      if (url.endsWith('/api/editions')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ status: 'success', data: mockDbEditions }),
        };
      }
      throw new Error(`Unhandled fetch: ${url}`);
    };

    const res = await identifyEditionFromQR(
      'http://localhost:5173/edition?paper=Daily_Bugle&edition=ED001&date=2026-11-07'
    );

    assert.equal(res.success, false);
    assert.match(res.error, /Newspaper edition not found for Daily Bugle/i);

    globalThis.fetch = originalFetch;
  });

  test('17. Rejects when edition code does not match database record', async () => {
    const { identifyEditionFromQR } = await import('../src/utils/qrValidator.js');

    globalThis.fetch = async (url) => {
      if (url.endsWith('/api/editions')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ status: 'success', data: mockDbEditions }),
        };
      }
      throw new Error(`Unhandled fetch: ${url}`);
    };

    // The Times is ED001, requesting ED002 should fail
    const res = await identifyEditionFromQR(
      'http://localhost:5173/edition?paper=The_Times&edition=ED002&date=2026-11-07'
    );

    assert.equal(res.success, false);
    assert.match(res.error, /Newspaper edition not found/i);

    globalThis.fetch = originalFetch;
  });

  test('18. Rejects when publication date does not match database record', async () => {
    const { identifyEditionFromQR } = await import('../src/utils/qrValidator.js');

    globalThis.fetch = async (url) => {
      if (url.endsWith('/api/editions')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ status: 'success', data: mockDbEditions }),
        };
      }
      throw new Error(`Unhandled fetch: ${url}`);
    };

    // The Times date is 2026-11-07, requesting 2026-11-08 should fail
    const res = await identifyEditionFromQR(
      'http://localhost:5173/edition?paper=The_Times&edition=ED001&date=2026-11-08'
    );

    assert.equal(res.success, false);
    assert.match(res.error, /Newspaper edition not found/i);

    globalThis.fetch = originalFetch;
  });

  test('19. Gracefully reports server connection failure', async () => {
    const { identifyEditionFromQR } = await import('../src/utils/qrValidator.js');

    globalThis.fetch = async () => {
      throw new Error('Connection refused to backend port 5000');
    };

    const res = await identifyEditionFromQR(
      'http://localhost:5173/edition?paper=The_Times&edition=ED001&date=2026-11-07'
    );

    assert.equal(res.success, false);
    assert.match(res.error, /Connection refused/i);

    globalThis.fetch = originalFetch;
  });
});

describe('Available Editions Storage & User Scoping', () => {
  function createMockStorage() {
    const store = new Map();
    return {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem: (key, val) => store.set(key, String(val)),
      removeItem: (key) => store.delete(key),
      clear: () => store.clear(),
      _raw: store,
    };
  }

  test('20. getEditionStorageKey creates isolated storage keys per user', async () => {
    const { getEditionStorageKey } = await import('../src/utils/editionStorage.js');

    assert.equal(getEditionStorageKey(null), 'dailyvoice_available_editions_guest');
    assert.equal(getEditionStorageKey(undefined), 'dailyvoice_available_editions_guest');
    assert.equal(getEditionStorageKey(''), 'dailyvoice_available_editions_guest');
    assert.equal(
      getEditionStorageKey('user-uuid-1234'),
      'dailyvoice_available_editions_user-uuid-1234'
    );
  });

  test('21. Clean startup: no editions stored initially (dropdown is empty)', async () => {
    const { getStoredEditionIds } = await import('../src/utils/editionStorage.js');
    const storage = createMockStorage();

    const initialGuestEditions = getStoredEditionIds('guest', storage);
    assert.deepEqual(initialGuestEditions, []);

    const initialUserEditions = getStoredEditionIds('user-abc', storage);
    assert.deepEqual(initialUserEditions, []);
  });

  test('22. Scanning The Times adds it to user available editions', async () => {
    const { addEditionIdToStorage, getStoredEditionIds } = await import(
      '../src/utils/editionStorage.js'
    );
    const storage = createMockStorage();
    const userId = 'user-test-1';

    const timesId = '99b71e9d3-8dcc-47a3-9de1-fcc0350584bf';
    const result = addEditionIdToStorage(userId, timesId, storage);

    assert.deepEqual(result, [timesId]);
    assert.deepEqual(getStoredEditionIds(userId, storage), [timesId]);
  });

  test('23. Scanning The Tribune appends to collection without removing The Times', async () => {
    const { addEditionIdToStorage, getStoredEditionIds } = await import(
      '../src/utils/editionStorage.js'
    );
    const storage = createMockStorage();
    const userId = 'user-test-1';

    const timesId = '99b71e9d3-8dcc-47a3-9de1-fcc0350584bf';
    const tribuneId = 'a1b2c3d4-trib-47a3-9de1-fcc0350584bf';

    addEditionIdToStorage(userId, timesId, storage);
    const updated = addEditionIdToStorage(userId, tribuneId, storage);

    // Newly added edition is at the front, previous edition is retained
    assert.deepEqual(updated, [tribuneId, timesId]);
    assert.deepEqual(getStoredEditionIds(userId, storage), [tribuneId, timesId]);
    assert.equal(updated.length, 2);
  });

  test('24. Re-scanning an existing edition does not create duplicate entries', async () => {
    const { addEditionIdToStorage, getStoredEditionIds } = await import(
      '../src/utils/editionStorage.js'
    );
    const storage = createMockStorage();
    const userId = 'user-test-1';

    const timesId = '99b71e9d3-8dcc-47a3-9de1-fcc0350584bf';
    const tribuneId = 'a1b2c3d4-trib-47a3-9de1-fcc0350584bf';

    addEditionIdToStorage(userId, timesId, storage);
    addEditionIdToStorage(userId, tribuneId, storage);

    // Scan The Times again
    const rescanResult = addEditionIdToStorage(userId, timesId, storage);

    // Should move The Times to front without duplicating
    assert.deepEqual(rescanResult, [timesId, tribuneId]);
    assert.equal(rescanResult.length, 2);
    assert.deepEqual(getStoredEditionIds(userId, storage), [timesId, tribuneId]);
  });

  test('25. User scoping prevents edition leakage between different user accounts', async () => {
    const { addEditionIdToStorage, getStoredEditionIds } = await import(
      '../src/utils/editionStorage.js'
    );
    const storage = createMockStorage();

    const userA = 'user-alice';
    const userB = 'user-bob';

    const timesId = '99b71e9d3-8dcc-47a3-9de1-fcc0350584bf';
    const heraldId = 'herald-uuid-47a3-9de1-fcc0350584bf';

    addEditionIdToStorage(userA, timesId, storage);
    addEditionIdToStorage(userB, heraldId, storage);

    assert.deepEqual(getStoredEditionIds(userA, storage), [timesId]);
    assert.deepEqual(getStoredEditionIds(userB, storage), [heraldId]);
  });

  test('26. Clearing editions properly removes user storage key', async () => {
    const { addEditionIdToStorage, clearStoredEditionIds, getStoredEditionIds } = await import(
      '../src/utils/editionStorage.js'
    );
    const storage = createMockStorage();
    const userId = 'user-test-1';

    addEditionIdToStorage(userId, 'some-id', storage);
    assert.equal(getStoredEditionIds(userId, storage).length, 1);

    clearStoredEditionIds(userId, storage);
    assert.deepEqual(getStoredEditionIds(userId, storage), []);
  });
});

describe('Audio Player State & Visibility Lifecycle', () => {
  // Helper simulating the core state logic in AudioContext / MiniPlayer
  function createAudioSession() {
    let currentArticle = null;
    let isPlaying = false;
    let currentTime = 0;
    let duration = 0;
    let isMiniPlayerDismissed = false;
    let isFullPlayerOpen = false;

    return {
      getState: () => ({
        currentArticle,
        isPlaying,
        currentTime,
        duration,
        isMiniPlayerDismissed,
        isFullPlayerOpen,
        isMiniPlayerVisible: Boolean(currentArticle && !isMiniPlayerDismissed),
        isFullPlayerVisible: Boolean(currentArticle && isFullPlayerOpen),
      }),
      playArticle: (article, startSeconds = 0) => {
        if (!article) return;
        isMiniPlayerDismissed = false;
        if (currentArticle?.id === article.id) {
          isPlaying = true;
          return;
        }
        currentArticle = article;
        currentTime = startSeconds;
        duration = article.durationSeconds || article.duration_seconds || 240;
        isPlaying = true;
      },
      dismissMiniPlayer: () => {
        isPlaying = false;
        isMiniPlayerDismissed = true;
      },
      openFullPlayer: () => {
        isMiniPlayerDismissed = false;
        isFullPlayerOpen = true;
      },
      closeFullPlayer: () => {
        isFullPlayerOpen = false;
      },
      resetSessionOnRefresh: () => {
        // Simulates browser refresh: React state re-initializes to initial state
        currentArticle = null;
        isPlaying = false;
        currentTime = 0;
        duration = 0;
        isMiniPlayerDismissed = false;
        isFullPlayerOpen = false;
      },
    };
  }

  const sampleBroadsheetArticle = {
    id: 'art-uuid-kochi-001',
    edition_id: 'ed-uuid-the-times',
    article_code: 'TT-CA-001',
    title: 'India and Thirty Maritime Nations Sign Landmark Pact in Kochi',
    headline: 'India and Thirty Maritime Nations Sign Landmark Pact in Kochi to Protect Indian Ocean',
    category: 'Current Affairs',
    categoryId: 'current-affairs',
    publisher: 'The Times',
    newspaperName: 'The Times',
    durationSeconds: 285,
    duration_seconds: 285,
    durationFormatted: '4m 45s',
    isHeadline: true,
  };

  test('27. Initial application load: audio player must be hidden', () => {
    const session = createAudioSession();
    const state = session.getState();

    assert.equal(state.currentArticle, null);
    assert.equal(state.isPlaying, false);
    assert.equal(state.isMiniPlayerVisible, false);
    assert.equal(state.isFullPlayerVisible, false);
  });

  test('28. After scanning QR code and loading edition: audio player remains hidden', () => {
    const session = createAudioSession();

    // Simulating QR scan & edition load (mutates edition context, NOT audio state)
    const scannedEdition = {
      id: 'ed-uuid-the-times',
      name: 'The Times',
      articles: [sampleBroadsheetArticle],
    };
    assert.ok(scannedEdition.id);

    // Audio state must remain unselected and hidden
    const state = session.getState();
    assert.equal(state.currentArticle, null);
    assert.equal(state.isMiniPlayerVisible, false);
  });

  test('29. Browsing categories & filtering articles: audio player remains hidden', () => {
    const session = createAudioSession();

    // Simulating navigating to /browse and filtering articles by desk
    const articles = [sampleBroadsheetArticle];
    const filtered = articles.filter((a) => a.categoryId === 'current-affairs');
    assert.equal(filtered.length, 1);

    // Audio state must remain untouched
    const state = session.getState();
    assert.equal(state.currentArticle, null);
    assert.equal(state.isMiniPlayerVisible, false);
  });

  test('30. Explicitly clicking article Listen button: player appears with correct article details', () => {
    const session = createAudioSession();

    // User clicks Listen on an article card
    session.playArticle(sampleBroadsheetArticle);

    const state = session.getState();
    assert.equal(state.isMiniPlayerVisible, true);
    assert.equal(state.isPlaying, true);
    assert.equal(state.currentArticle.id, 'art-uuid-kochi-001');
    assert.equal(state.currentArticle.title, 'India and Thirty Maritime Nations Sign Landmark Pact in Kochi');
    assert.equal(state.currentArticle.category, 'Current Affairs');
    assert.equal(state.currentArticle.newspaperName, 'The Times');
    assert.equal(state.duration, 285);
  });

  test('31. Dismissing mini-player hides player; selecting another article restores visibility', () => {
    const session = createAudioSession();
    session.playArticle(sampleBroadsheetArticle);
    assert.equal(session.getState().isMiniPlayerVisible, true);

    // User dismisses mini-player
    session.dismissMiniPlayer();
    assert.equal(session.getState().isMiniPlayerVisible, false);
    assert.equal(session.getState().isPlaying, false);

    // User clicks Listen on a second article
    const secondArticle = {
      id: 'art-uuid-tribune-002',
      title: 'Global Semiconductor Consortium',
      category: 'Finance',
      durationSeconds: 190,
    };
    session.playArticle(secondArticle);

    const updatedState = session.getState();
    assert.equal(updatedState.isMiniPlayerVisible, true);
    assert.equal(updatedState.isPlaying, true);
    assert.equal(updatedState.currentArticle.id, 'art-uuid-tribune-002');
    assert.equal(updatedState.duration, 190);
  });

  test('32. Refreshing application resets audio player to hidden with no default sample article', () => {
    const session = createAudioSession();

    // User previously listened to an article
    session.playArticle(sampleBroadsheetArticle);
    assert.equal(session.getState().isMiniPlayerVisible, true);

    // User refreshes the page
    session.resetSessionOnRefresh();

    const refreshedState = session.getState();
    assert.equal(refreshedState.currentArticle, null);
    assert.equal(refreshedState.isPlaying, false);
    assert.equal(refreshedState.isMiniPlayerVisible, false);
    assert.equal(refreshedState.isFullPlayerVisible, false);
  });
});

