/**
 * Backend API Client for The Daily Voice
 */
const API_BASE_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) ||
  'http://localhost:5000';

export async function apiLogin(email, password = '') {
  const url = `${API_BASE_URL}/api/auth/login`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });
    const data = await response.json();
    return {
      ok: response.ok,
      status: response.status,
      data,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error.message || 'Network error during login',
      data: null,
    };
  }
}

export async function apiSignup(email, password = '', fullName = '') {
  const url = `${API_BASE_URL}/api/auth/signup`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ email, password, fullName }),
    });
    const data = await response.json();
    return {
      ok: response.ok,
      status: response.status,
      data,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error.message || 'Network error during signup',
      data: null,
    };
  }
}

export async function checkBackendHealth() {
  const url = `${API_BASE_URL}/api/health`;
  try {
    const startTime = performance.now();
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    const latencyMs = Math.round(performance.now() - startTime);
    const data = await response.json();

    return {
      ok: response.ok,
      status: response.status,
      latencyMs,
      data,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      latencyMs: 0,
      error: error.message || 'Network error / Backend unreachable',
      data: null,
    };
  }
}

export async function getEditions() {
  const url = `${API_BASE_URL}/api/editions`;
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });
    const data = await response.json();
    return {
      ok: response.ok,
      status: response.status,
      data,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error.message || 'Network error fetching editions',
      data: null,
    };
  }
}

export async function getEditionDetails(editionId) {
  const url = `${API_BASE_URL}/api/editions/${editionId}`;
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });
    const data = await response.json();
    return {
      ok: response.ok,
      status: response.status,
      data,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error.message || `Network error fetching edition details for ${editionId}`,
      data: null,
    };
  }
}

export async function getEditionArticles(editionId, category = '') {
  const categoryParam = category ? `?category=${encodeURIComponent(category)}` : '';
  const url = `${API_BASE_URL}/api/editions/${editionId}/articles${categoryParam}`;
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });
    const data = await response.json();
    return {
      ok: response.ok,
      status: response.status,
      data,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error.message || `Network error fetching articles for edition ${editionId}`,
      data: null,
    };
  }
}

export async function getArticle(articleIdOrCode) {
  const url = `${API_BASE_URL}/api/articles/${encodeURIComponent(articleIdOrCode)}`;
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });
    const data = await response.json();
    return {
      ok: response.ok,
      status: response.status,
      data,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error.message || `Network error fetching article ${articleIdOrCode}`,
      data: null,
    };
  }
}

export async function uploadNewspaperPdf(file, onProgress) {
  const url = `${API_BASE_URL}/api/editions/upload`;

  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append('file', file);

    xhr.open('POST', url, true);
    xhr.setRequestHeader('Accept', 'application/json');
    const authHeaders = getAuthHeaders();
    if (authHeaders.Authorization) {
      xhr.setRequestHeader('Authorization', authHeaders.Authorization);
    }

    if (xhr.upload && typeof onProgress === 'function') {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.min(80, Math.round((event.loaded / event.total) * 80));
          onProgress(percent);
        }
      };
    }

    xhr.onload = () => {
      try {
        const json = JSON.parse(xhr.responseText);
        resolve({
          ok: xhr.status >= 200 && xhr.status < 300,
          status: xhr.status,
          data: json,
        });
      } catch {
        resolve({
          ok: false,
          status: xhr.status,
          error: `Server responded with status ${xhr.status}: ${xhr.statusText || 'Upload failed'}`,
          data: null,
        });
      }
    };

    xhr.onerror = () => {
      resolve({
        ok: false,
        status: 0,
        error: 'Network error: unable to reach the Daily Voice backend server.',
        data: null,
      });
    };

    xhr.send(formData);
  });
}

export async function getAudioLanguages() {
  const url = `${API_BASE_URL}/api/audio/languages`;
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });
    const data = await response.json();
    return {
      ok: response.ok,
      status: response.status,
      data,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error.message || 'Network error fetching audio languages',
      data: null,
    };
  }
}

export async function generateAudio({ articleId = null, editionId = null, mode = 'summary', language = 'English' }) {
  const url = `${API_BASE_URL}/api/audio/generate`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        article_id: articleId,
        edition_id: editionId,
        mode,
        language,
      }),
    });
    const data = await response.json();
    return {
      ok: response.ok,
      status: response.status,
      data,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error.message || 'Network error generating narration audio',
      data: null,
    };
  }
}

export function getAudioStreamUrl(relativeUrl) {
  if (!relativeUrl) return '';
  if (relativeUrl.startsWith('http://') || relativeUrl.startsWith('https://')) {
    return relativeUrl;
  }
  return `${API_BASE_URL}${relativeUrl.startsWith('/') ? '' : '/'}${relativeUrl}`;
}

export function getLocalDateString(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getAuthHeaders() {
  const headers = {
    'Accept': 'application/json',
  };
  try {
    const raw = localStorage.getItem('dailyvoice_auth_session');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.session?.access_token) {
        headers['Authorization'] = `Bearer ${parsed.session.access_token}`;
      }
    }
  } catch (e) {
    // ignore localStorage parsing errors
  }
  return headers;
}

export async function getUserEditions() {
  const url = `${API_BASE_URL}/api/user/editions`;
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: getAuthHeaders(),
    });
    const data = await response.json();
    if (!response.ok) {
      console.error(`[API] GET /api/user/editions failed (${response.status}):`, data);
    }
    return {
      ok: response.ok,
      status: response.status,
      data,
    };
  } catch (error) {
    console.error('[API] GET /api/user/editions network/CORS error:', error);
    return {
      ok: false,
      status: 0,
      error: error.message || 'Network error fetching user editions',
      data: null,
    };
  }
}

