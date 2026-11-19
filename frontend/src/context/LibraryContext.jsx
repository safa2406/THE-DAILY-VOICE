import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  getBookmarks,
  getListeningHistory,
  getUserStats,
  getLocalDateString,
  toggleBookmarkApi,
  updateListeningProgress,
} from '../services/api';
import { useAuth } from './AuthContext';

const LibraryContext = createContext(null);

const EMPTY_STATS = {
  total_completed: 0,
  total_in_progress: 0,
  total_listening_minutes: 0,
  total_listening_seconds: 0,
  time_today_minutes: 0,
  time_today_seconds: 0,
  time_today_display: '0m',
  editions_count: 0,
  editions_display: 'Start listening to track daily broadsheet activity',
  total_sessions: 0,
};

export function LibraryProvider({ children }) {
  const { user } = useAuth();
  const [savedArticleIds, setSavedArticleIds] = useState([]);
  const [savedArticles, setSavedArticles] = useState([]);
  const [listeningHistory, setListeningHistory] = useState([]);
  const [userStats, setUserStats] = useState(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [syncError, setSyncError] = useState(null);

  // Reset user data state on logout or user switch
  const resetLibraryState = useCallback(() => {
    setSavedArticleIds([]);
    setSavedArticles([]);
    setListeningHistory([]);
    setUserStats(EMPTY_STATS);
    setSyncError(null);
  }, []);

  // Fetch all user data from backend
  const refreshLibrary = useCallback(async () => {
    if (!user?.id) {
      resetLibraryState();
      setLoading(false);
      return;
    }

    try {
      const localDate = getLocalDateString();
      const [bmRes, histRes, statsRes] = await Promise.all([
        getBookmarks(),
        getListeningHistory(),
        getUserStats(localDate),
      ]);

      const errors = [];

      if (bmRes.ok && bmRes.data) {
        setSavedArticleIds(bmRes.data.saved_article_ids || bmRes.data.savedArticleIds || []);
        setSavedArticles(bmRes.data.articles || []);
      } else {
        const msg = bmRes.error || bmRes.data?.message || `HTTP ${bmRes.status}`;
        console.error('[LibraryContext] Failed to load bookmarks:', msg);
        errors.push(`Bookmarks: ${msg}`);
      }

      if (histRes.ok && histRes.data) {
        setListeningHistory(histRes.data.history || []);
      } else {
        const msg = histRes.error || histRes.data?.message || `HTTP ${histRes.status}`;
        console.error('[LibraryContext] Failed to load listening history:', msg);
        errors.push(`History: ${msg}`);
      }

      if (statsRes.ok && statsRes.data?.stats) {
        setUserStats(statsRes.data.stats);
      } else {
        const msg = statsRes.error || statsRes.data?.message || `HTTP ${statsRes.status}`;
        console.error('[LibraryContext] Failed to load user stats:', msg);
        errors.push(`Stats: ${msg}`);
      }

      setSyncError(errors.length > 0 ? errors.join(' | ') : null);
    } catch (err) {
      console.error('[LibraryContext] Unexpected error loading library data:', err);
      setSyncError(err.message || 'Failed to synchronize library data');
    } finally {
      setLoading(false);
    }
  }, [user?.id, resetLibraryState]);

  // Reload when active user changes or on initial mount
  useEffect(() => {
    if (!user?.id) {
      resetLibraryState();
      setLoading(false);
      return;
    }
    // Prevent stale user data from briefly rendering on account switch
    resetLibraryState();
    refreshLibrary();
  }, [user?.id, resetLibraryState, refreshLibrary]);

  const isBookmarked = useCallback(
    (articleId) => {
      if (!articleId) return false;
      return savedArticleIds.includes(String(articleId));
    },
    [savedArticleIds]
  );

  const toggleBookmark = useCallback(
    async (articleOrId) => {
      if (!articleOrId) return;
      const articleId = typeof articleOrId === 'object' ? articleOrId.id : articleOrId;
      const idStr = String(articleId);
      const wasBookmarked = savedArticleIds.includes(idStr);
      const prevIds = savedArticleIds;
      const prevArticles = savedArticles;

      // Optimistic state update for instant UI feedback
      if (wasBookmarked) {
        setSavedArticleIds((prev) => prev.filter((id) => id !== idStr));
        setSavedArticles((prev) => prev.filter((art) => String(art.id) !== idStr));
      } else {
        setSavedArticleIds((prev) => (prev.includes(idStr) ? prev : [...prev, idStr]));
        if (typeof articleOrId === 'object') {
          setSavedArticles((prev) => [articleOrId, ...prev.filter((art) => String(art.id) !== idStr)]);
        }
      }

      // Backend synchronization
      try {
        const res = await toggleBookmarkApi(idStr);
        if (!res.ok || !res.data) {
          const msg = res.error || res.data?.message || `HTTP ${res.status}`;
          console.error('[LibraryContext] Bookmark toggle failed on backend, rolling back:', msg);
          setSavedArticleIds(prevIds);
          setSavedArticles(prevArticles);
          setSyncError(`Bookmark save failed: ${msg}`);
          return;
        }

        setSyncError(null);
        // If newly bookmarked and we didn't have full object, sync authoritative list from server
        if (res.data.bookmarked && typeof articleOrId !== 'object') {
          const freshBm = await getBookmarks();
          if (freshBm.ok && freshBm.data) {
            setSavedArticleIds(freshBm.data.saved_article_ids || []);
            setSavedArticles(freshBm.data.articles || []);
          }
        }
      } catch (err) {
        console.error('[LibraryContext] Bookmark toggle sync threw error, rolling back:', err);
        setSavedArticleIds(prevIds);
        setSavedArticles(prevArticles);
        setSyncError(err.message || 'Bookmark toggle failed');
      }
    },
    [savedArticleIds, savedArticles]
  );

  const recordProgress = useCallback(
    async (articleId, progressSeconds, durationSeconds, isCompleted = null, meta = {}) => {
      const isEdition = Boolean(
        meta.isEdition || meta.listeningMode === 'headlines' || (!articleId && meta.editionId)
      );
      const rawEd = meta.editionId || null;
      const editionId = rawEd ? String(rawEd).replace('-headlines', '').split('•')[0].trim() : null;

      if (!articleId && !editionId) return;
      const idStr = articleId ? String(articleId) : null;
      const sessionKey = idStr || `digest-${editionId}`;

      const thresholdReached =
        durationSeconds > 0 &&
        (progressSeconds >= durationSeconds - 5 || progressSeconds / durationSeconds >= 0.9);
      const markCompleted = isCompleted !== null ? Boolean(isCompleted) : thresholdReached;
      const listenedDeltaSeconds = Math.max(0, Number(meta.listenedDeltaSeconds) || 0);
      const localDate = meta.localDate || getLocalDateString();

      // Backend persistence is the STRICT source of truth: no fake unpersisted optimistic cards
      try {
        const res = await updateListeningProgress({
          articleId: idStr,
          progressSeconds,
          durationSeconds,
          listenedDeltaSeconds,
          localDate,
          isCompleted: markCompleted,
          editionId,
          listeningMode: meta.listeningMode || (isEdition ? 'headlines' : 'summary'),
          language: meta.language,
          keepalive: Boolean(meta.keepalive),
          isEdition,
        });

        if (!res.ok || !res.data?.data) {
          const msg = res.error || res.data?.message || `HTTP ${res.status}`;
          console.error('[LibraryContext] Failed to persist listening progress to database:', msg);
          setSyncError(`History save failed: ${msg}`);
          return;
        }

        setSyncError(null);
        const serverItem = res.data.data;

        // Authoritatively update listening history from persisted backend record
        setListeningHistory((prev) => {
          const idx = prev.findIndex((item) => {
            if (isEdition) {
              const itemEd = item.editionId || item.edition_id;
              const normItemEd = itemEd ? String(itemEd).replace('-headlines', '').split('•')[0].trim() : '';
              return (
                (item.listeningMode === 'headlines' || item.listening_mode === 'headlines') &&
                normItemEd === editionId
              );
            }
            return String(item.articleId || item.article_id) === idStr;
          });
          if (idx >= 0) {
            const copy = [...prev];
            copy[idx] = {
              ...copy[idx],
              ...serverItem,
              article: serverItem.article || copy[idx].article || meta.article,
            };
            return copy;
          }
          return [serverItem, ...prev];
        });

        // Update authoritative Dashboard statistics atomically from backend response
        if (res.data.stats) {
          setUserStats(res.data.stats);
        } else {
          const statsRes = await getUserStats(localDate);
          if (statsRes.ok && statsRes.data?.stats) {
            setUserStats(statsRes.data.stats);
          }
        }
      } catch (err) {
        console.error('[LibraryContext] Error persisting listening progress:', err);
        setSyncError(err.message || 'Listening progress save failed');
      }
    },
    []
  );

  return (
    <LibraryContext.Provider
      value={{
        savedArticleIds,
        savedArticles,
        listeningHistory,
        userStats,
        loading,
        syncError,
        toggleBookmark,
        isBookmarked,
        recordProgress,
        refreshLibrary,
      }}
    >
      {children}
    </LibraryContext.Provider>
  );
}

export function useLibrary() {
  const context = useContext(LibraryContext);
  if (!context) {
    throw new Error('useLibrary must be used within a LibraryProvider');
  }
  return context;
}
