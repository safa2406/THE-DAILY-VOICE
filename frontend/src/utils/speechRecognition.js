/**
 * Web Speech API Recognition Utility for The Daily Voice (Version 2)
 * Supports speech-to-text across English, Hindi, Kannada, Telugu, and Marathi.
 */

export const SPEECH_LANGUAGES = {
  English: 'en-IN',
  Hindi: 'hi-IN',
  Kannada: 'kn-IN',
  Telugu: 'te-IN',
  Marathi: 'mr-IN',
};

export function isSpeechRecognitionSupported() {
  if (typeof window === 'undefined') return false;
  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export function getSpeechRecognitionLanguage(appLanguage = 'English') {
  return SPEECH_LANGUAGES[appLanguage] || 'en-IN';
}

export function getFriendlySpeechErrorMessage(errorType) {
  switch (errorType) {
    case 'not-allowed':
    case 'permission-denied':
      return 'Microphone permission was denied. Please allow microphone access in your browser settings to ask questions by voice, or type your question below.';
    case 'service-not-allowed':
      return 'Microphone input is disabled by your browser or device security policy.';
    case 'no-speech':
      return 'No speech was detected. Please tap the microphone and try speaking again, or type your question.';
    case 'audio-capture':
      return 'No microphone was detected on this device. Please connect a microphone or use text input.';
    case 'network':
      return 'Speech recognition network service is temporarily unavailable. Please type your question.';
    case 'aborted':
      return 'Voice recording cancelled.';
    default:
      return 'Speech recognition encountered an issue. Please try speaking again or use text input.';
  }
}

export function createSpeechRecognizer({
  language = 'English',
  onResult,
  onError,
  onEnd,
  onStart,
}) {
  if (!isSpeechRecognitionSupported()) {
    return {
      start: () => {
        if (onError) {
          onError('Speech recognition is not supported in this browser. Please use text input instead.');
        }
      },
      stop: () => {},
      abort: () => {},
      isSupported: false,
    };
  }

  const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SpeechRecognitionClass();

  recognition.lang = getSpeechRecognitionLanguage(language);
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  let hasEnded = false;

  recognition.onstart = () => {
    hasEnded = false;
    if (onStart) onStart();
  };

  recognition.onresult = (event) => {
    let interimTranscript = '';
    let finalTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; ++i) {
      const piece = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        finalTranscript += piece;
      } else {
        interimTranscript += piece;
      }
    }

    const transcript = finalTranscript || interimTranscript;
    if (onResult && transcript) {
      onResult(transcript, Boolean(finalTranscript));
    }
  };

  recognition.onerror = (event) => {
    const errorMsg = getFriendlySpeechErrorMessage(event.error);
    if (event.error !== 'aborted' && onError) {
      onError(errorMsg);
    }
  };

  recognition.onend = () => {
    if (!hasEnded) {
      hasEnded = true;
      if (onEnd) onEnd();
    }
  };

  return {
    start: () => {
      try {
        recognition.start();
      } catch (err) {
        if (onError) onError('Could not start microphone: ' + err.message);
      }
    },
    stop: () => {
      try {
        recognition.stop();
      } catch {}
    },
    abort: () => {
      try {
        hasEnded = true;
        recognition.abort();
      } catch {}
    },
    isSupported: true,
  };
}
