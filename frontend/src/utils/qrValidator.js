/**
 * QR Code Payload Validation & Edition Identification Utility
 *
 * Validates newspaper QR payloads strictly according to The Daily Voice format.
 * Prevents navigation to arbitrary/external URLs and ensures database-backed verification.
 */
import { getEditions, getEditionDetails } from '../services/api.js';
import { formatBackendEdition } from './editionAdapter.js';

/**
 * Parses and strictly validates a decoded QR text string.
 *
 * Expected payload shape:
 *   http://localhost:5173/edition?paper=The_Times&edition=ED001&date=2026-11-07
 * Or any valid host pointing to /edition with paper, edition, and date query parameters.
 *
 * @param {string} decodedText - Raw decoded string from QR scanner or image
 * @returns {{ isValid: boolean, error?: string, params?: { rawPaper: string, newspaperName: string, editionCode: string, publicationDate: string } }}
 */
export function validateAndParseQRPayload(decodedText) {
  if (!decodedText || typeof decodedText !== 'string' || !decodedText.trim()) {
    return {
      isValid: false,
      error: 'Empty or invalid QR code detected. Please scan a printed newspaper QR code.',
    };
  }

  const trimmed = decodedText.trim();

  let url;
  try {
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      url = new URL(trimmed);
    } else if (trimmed.startsWith('/')) {
      // Relative path format
      url = new URL(trimmed, 'http://localhost:5173');
    } else {
      // e.g. "edition?paper=..."
      url = new URL(`http://localhost:5173/${trimmed}`);
    }
  } catch {
    return {
      isValid: false,
      error: 'Malformed QR payload: unable to parse as a valid edition URL.',
    };
  }

  // 1. Pathname validation: MUST point to an /edition route
  const pathname = url.pathname.replace(/\/+$/, '');
  if (pathname !== '/edition' && !pathname.endsWith('/edition')) {
    return {
      isValid: false,
      error: 'Unsupported QR code: payload does not point to a valid Daily Voice edition route.',
    };
  }

  // 2. Extract supported parameters
  const rawPaper = url.searchParams.get('paper');
  const rawEdition = url.searchParams.get('edition');
  const rawDate = url.searchParams.get('date');

  if (!rawPaper || !rawEdition || !rawDate) {
    return {
      isValid: false,
      error: 'Incomplete QR parameters: expected "paper", "edition", and "date".',
    };
  }

  const editionCode = rawEdition.trim().toUpperCase();
  const publicationDate = rawDate.trim();

  // 3. Edition code validation (e.g. ED001, ED002, ED003)
  if (!/^ED\d{3}$/.test(editionCode)) {
    return {
      isValid: false,
      error: `Invalid edition code format "${editionCode}". Expected format like ED001.`,
    };
  }

  // 4. Publication date validation (YYYY-MM-DD)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(publicationDate)) {
    return {
      isValid: false,
      error: `Invalid publication date format "${publicationDate}". Expected YYYY-MM-DD.`,
    };
  }

  // 5. Normalize newspaper name: replace underscores with spaces (e.g. The_Times -> The Times)
  const newspaperName = rawPaper.replace(/_/g, ' ').trim();
  if (newspaperName.length < 2) {
    return {
      isValid: false,
      error: 'Invalid newspaper publication name in QR payload.',
    };
  }

  return {
    isValid: true,
    params: {
      rawPaper,
      newspaperName,
      editionCode,
      publicationDate,
    },
  };
}

/**
 * Identifies and loads the complete database-backed edition for a validated QR code.
 *
 * @param {string} decodedText - Raw decoded string from QR scanner or image
 * @returns {Promise<{ success: boolean, edition?: object, error?: string }>}
 */
export async function identifyEditionFromQR(decodedText) {
  // Step 1 & 2: Parse and validate QR payload
  const validation = validateAndParseQRPayload(decodedText);
  if (!validation.isValid) {
    return {
      success: false,
      error: validation.error,
    };
  }

  const { newspaperName, editionCode, publicationDate } = validation.params;

  // Step 3: Retrieve available editions using backend API
  const listResp = await getEditions();
  if (!listResp.ok || !listResp.data?.data) {
    return {
      success: false,
      error: listResp.error || 'Failed to connect to newspaper server to verify editions.',
    };
  }

  const editions = listResp.data.data;

  // Step 4: Match newspaper name, edition code, and publication date
  const matched = editions.find((ed) => {
    const nameMatch =
      ed.newspaper_name?.toLowerCase().trim() === newspaperName.toLowerCase().trim();
    const codeMatch =
      ed.edition_code?.toUpperCase().trim() === editionCode.toUpperCase().trim();
    const dateMatch =
      ed.publication_date?.trim().startsWith(publicationDate.trim());
    return nameMatch && codeMatch && dateMatch;
  });

  if (!matched) {
    return {
      success: false,
      error: `Newspaper edition not found for ${newspaperName} (${editionCode}, ${publicationDate}). Please verify you are scanning a registered Daily Voice issue.`,
    };
  }

  // Step 5: Confirm that matched edition has has_qr = true
  if (!matched.has_qr) {
    return {
      success: false,
      error: `The edition "${matched.newspaper_name}" (${matched.edition_code}) is registered as a non-QR publication.`,
    };
  }

  // Step 6: Retrieve complete edition details using its database UUID
  const detailsResp = await getEditionDetails(matched.id);
  if (!detailsResp.ok || !detailsResp.data?.data) {
    return {
      success: false,
      error: detailsResp.error || 'Failed to load full article directory for this edition.',
    };
  }

  // Step 7: Return formatted database edition with complete articles
  const fullEdition = formatBackendEdition(detailsResp.data.data);
  return {
    success: true,
    edition: fullEdition,
  };
}
