import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { formatBackendEdition } from '../src/utils/editionAdapter.js';
import {
  getEditionStorageKey,
  getStoredEditionIds,
  addEditionIdToStorage,
  clearStoredEditionIds,
} from '../src/utils/editionStorage.js';

describe('Phase 4 Step 4 - PDF Uploader Validation & Storage Integration', () => {
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

  // Helper simulating PDF file validation logic in PDFUploaderModal
  function validateSelectedFile(file) {
    if (!file) return { isValid: false, error: 'No file selected.' };
    const name = file.name || '';
    if (!name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      return {
        isValid: false,
        error: 'Unsupported file format. Please upload a standard PDF broadsheet file.',
      };
    }
    if (file.size === 0) {
      return {
        isValid: false,
        error: 'The selected file is empty (0 bytes). Please select a valid PDF.',
      };
    }
    if (file.size > 50 * 1024 * 1024) {
      return {
        isValid: false,
        error: 'File size exceeds the 50 MB limit. Please select a smaller broadsheet PDF.',
      };
    }
    return { isValid: true, file };
  }

  test('1. Validates and accepts valid newspaper broadsheet PDF', () => {
    const file = { name: 'ED001_The_Gazette.pdf', size: 1024 * 1024 * 2, type: 'application/pdf' };
    const res = validateSelectedFile(file);
    assert.equal(res.isValid, true);
  });

  test('2. Rejects non-PDF files gracefully', () => {
    const badFiles = [
      { name: 'newspaper.docx', size: 1024, type: 'application/msword' },
      { name: 'edition.jpg', size: 2048, type: 'image/jpeg' },
      { name: 'audio.mp3', size: 5000, type: 'audio/mpeg' },
    ];
    for (const f of badFiles) {
      const res = validateSelectedFile(f);
      assert.equal(res.isValid, false);
      assert.match(res.error, /Unsupported file format/i);
    }
  });

  test('3. Rejects empty 0-byte PDF files', () => {
    const emptyPdf = { name: 'empty.pdf', size: 0, type: 'application/pdf' };
    const res = validateSelectedFile(emptyPdf);
    assert.equal(res.isValid, false);
    assert.match(res.error, /empty/i);
  });

  test('4. Rejects PDF files exceeding 50 MB', () => {
    const hugePdf = {
      name: 'giant.pdf',
      size: 55 * 1024 * 1024, // 55 MB
      type: 'application/pdf',
    };
    const res = validateSelectedFile(hugePdf);
    assert.equal(res.isValid, false);
    assert.match(res.error, /50 MB/i);
  });

  test('5. Uploading The Gazette adds it to user available editions', () => {
    const storage = createMockStorage();
    const userId = 'user-reporter-1';

    const gazetteBackendData = {
      id: '337c0854-0455-46e5-a27e-0bfdaf3e2093',
      newspaper_name: 'The Gazette',
      edition_code: 'ED001',
      publication_date: '2026-11-07',
      has_qr: false,
      location: 'Eastern Broadsheet',
      weather: 'KOLKATA 29°C FAIR • BHUBANESWAR 31°C WARM',
      page_count: 5,
      tagline: 'The Modern Broadcaster • Accurate, Comprehensive & Reliable',
      cover_tag: 'Weekend Broadsheet',
      headline_audio_duration: '4m 00s',
      articles: [
        {
          id: 'art-gaz-001',
          edition_id: '337c0854-0455-46e5-a27e-0bfdaf3e2093',
          article_code: 'TG-CA-001',
          kicker: 'METRO EXPANSION TG-CA-001',
          headline: 'Kolkata Underwater Metro Passes 400,000 Passenger Milestone',
          byline: 'By Devika Bose in Kolkata',
          page_number: 1,
          category: 'Current Affairs',
          summary: 'Kolkata metro under river Hooghly passes milestone.',
          content: 'Detailed reporting content...',
          duration_seconds: 240,
          is_headline: true,
        },
      ],
    };

    const formatted = formatBackendEdition(gazetteBackendData);
    assert.equal(formatted.name, 'The Gazette');
    assert.equal(formatted.editionCode, 'ED001');
    assert.equal(formatted.hasQr, false);
    assert.equal(formatted.articleCount, 1);

    const updatedIds = addEditionIdToStorage(userId, formatted.id, storage);
    assert.deepEqual(updatedIds, [formatted.id]);
    assert.deepEqual(getStoredEditionIds(userId, storage), [formatted.id]);
  });

  test('6. Uploading multiple NoQR PDFs accumulates editions without duplicates', () => {
    const storage = createMockStorage();
    const userId = 'user-reporter-1';

    const gazetteId = '337c0854-0455-46e5-a27e-0bfdaf3e2093';
    const dailyPostId = '43922228-7b34-4b05-88c1-e9ba99508cea';
    const nationalStandardId = '30045ced-5fdd-4e14-928c-67349f6ca35e';

    // 1. Upload The Gazette
    addEditionIdToStorage(userId, gazetteId, storage);
    assert.deepEqual(getStoredEditionIds(userId, storage), [gazetteId]);

    // 2. Upload The Daily Post
    addEditionIdToStorage(userId, dailyPostId, storage);
    assert.deepEqual(getStoredEditionIds(userId, storage), [dailyPostId, gazetteId]);

    // 3. Upload The National Standard
    addEditionIdToStorage(userId, nationalStandardId, storage);
    assert.deepEqual(getStoredEditionIds(userId, storage), [
      nationalStandardId,
      dailyPostId,
      gazetteId,
    ]);

    // 4. Re-upload The Gazette (must not duplicate; moves to front)
    addEditionIdToStorage(userId, gazetteId, storage);
    assert.deepEqual(getStoredEditionIds(userId, storage), [
      gazetteId,
      nationalStandardId,
      dailyPostId,
    ]);
  });

  test('7. Scanned QR editions and uploaded NoQR editions coexist seamlessly', () => {
    const storage = createMockStorage();
    const userId = 'user-hybrid-1';

    const timesId = 'ac2e42c0-ce34-4dc4-9e19-1a54aa888456'; // Scanned via QR
    const gazetteId = '337c0854-0455-46e5-a27e-0bfdaf3e2093'; // Uploaded via PDF

    // User first scans The Times
    addEditionIdToStorage(userId, timesId, storage);
    // User then uploads The Gazette PDF
    addEditionIdToStorage(userId, gazetteId, storage);

    const availableIds = getStoredEditionIds(userId, storage);
    assert.equal(availableIds.length, 2);
    assert.ok(availableIds.includes(timesId));
    assert.ok(availableIds.includes(gazetteId));
  });
});
