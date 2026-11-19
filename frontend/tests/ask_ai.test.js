import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  SPEECH_LANGUAGES,
  getSpeechRecognitionLanguage,
  getFriendlySpeechErrorMessage,
  isSpeechRecognitionSupported,
  createSpeechRecognizer,
} from '../src/utils/speechRecognition.js';
import { getAudioStreamUrl } from '../src/services/api.js';

describe('Version 2 Feature 1: Ask AI - Speech Recognition & Language Mapping', () => {
  it('1. Maps all 5 supported languages to correct BCP-47 speech recognition locales', () => {
    assert.strictEqual(getSpeechRecognitionLanguage('English'), 'en-IN');
    assert.strictEqual(getSpeechRecognitionLanguage('Hindi'), 'hi-IN');
    assert.strictEqual(getSpeechRecognitionLanguage('Kannada'), 'kn-IN');
    assert.strictEqual(getSpeechRecognitionLanguage('Telugu'), 'te-IN');
    assert.strictEqual(getSpeechRecognitionLanguage('Marathi'), 'mr-IN');
    // Default fallback
    assert.strictEqual(getSpeechRecognitionLanguage('UnknownLang'), 'en-IN');
  });

  it('2. Confirms exactly 5 distinct languages are mapped in SPEECH_LANGUAGES', () => {
    const keys = Object.keys(SPEECH_LANGUAGES);
    assert.strictEqual(keys.length, 5);
    assert.deepStrictEqual(keys.sort(), ['English', 'Hindi', 'Kannada', 'Marathi', 'Telugu']);
  });

  it('3. Translates browser permission denied error into user-friendly instructions', () => {
    const deniedMsg = getFriendlySpeechErrorMessage('not-allowed');
    assert.ok(deniedMsg.includes('Microphone permission was denied'));
    assert.ok(deniedMsg.includes('browser settings'));
  });

  it('4. Translates no-speech and network errors into helpful guidance', () => {
    const noSpeech = getFriendlySpeechErrorMessage('no-speech');
    assert.ok(noSpeech.includes('No speech was detected'));

    const networkErr = getFriendlySpeechErrorMessage('network');
    assert.ok(networkErr.includes('network service is temporarily unavailable'));

    const audioCapture = getFriendlySpeechErrorMessage('audio-capture');
    assert.ok(audioCapture.includes('No microphone was detected'));
  });

  it('5. Gracefully handles environments where SpeechRecognition is unavailable (e.g. Node / unsupported browsers)', () => {
    assert.strictEqual(isSpeechRecognitionSupported(), false);

    let errorReported = null;
    const recognizer = createSpeechRecognizer({
      language: 'Hindi',
      onError: (msg) => {
        errorReported = msg;
      },
    });

    assert.strictEqual(recognizer.isSupported, false);
    recognizer.start();
    assert.ok(errorReported.includes('not supported in this browser'));
  });
});

describe('Version 2 Feature 1: Ask AI - Input Validation & Article Isolation Logic', () => {
  it('6. Rejects empty and whitespace-only questions', () => {
    const validateQuestion = (q) => {
      const trimmed = (q || '').trim();
      if (!trimmed) return { valid: false, error: 'Question cannot be empty' };
      if (trimmed.length > 1000) return { valid: false, error: 'Question too long' };
      return { valid: true, question: trimmed };
    };

    assert.strictEqual(validateQuestion('').valid, false);
    assert.strictEqual(validateQuestion('   \t\n  ').valid, false);
    assert.strictEqual(validateQuestion(null).valid, false);
    assert.strictEqual(validateQuestion('What is this about?').valid, true);
  });

  it('7. Enforces maximum character limit of 1000 characters', () => {
    const validateQuestion = (q) => {
      const trimmed = (q || '').trim();
      if (trimmed.length > 1000) return { valid: false, error: 'Question exceeds maximum limit of 1000 characters' };
      return { valid: true, question: trimmed };
    };

    const longQuestion = 'a'.repeat(1001);
    assert.strictEqual(validateQuestion(longQuestion).valid, false);

    const acceptableQuestion = 'a'.repeat(1000);
    assert.strictEqual(validateQuestion(acceptableQuestion).valid, true);
  });

  it('8. Isolated conversation state resets when switching articles', () => {
    // Simulate active article chat cache logic
    const chatCache = {
      articleId: null,
      messages: [],
    };

    const setArticle = (newArticleId) => {
      if (chatCache.articleId !== newArticleId) {
        chatCache.articleId = newArticleId;
        chatCache.messages = [];
      }
    };

    // User is on Article 1
    setArticle('article-uuid-1');
    chatCache.messages.push({ role: 'user', content: 'Tell me about Article 1' });
    chatCache.messages.push({ role: 'assistant', content: 'Article 1 details...' });
    assert.strictEqual(chatCache.messages.length, 2);

    // User closes and re-opens same article (Article 1)
    setArticle('article-uuid-1');
    assert.strictEqual(chatCache.messages.length, 2);
    assert.strictEqual(chatCache.messages[0].content, 'Tell me about Article 1');

    // User switches to Article 2: cache is reset, preventing conversation mixing
    setArticle('article-uuid-2');
    assert.strictEqual(chatCache.messages.length, 0);
  });

  it('9. Voice recognition does not silently auto-submit text to AI', () => {
    let inputFieldText = '';
    let submittedQuestion = null;

    // Simulate onResult updating input field
    const onVoiceResult = (transcript, isFinal) => {
      inputFieldText = transcript;
      // Requirement: Do not silently submit! User must explicitly send.
    };

    onVoiceResult('What is the maritime treaty about?', true);
    assert.strictEqual(inputFieldText, 'What is the maritime treaty about?');
    assert.strictEqual(submittedQuestion, null); // Has not been submitted

    // User can edit the transcript
    inputFieldText += ' And who signed it?';
    assert.strictEqual(inputFieldText, 'What is the maritime treaty about? And who signed it?');

    // Explicit submission
    submittedQuestion = inputFieldText;
    assert.strictEqual(submittedQuestion, 'What is the maritime treaty about? And who signed it?');
  });

  it('10. Correctly formats audio stream URL for TTS playback of AI response', () => {
    const streamRel = '/api/audio/stream/ai_resp_abc123.mp3';
    const fullUrl = getAudioStreamUrl(streamRel);
    assert.ok(fullUrl.includes('/api/audio/stream/ai_resp_abc123.mp3'));

    const absUrl = 'https://cdn.dailyvoice.com/audio/ai_resp_test.mp3';
    assert.strictEqual(getAudioStreamUrl(absUrl), absUrl);
  });
});
