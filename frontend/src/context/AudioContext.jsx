import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { generateAudio, getAudioStreamUrl, updateListeningProgress } from '../services/api';
import { useAuth } from './AuthContext';
import { useLibrary } from './LibraryContext';

export const SUPPORTED_LANGUAGES = [
  { id: 'English', name: 'English', label: 'English', sub: 'Indian English', code: 'en' },
  { id: 'Hindi', name: 'Hindi', label: 'हिन्दी', sub: 'Hindi', code: 'hi' },
  { id: 'Kannada', name: 'Kannada', label: 'ಕನ್ನಡ', sub: 'Kannada', code: 'kn' },
  { id: 'Telugu', name: 'Telugu', label: 'తెలుగు', sub: 'Telugu', code: 'te' },
  { id: 'Marathi', name: 'Marathi', label: 'मराठी', sub: 'Marathi', code: 'mr' },
];

const PLAYBACK_SPEED_STORAGE_KEY = 'dailyvoice_playback_speed';

const getInitialPlaybackSpeed = () => {
  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(PLAYBACK_SPEED_STORAGE_KEY);
      if (saved) {
        const parsed = parseFloat(saved);
        if ([0.75, 1, 1.25, 1.5, 2].includes(parsed)) {
          return parsed;
        }
      }
    }
  } catch {}
  return 1.0;
};

const AudioContext = createContext(null);

