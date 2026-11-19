import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Send,
  Mic,
  MicOff,
  X,
  Volume2,
  Square,
  Loader2,
  AlertCircle,
  HelpCircle,
  RefreshCw,
  Languages,
  ChevronRight,
} from 'lucide-react';
import { askAiAboutArticle, synthesizeSpeech, getAudioStreamUrl } from '../services/api';
import {
  isSpeechRecognitionSupported,
  createSpeechRecognizer,
  SPEECH_LANGUAGES,
} from '../utils/speechRecognition';
import { SUPPORTED_LANGUAGES } from '../context/AudioContext';

// In-memory frontend chat history cache isolated per article ID
const _activeArticleChatCache = {
  articleId: null,
  messages: [],
};

export default function AskAiModal({
  isOpen,
  onClose,
  article,
  currentLanguage = 'English',
}) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState(null);
  const [apiError, setApiError] = useState(null);
  const [selectedLanguage, setSelectedLanguage] = useState(currentLanguage);

  // Audio playback state for AI responses
  const [playingAudioIndex, setPlayingAudioIndex] = useState(null);
  const [loadingAudioIndex, setLoadingAudioIndex] = useState(null);
  const audioPlayerRef = useRef(null);
  const speechRecognizerRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Sync selected language when parent language changes
  useEffect(() => {
    if (currentLanguage) {
      setSelectedLanguage(currentLanguage);
    }
  }, [currentLanguage]);

  // Article switching logic: isolate conversation per article
  useEffect(() => {
    if (!article || !article.id) return;

    if (_activeArticleChatCache.articleId !== article.id) {
      // Switched articles: reset chat state to avoid mixing articles
      _activeArticleChatCache.articleId = article.id;
      _activeArticleChatCache.messages = [];
      setMessages([]);
      setInputText('');
      setApiError(null);
      setSpeechError(null);
      stopAudioPlayback();
    } else {
      // Same article: restore preserved messages
      setMessages(_activeArticleChatCache.messages);
    }
  }, [article?.id]);

  // Keep module cache in sync with state
  useEffect(() => {
    if (article?.id && _activeArticleChatCache.articleId === article.id) {
      _activeArticleChatCache.messages = messages;
    }
  }, [messages, article?.id]);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isGenerating, isListening, isOpen]);

  // Clean up speech recognition & audio player on unmount
  useEffect(() => {
    return () => {
      stopAudioPlayback();
      if (speechRecognizerRef.current) {
        speechRecognizerRef.current.abort();
      }
    };
  }, []);

  const stopAudioPlayback = () => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current.removeAttribute('src');
      audioPlayerRef.current = null;
    }
    setPlayingAudioIndex(null);
    setLoadingAudioIndex(null);
  };

  if (!isOpen || !article) return null;

  const hasSpeechSupport = isSpeechRecognitionSupported();

  // Handle Voice Input Toggle
  const handleToggleVoice = () => {
    setSpeechError(null);

    if (isListening) {
      // Stop listening and keep recognized text
      if (speechRecognizerRef.current) {
        speechRecognizerRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    if (!hasSpeechSupport) {
      setSpeechError('Speech recognition is not supported in this browser. Please type your question.');
      return;
    }

    const recognizer = createSpeechRecognizer({
      language: selectedLanguage,
      onStart: () => {
        setIsListening(true);
        setSpeechError(null);
      },
      onResult: (transcript, isFinal) => {
        setInputText(transcript);
        if (isFinal) {
          setIsListening(false);
        }
      },
      onError: (errMsg) => {
        setSpeechError(errMsg);
        setIsListening(false);
      },
      onEnd: () => {
        setIsListening(false);
      },
    });

    speechRecognizerRef.current = recognizer;
    recognizer.start();
  };

  const handleCancelVoice = () => {
    if (speechRecognizerRef.current) {
      speechRecognizerRef.current.abort();
    }
    setIsListening(false);
    setSpeechError(null);
  };

  // Submit Question to AI
  const handleSend = async (questionToSend) => {
    const q = (typeof questionToSend === 'string' ? questionToSend : inputText).trim();
    if (!q || isGenerating) return;

    // Stop active mic if running
    if (isListening && speechRecognizerRef.current) {
      speechRecognizerRef.current.abort();
      setIsListening(false);
    }

    setApiError(null);
    setSpeechError(null);

    const userMsg = {
      role: 'user',
      content: q,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInputText('');
    setIsGenerating(true);

    // Format previous history for backend (limit to user/assistant pairs)
    const historyPayload = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    try {
      const response = await askAiAboutArticle({
        articleId: article.id,
        question: q,
        history: historyPayload,
        language: selectedLanguage,
      });

      if (response.ok && response.data?.status === 'success') {
        const aiMsg = {
          role: 'assistant',
          content: response.data.data.answer,
          language: response.data.data.language || selectedLanguage,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages([...nextMessages, aiMsg]);
      } else {
        const errorDetail =
          response.data?.message ||
          response.error ||
          'Failed to receive response from AI. Please try again.';
        setApiError(errorDetail);
      }
    } catch (err) {
      setApiError('Network error connecting to Ask AI. Please check your connection.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Play AI response via TTS
  const handlePlayAiResponse = async (index, text, lang) => {
    if (playingAudioIndex === index) {
      stopAudioPlayback();
      return;
    }

    stopAudioPlayback();
    setLoadingAudioIndex(index);

    try {
      const res = await synthesizeSpeech({
        text,
        language: lang || selectedLanguage || 'English',
      });

      if (res.ok && res.data?.status === 'success' && res.data?.data?.audio_url) {
        const fullAudioUrl = getAudioStreamUrl(res.data.data.audio_url);
        const audio = new Audio(fullAudioUrl);
        audioPlayerRef.current = audio;

        audio.oncanplay = () => {
          setLoadingAudioIndex(null);
          setPlayingAudioIndex(index);
          audio.play().catch(() => {
            setPlayingAudioIndex(null);
          });
        };

        audio.onended = () => {
          setPlayingAudioIndex(null);
          audioPlayerRef.current = null;
        };

        audio.onerror = () => {
          setLoadingAudioIndex(null);
          setPlayingAudioIndex(null);
          setApiError('Audio playback failed. Please try again.');
        };

        audio.load();
      } else {
        setLoadingAudioIndex(null);
        setApiError(res.error || 'Speech synthesis was unable to generate audio for this answer.');
      }
    } catch (err) {
      setLoadingAudioIndex(null);
      setApiError('Failed to synthesize speech for this response.');
    }
  };

  const suggestedQuestions = [
    'Can you summarize the main event in simple terms?',
    'Who are the key people or organizations mentioned?',
    'What historical or background context led to this?',
    'Are there any technical terms or jargon you can explain?',
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div
        className="bg-[#faf7f2] rounded-[20px] w-full max-w-2xl h-[92vh] sm:h-[85vh] flex flex-col shadow-[0_20px_50px_rgba(28,25,23,0.2)] border border-[#eae4d9] overflow-hidden animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ask-ai-title"
      >
        {/* Masthead Header */}
        <div className="px-5 py-4 bg-white border-b border-[#eae4d9] flex items-center justify-between shrink-0 shadow-xs">
          <div className="flex items-center space-x-3 overflow-hidden">
            <div className="w-10 h-10 rounded-2xl bg-[#9a3412] text-white flex items-center justify-center shadow-xs shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-2">
                <h3 id="ask-ai-title" className="font-serif font-black text-base sm:text-lg text-[#1c1917] truncate">
                  Ask AI About News
                </h3>
                <span className="text-xs uppercase font-mono font-bold px-2 py-0.5 rounded-full bg-[#fbeee6] text-[#9a3412] border border-[#f0d8cc] shrink-0">
                  {selectedLanguage}
                </span>
              </div>
              <p className="text-xs text-[#5c534a] font-mono truncate max-w-xs sm:max-w-md">
                {article.title || article.headline}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            {/* Language Selector Dropdown */}
            <div className="relative inline-block">
              <select
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                className="text-xs font-mono bg-[#faf7f2] border border-[#eae4d9] hover:border-[#9a3412] rounded-xl px-2.5 py-1.5 text-[#1c1917] cursor-pointer appearance-none pr-6 focus:outline-hidden focus:ring-1 focus:ring-[#9a3412]"
                title="Change AI conversation language"
              >
                {SUPPORTED_LANGUAGES.map((l) => (
                  <option key={l.id} value={l.name}>
                    {l.name} ({l.label})
                  </option>
                ))}
              </select>
              <Languages className="w-3 h-3 text-[#9a3412] absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Close Button to return to article */}
            <button
              type="button"
              onClick={() => {
                stopAudioPlayback();
                onClose();
              }}
              className="p-2 text-[#5c534a] hover:text-[#1c1917] hover:bg-[#f3ece2] rounded-xl transition-colors cursor-pointer"
              title="Close chat and return to article"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Notice & Context Banner */}
        <div className="px-5 py-2 bg-[#f3ece2]/60 border-b border-[#eae4d9] text-xs font-mono text-[#5c534a] flex items-center justify-between">
          <span className="truncate">
            Source: <strong className="text-[#1c1917]">{article.newspaperName || 'Daily Broadsheet'}</strong> • Page {article.pageNumber || article.page_number || 1}
          </span>
          <span className="hidden sm:inline text-xs text-[#9a3412] font-semibold">
            Context Grounded in Database Record
          </span>
        </div>

        {/* Scrollable Chat Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto py-8">
              <div className="w-14 h-14 rounded-3xl bg-[#fbeee6] border border-[#f0d8cc] text-[#9a3412] flex items-center justify-center mb-3 shadow-inner">
                <Sparkles className="w-7 h-7" />
              </div>
              <h4 className="font-serif font-bold text-lg text-[#1c1917] mb-1">
                Ask About This Story
              </h4>
              <p className="text-xs sm:text-sm text-[#5c534a] font-serif leading-relaxed mb-6">
                Ask a question in <strong>{selectedLanguage}</strong> using text or voice.
              </p>

              {/* Quick Prompt Starters */}
              <div className="w-full space-y-2 text-left">
                <p className="text-xs uppercase font-mono font-bold text-[#5c534a] tracking-wider px-1">
                  Suggested Questions:
                </p>
                {suggestedQuestions.map((q, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSend(q)}
                    disabled={isGenerating}
                    className="w-full text-left p-3 rounded-2xl bg-white hover:bg-[#fff7ed] border border-[#eae4d9] hover:border-[#fed7aa] text-xs font-serif text-[#44403c] hover:text-[#9a3412] transition-all flex items-center justify-between cursor-pointer shadow-2xs group"
                  >
                    <span>{q}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-[#5c534a] group-hover:text-[#9a3412] transition-transform group-hover:translate-x-0.5" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} space-y-1`}
              >
                <div className="flex items-center space-x-1.5 text-xs font-mono text-[#5c534a] px-1">
                  <span>{msg.role === 'user' ? 'You' : 'The Daily Voice AI'}</span>
                  <span>•</span>
                  <span>{msg.timestamp}</span>
                </div>

                <div
                  className={`max-w-[88%] sm:max-w-[80%] rounded-2xl p-4 shadow-2xs text-xs sm:text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-[#1c1917] text-white rounded-tr-xs font-sans'
                      : 'bg-white text-[#292524] border border-[#eae4d9] rounded-tl-xs font-serif'
                  }`}
                >
                  <div className="space-y-2.5">
                    {msg.content.split('\n\n').map((paragraph, pIdx) => (
                      <p key={pIdx}>{paragraph}</p>
                    ))}
                  </div>

                  {/* AI Response Footer: Listen Button */}
                  {msg.role === 'assistant' && (
                    <div className="mt-3 pt-2.5 border-t border-[#eae4d9] flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => handlePlayAiResponse(idx, msg.content, msg.language)}
                        className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-xl text-xs font-mono font-medium transition-all cursor-pointer ${
                          playingAudioIndex === idx
                            ? 'bg-[#9a3412] text-white'
                            : 'bg-[#faf7f2] hover:bg-[#f3ece2] border border-[#eae4d9] text-[#5c534a] hover:text-[#1c1917]'
                        }`}
                        title="Listen to this answer using TTS"
                      >
                        {loadingAudioIndex === idx ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-[#9a3412]" />
                            <span>Generating audio...</span>
                          </>
                        ) : playingAudioIndex === idx ? (
                          <>
                            <Square className="w-3.5 h-3.5 fill-current" />
                            <span>Stop Audio</span>
                          </>
                        ) : (
                          <>
                            <Volume2 className="w-3.5 h-3.5 text-[#9a3412]" />
                            <span>Listen to Answer</span>
                          </>
                        )}
                      </button>

                      <span className="text-xs font-mono text-[#5c534a]">
                        {msg.language || selectedLanguage}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}

          {/* AI Generating Indicator */}
          {isGenerating && (
            <div className="flex flex-col items-start space-y-1 animate-in fade-in duration-200">
              <div className="text-xs font-mono text-[#5c534a] px-1">
                The Daily Voice AI • analyzing article
              </div>
              <div className="bg-white border border-[#eae4d9] rounded-2xl rounded-tl-xs p-4 shadow-2xs flex items-center space-x-3 text-xs text-[#5c534a] font-mono">
                <Loader2 className="w-4 h-4 animate-spin text-[#9a3412]" />
                <span>Consulting broadsheet context and drafting answer...</span>
              </div>
            </div>
          )}

          {/* Voice Listening Active Banner */}
          {isListening && (
            <div className="p-4 bg-[#fbeee6] border border-[#9a3412]/30 rounded-2xl shadow-xs flex items-center justify-between animate-pulse">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-full bg-[#9a3412] text-white flex items-center justify-center animate-bounce">
                  <Mic className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-mono font-bold text-[#9a3412]">
                    Listening in {selectedLanguage}...
                  </p>
                  <p className="text-xs text-[#5c534a] font-sans">
                    Speak your question clearly. It will appear in the box below.
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleCancelVoice}
                  className="px-2.5 py-1 text-xs font-mono text-[#5c534a] hover:text-[#1c1917] bg-white/80 rounded-lg border border-[#eae4d9] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleToggleVoice}
                  className="px-3 py-1 text-xs font-mono font-bold text-white bg-[#9a3412] hover:bg-[#7c2d12] rounded-lg shadow-xs cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          )}

          {/* Speech Error Banner */}
          {speechError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-800 flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-semibold block mb-0.5">Microphone Notice</span>
                <span>{speechError}</span>
              </div>
              <button
                type="button"
                onClick={() => setSpeechError(null)}
                className="text-red-500 hover:text-red-800 p-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* API Error Banner */}
          {apiError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-800 flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-semibold block mb-0.5">Service Error</span>
                <span>{apiError}</span>
              </div>
              <button
                type="button"
                onClick={() => setApiError(null)}
                className="text-red-500 hover:text-red-800 p-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-3 sm:p-4 bg-white border-t border-[#eae4d9] shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center space-x-2"
          >
            {/* Microphone Button */}
            <button
              type="button"
              onClick={handleToggleVoice}
              disabled={isGenerating}
              className={`p-3 rounded-2xl border transition-all cursor-pointer shrink-0 ${
                isListening
                  ? 'bg-red-500 text-white border-red-600 animate-pulse'
                  : hasSpeechSupport
                  ? 'bg-[#faf7f2] hover:bg-[#fbeee6] border-[#eae4d9] hover:border-[#9a3412] text-[#5c534a] hover:text-[#9a3412]'
                  : 'bg-stone-100 border-[#eae4d9] text-[#a8a29e] cursor-not-allowed opacity-60'
              }`}
              title={
                hasSpeechSupport
                  ? isListening
                    ? 'Stop listening'
                    : `Speak in ${selectedLanguage}`
                  : 'Speech recognition not supported in this browser'
              }
              aria-label={isListening ? 'Stop recording' : 'Speak question'}
            >
              {isListening ? (
                <Mic className="w-5 h-5 fill-current" />
              ) : hasSpeechSupport ? (
                <Mic className="w-5 h-5" />
              ) : (
                <MicOff className="w-5 h-5" />
              )}
            </button>

            {/* Question Text Input */}
            <div className="relative flex-1">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isGenerating}
                placeholder={
                  isListening
                    ? `Listening in ${selectedLanguage}...`
                    : `Ask a question in ${selectedLanguage} or tap mic...`
                }
                maxLength={1000}
                className="w-full py-3 px-4 bg-[#faf7f2] border border-[#eae4d9] focus:border-[#9a3412] focus:bg-white rounded-2xl text-xs sm:text-sm text-[#1c1917] placeholder:text-[#5c534a] focus:outline-hidden transition-colors font-sans"
              />
              {inputText.length > 800 && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono text-[#5c534a]">
                  {1000 - inputText.length}
                </span>
              )}
            </div>

            {/* Send Button */}
            <button
              type="submit"
              disabled={!inputText.trim() || isGenerating}
              className={`p-3 rounded-2xl transition-all flex items-center justify-center shrink-0 cursor-pointer ${
                inputText.trim() && !isGenerating
                  ? 'bg-[#9a3412] hover:bg-[#7c2d12] text-white shadow-md hover:shadow-lg active:scale-95'
                  : 'bg-[#eae4d9] text-[#a8a29e] cursor-not-allowed opacity-60'
              }`}
              title="Send question to AI"
              aria-label="Send question"
            >
              {isGenerating ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </form>

          {/* Context footnote */}
          <div className="flex items-center justify-between text-xs font-mono text-[#5c534a] mt-2 px-1">
            <span>Ask follow-up questions anytime • Preserved while on this story</span>
            <span className="hidden sm:inline">Press Enter to send</span>
          </div>
        </div>
      </div>
    </div>
  );
}
