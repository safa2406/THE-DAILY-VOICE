/**
 * Utility adapter to map backend database Edition and Article models
 * to the shapes expected by existing frontend components, preserving
 * all original database fields and adding UI convenience getters.
 */

export const CATEGORY_SLUG_MAP = {
  'current affairs': 'current-affairs',
  'world': 'world',
  'sports': 'sports',
  'finance': 'finance',
  'science & technology': 'science-tech',
  'science and technology': 'science-tech',
  'politics': 'politics',
};

export function getCategorySlug(categoryName) {
  if (!categoryName) return 'current-affairs';
  const lower = categoryName.toLowerCase().trim();
  return CATEGORY_SLUG_MAP[lower] || lower.replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export function formatBackendArticle(art, edition = null) {
  if (!art) return null;

  const durationSec = art.duration_seconds || 180;
  const mins = Math.floor(durationSec / 60);
  const secs = (durationSec % 60).toString().padStart(2, '0');
  const durationFormatted = `${mins}:${secs}`;
  const paperName = edition?.newspaper_name || art.newspaper_name || 'Broadsheet';
  const categorySlug = getCategorySlug(art.category);

  return {
    ...art,
    id: art.id,
    editionId: art.edition_id,
    edition_id: art.edition_id,
    title: art.headline || art.title,
    headline: art.headline || art.title,
    category: art.category,
    categoryId: categorySlug,
    category_id: categorySlug,
    kicker: art.kicker,
    article_code: art.article_code,
    articleCode: art.article_code,
    byline: art.byline,
    publisher: art.byline || paperName,
    summary: art.summary,
    content: art.content,
    pageNumber: art.page_number,
    page_number: art.page_number,
    durationSeconds: durationSec,
    duration_seconds: durationSec,
    durationFormatted,
    isHeadline: Boolean(art.is_headline),
    is_headline: Boolean(art.is_headline),
    audioUrl: art.audio_url,
    audio_url: art.audio_url,
    newspaperName: paperName,
  };
}

export function formatBackendEdition(backendEdition) {
  if (!backendEdition) return null;

  // Format publication date into "Saturday, November 7, 2026"
  let dateFormatted = backendEdition.publication_date;
  let shortDate = backendEdition.publication_date;
  if (backendEdition.publication_date) {
    try {
      const [year, month, day] = backendEdition.publication_date.split('-').map(Number);
      const d = new Date(year, month - 1, day);
      dateFormatted = d.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      shortDate = d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      // Fallback to raw string if parsing fails
    }
  }

  const articles = (backendEdition.articles || []).map((art) =>
    formatBackendArticle(art, backendEdition)
  );

  const headlineCount = articles.filter((a) => a.isHeadline).length;

  return {
    ...backendEdition,
    id: backendEdition.id,
    name: backendEdition.newspaper_name,
    newspaper_name: backendEdition.newspaper_name,
    editionCode: backendEdition.edition_code,
    edition_code: backendEdition.edition_code,
    editionFormatted: `${backendEdition.edition_code} — ${shortDate}`,
    editionId: `${backendEdition.edition_code} • ${backendEdition.newspaper_name}`,
    date: dateFormatted,
    publication_date: backendEdition.publication_date,
    shortDate,
    location: backendEdition.location || 'Broadsheet',
    weather: backendEdition.weather || 'FAIR',
    tagline: backendEdition.tagline || 'The Independent National & International Daily',
    coverTag: backendEdition.cover_tag || 'Daily Edition',
    headlinesCount: headlineCount,
    headlineAudioDuration: backendEdition.headline_audio_duration || '4m 00s',
    articleCount: backendEdition.article_count || articles.length || (backendEdition.page_count ? backendEdition.page_count * 4 : 20),
    has_qr: Boolean(backendEdition.has_qr),
    hasQr: Boolean(backendEdition.has_qr),
    pdf_path: backendEdition.pdf_path,
    articles,
  };
}