export function AudioProvider({ children }) {
  const [currentArticle, setCurrentArticle] = useState(null);
  const [listeningMode, setListeningModeState] = useState('summary'); // 'headlines', 'summary', 'full'
  const [language, setLanguageState] = useState('English');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [audioError, setAudioError] = useState(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeedState] = useState(getInitialPlaybackSpeed);
  const [narratedText, setNarratedText] = useState('');
  const [isFullPlayerOpen, setIsFullPlayerOpen] = useState(false);
  const [isMiniPlayerDismissed, setIsMiniPlayerDismissed] = useState(false);

  // Persistent HTML5 Audio instance
  const audioRef = useRef(null);
  const playbackSpeedRef = useRef(playbackSpeed);
  const activeRequestRef = useRef(0);
  const currentArticleRef = useRef(null);
  const durationRef = useRef(0);
  const lastProgressSavedRef = useRef(-1);
  const targetSeekRef = useRef(0);
  const playStartWallMsRef = useRef(null);
  const unflushedListenedSecRef = useRef(0);
  const listeningModeRef = useRef('summary');
  const languageRef = useRef('English');

  let libraryContext = null;
  try {
    libraryContext = useLibrary();
  } catch {}

  let authContext = null;
  try {
    authContext = useAuth();
  } catch {}

  const currentUserId = authContext?.user?.id;
  const prevUserIdRef = useRef(currentUserId);

  const accumulatePlaybackDelta = useCallback(() => {
    if (playStartWallMsRef.current !== null) {
      const now = Date.now();
      const elapsedSec = (now - playStartWallMsRef.current) / 1000;
      if (elapsedSec > 0) {
        unflushedListenedSecRef.current += Math.min(elapsedSec, 300);
      }
      playStartWallMsRef.current = now;
    }
  }, []);

  useEffect(() => {
    if (prevUserIdRef.current && prevUserIdRef.current !== currentUserId) {
      // User switched or logged out: stop audio and clear player state without leaking seconds
      playStartWallMsRef.current = null;
      unflushedListenedSecRef.current = 0;
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.removeAttribute('src');
        audioRef.current.load();
      }
      setIsPlaying(false);
      setCurrentArticle(null);
      currentArticleRef.current = null;
      setCurrentTime(0);
      setDuration(0);
      setNarratedText('');
    }
    prevUserIdRef.current = currentUserId;
  }, [currentUserId]);

  // Keep refs synchronized with state
  useEffect(() => {
    currentArticleRef.current = currentArticle;
  }, [currentArticle]);

  useEffect(() => {
    durationRef.current = duration;
  }, [duration]);

  useEffect(() => {
    listeningModeRef.current = listeningMode;
  }, [listeningMode]);

  useEffect(() => {
    languageRef.current = language;
  }, [language]);

  // Helper to persist listening progress and actual listening time to database and synchronize LibraryContext
  const syncProgress = useCallback((progress, isCompleted = null, options = {}) => {
    const item = currentArticleRef.current;
    if (!item) return;

    const activeMode = listeningModeRef.current || (item.isEdition ? 'headlines' : 'summary');
    const activeLang = languageRef.current || 'English';
    const isEdition = Boolean(item.isEdition || item.is_edition || activeMode === 'headlines');
    const articleId = isEdition ? null : (item.id || null);

    let editionId = null;
    if (isEdition) {
      const candidate = item.edition_id || item.editionId || item.id || null;
      editionId = candidate ? String(candidate).replace('-headlines', '').split('•')[0].trim() : null;
    } else {
      const candidate = item.edition_id || item.editionId || null;
      editionId = candidate ? String(candidate).replace('-headlines', '').split('•')[0].trim() : null;
    }

    if (!isEdition && !articleId) return;
    if (isEdition && !editionId) return;

    const dur =
      durationRef.current ||
      (audioRef.current?.duration && isFinite(audioRef.current.duration)
        ? Math.round(audioRef.current.duration)
        : (isEdition ? 240 : 180));

    // Atomically consume unflushed actual listening seconds so repeated syncs never double-count
    const listenedDeltaSeconds = Math.round(unflushedListenedSecRef.current * 10) / 10;
    unflushedListenedSecRef.current = 0;

    const meta = {
      editionId,
      listeningMode: activeMode,
      language: activeLang,
      article: item,
      listenedDeltaSeconds,
      isEdition,
      keepalive: Boolean(options.keepalive),
    };

    if (libraryContext?.recordProgress) {
      libraryContext.recordProgress(articleId, progress, dur, isCompleted, meta);
    } else {
      updateListeningProgress({
        articleId,
        progressSeconds: progress,
        durationSeconds: dur,
        listenedDeltaSeconds,
        isCompleted,
        editionId,
        listeningMode: activeMode,
        language: activeLang,
        keepalive: meta.keepalive,
        isEdition,
      }).catch((err) => {
        console.error('Failed to sync progress:', err);
      });
    }
  }, [libraryContext]);

  const syncProgressRef = useRef(syncProgress);
  useEffect(() => {
    syncProgressRef.current = syncProgress;
  }, [syncProgress]);

  // Initialize Audio element once
  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'metadata';
    audioRef.current = audio;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      if (!audio.paused && !audio.ended) {
        accumulatePlaybackDelta();
      }
      if (
        unflushedListenedSecRef.current >= 4 ||
        Math.abs(audio.currentTime - lastProgressSavedRef.current) >= 5
      ) {
        lastProgressSavedRef.current = audio.currentTime;
        syncProgressRef.current?.(audio.currentTime, false);
      }
    };

    const handleLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setDuration(audio.duration);
        durationRef.current = audio.duration;
      }
      setIsLoading(false);

      // Handle resume seek if specified
      if (targetSeekRef.current > 0 && audio.duration > 0) {
        const seekPos = Math.min(targetSeekRef.current, audio.duration - 0.5);
        audio.currentTime = seekPos;
        setCurrentTime(seekPos);
        lastProgressSavedRef.current = seekPos;
        targetSeekRef.current = 0;
      }
    };

    const handleCanPlay = () => {
      setIsLoading(false);
      if (targetSeekRef.current > 0 && audio.duration > 0) {
        const seekPos = Math.min(targetSeekRef.current, audio.duration - 0.5);
        audio.currentTime = seekPos;
        setCurrentTime(seekPos);
        lastProgressSavedRef.current = seekPos;
        targetSeekRef.current = 0;
      }
    };

    const handleWaiting = () => {
      accumulatePlaybackDelta();
      playStartWallMsRef.current = null;
      setIsLoading(true);
    };

    const handlePlaying = () => {
      setIsPlaying(true);
      setIsLoading(false);
      if (playStartWallMsRef.current === null) {
        playStartWallMsRef.current = Date.now();
      }
    };

    const handlePlay = () => {
      setIsPlaying(true);
      setIsLoading(false);
      playStartWallMsRef.current = Date.now();
      syncProgressRef.current?.(audio.currentTime || 0, false);
    };

    const handlePause = () => {
      accumulatePlaybackDelta();
      playStartWallMsRef.current = null;
      setIsPlaying(false);
      lastProgressSavedRef.current = audio.currentTime || 0;
      syncProgressRef.current?.(audio.currentTime || 0, false);
    };

    const handleEnded = () => {
      accumulatePlaybackDelta();
      playStartWallMsRef.current = null;
      setIsPlaying(false);
      const endPos = audio.duration || durationRef.current || 0;
      setCurrentTime(endPos);
      lastProgressSavedRef.current = endPos;
      syncProgressRef.current?.(endPos, true);
    };

    const handleError = () => {
      playStartWallMsRef.current = null;
      setIsLoading(false);
      setIsPlaying(false);
      if (audio.src && audio.src !== window.location.href) {
        setAudioError('Failed to load audio stream. Please check connection and try again.');
      }
    };

    const handlePageHide = () => {
      if (currentArticleRef.current) {
        accumulatePlaybackDelta();
        playStartWallMsRef.current = null;
        if (unflushedListenedSecRef.current > 0 || (audio.currentTime || 0) > 0) {
          syncProgressRef.current?.(audio.currentTime || 0, false, { keepalive: true });
        }
      }
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('waiting', handleWaiting);
    audio.addEventListener('playing', handlePlaying);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);
    if (typeof window !== 'undefined') {
      window.addEventListener('pagehide', handlePageHide);
    }

    return () => {
      audio.pause();
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('waiting', handleWaiting);
      audio.removeEventListener('playing', handlePlaying);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      if (typeof window !== 'undefined') {
        window.removeEventListener('pagehide', handlePageHide);
      }
      audio.src = '';
    };
  }, [accumulatePlaybackDelta]);

  // Sync playback speed to HTML5 audio element and persist to storage
  const setPlaybackSpeed = useCallback((speed) => {
    const validSpeed = typeof speed === 'number' ? speed : parseFloat(speed);
    if (!isNaN(validSpeed) && validSpeed > 0) {
      setPlaybackSpeedState(validSpeed);
      playbackSpeedRef.current = validSpeed;
      if (audioRef.current) {
        audioRef.current.playbackRate = validSpeed;
      }
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(PLAYBACK_SPEED_STORAGE_KEY, String(validSpeed));
        }
      } catch {}
    }
  }, []);

  useEffect(() => {
    playbackSpeedRef.current = playbackSpeed;
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  // Update MediaSession API for lockscreen and media keys
  const updateMediaSession = useCallback((title, publisher, category) => {
    if (typeof window !== 'undefined' && 'mediaSession' in navigator) {
      navigator.mediaSession.metadata = new window.MediaMetadata({
        title: title || 'The Daily Voice',
        artist: publisher || 'Broadsheet Audio Narration',
        album: category ? `${category} Desk` : 'The Daily Voice',
        artwork: [
          { src: '/favicon.ico', sizes: '64x64', type: 'image/x-icon' },
        ],
      });

      try {
        navigator.mediaSession.setActionHandler('play', () => {
          audioRef.current?.play().catch(console.warn);
        });
        navigator.mediaSession.setActionHandler('pause', () => {
          audioRef.current?.pause();
        });
        navigator.mediaSession.setActionHandler('seekbackward', () => {
          if (audioRef.current) {
            audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 15);
          }
        });
        navigator.mediaSession.setActionHandler('seekforward', () => {
          if (audioRef.current) {
            audioRef.current.currentTime = Math.min(audioRef.current.duration || 0, audioRef.current.currentTime + 15);
          }
        });
      } catch (err) {
        // Ignore unsupported media session actions
      }
    }
  }, []);

  // Core audio generation and playback dispatcher
  const playListeningMode = useCallback(async (targetItem, mode = 'summary', lang = language, initialSeek = 0) => {
    if (!targetItem) return;

    // Save progress and actual listening time of previous item before switching
    if (
      currentArticleRef.current &&
      audioRef.current &&
      (audioRef.current.currentTime > 0 || unflushedListenedSecRef.current > 0)
    ) {
      accumulatePlaybackDelta();
      playStartWallMsRef.current = null;
      syncProgressRef.current?.(audioRef.current.currentTime || 0, false);
    } else {
      playStartWallMsRef.current = null;
      unflushedListenedSecRef.current = 0;
    }

    const requestId = ++activeRequestRef.current;
    setIsMiniPlayerDismissed(false);
    setCurrentArticle(targetItem);
    currentArticleRef.current = targetItem;
    targetSeekRef.current = initialSeek || 0;
    lastProgressSavedRef.current = initialSeek || 0;
    setListeningModeState(mode);
    listeningModeRef.current = mode;
    setLanguageState(lang);
    languageRef.current = lang;
    setIsLoading(true);
    setAudioError(null);

    // Stop and unload previous audio immediately so old audio cannot play while generating
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute('src');
      audioRef.current.load();
    }
    setNarratedText('');
    setCurrentTime(initialSeek || 0);
    setDuration(0);

    const isEdition = Boolean(targetItem.isEdition || targetItem.is_edition || mode === 'headlines');
    const rawEdCandidate = isEdition
      ? (targetItem.edition_id || targetItem.editionId || targetItem.id || null)
      : (targetItem.edition_id || targetItem.editionId || null);
    const cleanEditionId = rawEdCandidate
      ? String(rawEdCandidate).replace('-headlines', '').split('•')[0].trim()
      : null;

    // Immediately record listening session start (0 actual seconds elapsed so far)
    if (targetItem.id || cleanEditionId) {
      const targetArticleId = isEdition ? null : targetItem.id;
      const initDur = targetItem.durationSeconds || targetItem.duration_seconds || (isEdition ? 240 : 180);

      if (libraryContext?.recordProgress) {
        libraryContext.recordProgress(targetArticleId, initialSeek || 0, initDur, false, {
          editionId: cleanEditionId,
          listeningMode: mode,
          language: lang,
          article: targetItem,
          listenedDeltaSeconds: 0,
          isEdition,
        });
      }
    }

    try {
      const articleId = isEdition ? null : (targetItem.id || null);

      const res = await generateAudio({
        articleId,
        editionId: cleanEditionId,
        mode,
        language: lang,
      });

      // Avoid race conditions if user switched articles quickly
      if (activeRequestRef.current !== requestId) return;

      if (!res.ok || !res.data || res.data.status !== 'success') {
        throw new Error(res.error || res.data?.message || 'Audio generation failed on server.');
      }

      const audioData = res.data.data;
      const fullAudioUrl = getAudioStreamUrl(audioData.audio_url);

      setNarratedText(audioData.text || '');
      if (audioData.duration_seconds) {
        setDuration(audioData.duration_seconds);
        durationRef.current = audioData.duration_seconds;
      }

      if (audioRef.current) {
        audioRef.current.src = fullAudioUrl;
        audioRef.current.playbackRate = playbackSpeedRef.current || playbackSpeed;
        await audioRef.current.play();

        if (initialSeek > 0) {
          audioRef.current.currentTime = initialSeek;
          setCurrentTime(initialSeek);
          targetSeekRef.current = 0;
        }
      }

      const displayTitle = targetItem.headline || targetItem.title || targetItem.name || 'Broadsheet Story';
      updateMediaSession(displayTitle, targetItem.publisher || targetItem.newspaperName, targetItem.category);
    } catch (err) {
      if (activeRequestRef.current === requestId) {
        console.error('Audio playback error:', err);
        setAudioError(err.message || 'Unable to play narration audio. Please try again.');
        setIsLoading(false);
        setIsPlaying(false);
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.removeAttribute('src');
          audioRef.current.load();
        }
      }
    }
  }, [language, playbackSpeed, updateMediaSession, libraryContext, accumulatePlaybackDelta]);

  // Convenience aliases for UI components
  const playArticle = useCallback((article, modeOrProgress = 'summary', lang = null) => {
    let mode = 'summary';
    let initialSeek = 0;
    if (typeof modeOrProgress === 'number') {
      initialSeek = modeOrProgress;
      mode = 'summary';
    } else if (typeof modeOrProgress === 'string') {
      mode = modeOrProgress;
    }
    playListeningMode(article, mode, lang || language, initialSeek);
  }, [playListeningMode, language]);

  const playHeadlines = useCallback((edition, lang = null, initialSeek = 0) => {
    if (!edition) return;
    const paperName = edition.name || edition.newspaper_name || edition.publisher || 'Broadsheet';
    const rawId = edition.id || edition.editionId || edition.edition_id || '';
    const cleanId = String(rawId).replace('-headlines', '').split('•')[0].trim();
    const editionItem = {
      ...edition,
      id: cleanId,
      editionId: cleanId,
      edition_id: cleanId,
      edition_code: edition.edition_code || edition.editionCode,
      isEdition: true,
      is_edition: true,
      name: paperName,
      newspaper_name: paperName,
      newspaperName: paperName,
      publisher: paperName,
      title: `${paperName} - Headline Digest`,
      headline: `${paperName} - Headline Digest`,
      category: 'Headline Digest',
    };
    playListeningMode(editionItem, 'headlines', lang || languageRef.current || language, initialSeek);
  }, [playListeningMode, language]);

  const setListeningMode = useCallback((newMode) => {
    setListeningModeState(newMode);
    listeningModeRef.current = newMode;
    if (currentArticle) {
      playListeningMode(currentArticle, newMode, languageRef.current || language);
    }
  }, [currentArticle, language, playListeningMode]);

  const setLanguage = useCallback((newLang, targetItem = null) => {
    setLanguageState(newLang);
    languageRef.current = newLang;
    const itemToPlay = targetItem || currentArticle;
    if (itemToPlay) {
      playListeningMode(itemToPlay, listeningModeRef.current || listeningMode, newLang);
    }
  }, [currentArticle, listeningMode, playListeningMode]);

  const changeLanguageOnly = useCallback((newLang) => {
    setLanguageState(newLang);
    languageRef.current = newLang;
  }, []);

  const togglePlayPause = useCallback(() => {
    if (!audioRef.current) return;
    if (audioRef.current.src && !audioError) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch((err) => {
          console.warn('Play interrupted:', err);
        });
      }
    } else if (currentArticle) {
      playListeningMode(currentArticle, listeningMode, language);
    }
  }, [isPlaying, audioError, currentArticle, listeningMode, language, playListeningMode]);

  const seek = useCallback((seconds) => {
    if (!audioRef.current) return;
    accumulatePlaybackDelta();
    const clamped = Math.max(0, Math.min(seconds, duration));
    audioRef.current.currentTime = clamped;
    lastProgressSavedRef.current = clamped;
    setCurrentTime(clamped);
    syncProgress(clamped, false);
  }, [duration, syncProgress, accumulatePlaybackDelta]);

  const rewind = useCallback((seconds = 15) => {
    if (!audioRef.current) return;
    seek(audioRef.current.currentTime - seconds);
  }, [seek]);

  const forward = useCallback((seconds = 15) => {
    if (!audioRef.current) return;
    seek(audioRef.current.currentTime + seconds);
  }, [seek]);

  const dismissMiniPlayer = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setIsPlaying(false);
    setIsMiniPlayerDismissed(true);
  }, []);

  const retryAudioGeneration = useCallback(() => {
    if (currentArticle) {
      playListeningMode(currentArticle, listeningMode, language);
    }
  }, [currentArticle, listeningMode, language, playListeningMode]);

  const formatTime = (secs) => {
    if (!secs || isNaN(secs) || !isFinite(secs)) return '0:00';
    const totalSecs = Math.floor(secs);
    const m = Math.floor(totalSecs / 60);
    const s = totalSecs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <AudioContext.Provider
      value={{
        currentArticle,
        listeningMode,
        language,
        isPlaying,
        isLoading,
        audioError,
        currentTime,
        duration,
        playbackSpeed,
        narratedText,
        isFullPlayerOpen,
        isMiniPlayerDismissed,
        progressPercent: duration > 0 ? (currentTime / duration) * 100 : 0,
        formattedCurrentTime: formatTime(currentTime),
        formattedDuration: formatTime(duration),
        playArticle,
        playHeadlines,
        playListeningMode,
        setListeningMode,
        setLanguage,
        changeLanguageOnly,
        setPlaybackSpeed,
        togglePlayPause,
        seek,
        rewind,
        forward,
        dismissMiniPlayer,
        setIsMiniPlayerDismissed,
        retryAudioGeneration,
        openFullPlayer: () => {
          setIsMiniPlayerDismissed(false);
          setIsFullPlayerOpen(true);
        },
        closeFullPlayer: () => setIsFullPlayerOpen(false),
      }}
    >
      {children}
    </AudioContext.Provider>
  );
}

export function useAudio() {
  const context = useContext(AudioContext);
  if (!context) {
    throw new Error('useAudio must be used within an AudioProvider');
  }
  return context;
}