export async function saveUserEdition(editionId, source = 'qr_scan') {
  const url = `${API_BASE_URL}/api/user/editions`;
  try {
    const headers = {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    };
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ edition_id: editionId, source }),
    });
    const data = await response.json();
    if (!response.ok) {
      console.error(`[API] POST /api/user/editions failed (${response.status}):`, data);
    }
    return {
      ok: response.ok,
      status: response.status,
      data,
    };
  } catch (error) {
    console.error('[API] POST /api/user/editions network/CORS error:', error);
    return {
      ok: false,
      status: 0,
      error: error.message || 'Network error saving user edition',
      data: null,
    };
  }
}

export async function getListeningHistory() {
  const url = `${API_BASE_URL}/api/history`;
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: getAuthHeaders(),
    });
    const data = await response.json();
    if (!response.ok) {
      console.error(`[API] GET /api/history failed (${response.status}):`, data);
    }
    return {
      ok: response.ok,
      status: response.status,
      data,
    };
  } catch (error) {
    console.error('[API] GET /api/history network/CORS error:', error);
    return {
      ok: false,
      status: 0,
      error: error.message || 'Network error fetching listening history',
      data: null,
    };
  }
}

export async function updateListeningProgress({
  articleId,
  progressSeconds = 0,
  durationSeconds = 0,
  listenedDeltaSeconds = 0,
  localDate = getLocalDateString(),
  isCompleted = null,
  editionId = null,
  listeningMode = 'summary',
  language = 'English',
  keepalive = false,
}) {
  const url = `${API_BASE_URL}/api/history`;
  try {
    const headers = {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    };
    const body = {
      article_id: articleId,
      progress_seconds: progressSeconds,
      duration_seconds: durationSeconds,
      listened_delta_seconds: Math.max(0, Number(listenedDeltaSeconds) || 0),
      local_date: localDate || getLocalDateString(),
      edition_id: editionId,
      listening_mode: listeningMode,
      language: language,
    };
    if (isCompleted !== null && isCompleted !== undefined) {
      body.is_completed = Boolean(isCompleted);
    }
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      keepalive: Boolean(keepalive),
    });
    const data = await response.json();
    if (!response.ok) {
      console.error(`[API] POST /api/history failed (${response.status}):`, data);
    }
    return {
      ok: response.ok,
      status: response.status,
      data,
    };
  } catch (error) {
    console.error('[API] POST /api/history network/CORS error:', error);
    return {
      ok: false,
      status: 0,
      error: error.message || 'Network error recording listening progress',
      data: null,
    };
  }
}

export async function getUserStats(localDate = getLocalDateString()) {
  const query = localDate ? `?local_date=${encodeURIComponent(localDate)}` : '';
  const url = `${API_BASE_URL}/api/history/stats${query}`;
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: getAuthHeaders(),
    });
    const data = await response.json();
    if (!response.ok) {
      console.error(`[API] GET /api/history/stats failed (${response.status}):`, data);
    }
    return {
      ok: response.ok,
      status: response.status,
      data,
    };
  } catch (error) {
    console.error('[API] GET /api/history/stats network/CORS error:', error);
    return {
      ok: false,
      status: 0,
      error: error.message || 'Network error fetching user statistics',
      data: null,
    };
  }
}

export async function getBookmarks() {
  const url = `${API_BASE_URL}/api/bookmarks`;
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: getAuthHeaders(),
    });
    const data = await response.json();
    if (!response.ok) {
      console.error(`[API] GET /api/bookmarks failed (${response.status}):`, data);
    }
    return {
      ok: response.ok,
      status: response.status,
      data,
    };
  } catch (error) {
    console.error('[API] GET /api/bookmarks network/CORS error:', error);
    return {
      ok: false,
      status: 0,
      error: error.message || 'Network error fetching bookmarks',
      data: null,
    };
  }
}

export async function addBookmark(articleId) {
  const url = `${API_BASE_URL}/api/bookmarks`;
  try {
    const headers = {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    };
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ article_id: articleId }),
    });
    const data = await response.json();
    if (!response.ok) {
      console.error(`[API] POST /api/bookmarks failed (${response.status}):`, data);
    }
    return {
      ok: response.ok,
      status: response.status,
      data,
    };
  } catch (error) {
    console.error('[API] POST /api/bookmarks network/CORS error:', error);
    return {
      ok: false,
      status: 0,
      error: error.message || 'Network error adding bookmark',
      data: null,
    };
  }
}

export async function removeBookmark(articleId) {
  const url = `${API_BASE_URL}/api/bookmarks/${encodeURIComponent(articleId)}`;
  try {
    const response = await fetch(url, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    const data = await response.json();
    if (!response.ok) {
      console.error(`[API] DELETE /api/bookmarks/${articleId} failed (${response.status}):`, data);
    }
    return {
      ok: response.ok,
      status: response.status,
      data,
    };
  } catch (error) {
    console.error(`[API] DELETE /api/bookmarks/${articleId} network/CORS error:`, error);
    return {
      ok: false,
      status: 0,
      error: error.message || 'Network error removing bookmark',
      data: null,
    };
  }
}

export async function toggleBookmarkApi(articleId) {
  const url = `${API_BASE_URL}/api/bookmarks/toggle`;
  try {
    const headers = {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    };
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ article_id: articleId }),
    });
    const data = await response.json();
    if (!response.ok) {
      console.error(`[API] POST /api/bookmarks/toggle failed (${response.status}):`, data);
    }
    return {
      ok: response.ok,
      status: response.status,
      data,
    };
  } catch (error) {
    console.error('[API] POST /api/bookmarks/toggle network/CORS error:', error);
    return {
      ok: false,
      status: 0,
      error: error.message || 'Network error toggling bookmark',
      data: null,
    };
  }
}

export { API_BASE_URL };
