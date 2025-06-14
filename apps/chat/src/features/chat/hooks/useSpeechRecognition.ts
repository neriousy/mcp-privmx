import { useState, useEffect, useRef, useCallback } from 'react';

// Type definitions for Web Speech API
interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  [index: number]: SpeechRecognitionAlternative;
  length: number;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }

  interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    onstart: ((event: Event) => void) | null;
    onend: ((event: Event) => void) | null;
    onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
    onresult: ((event: SpeechRecognitionEvent) => void) | null;
    start(): void;
    stop(): void;
    abort(): void;
  }
}

interface UseSpeechRecognitionOptions {
  continuous?: boolean;
  interimResults?: boolean;
  language?: string;
}

interface UseSpeechRecognitionReturn {
  transcript: string;
  interimTranscript: string;
  finalTranscript: string;
  isListening: boolean;
  isSupported: boolean;
  error: string | null;
  startListening: () => void;
  stopListening: () => void;
  resetTranscript: () => void;
}

export function useSpeechRecognition(
  options: UseSpeechRecognitionOptions = {}
): UseSpeechRecognitionReturn {
  const {
    continuous = true,
    interimResults = true,
    language = 'en-US',
  } = options;

  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [finalTranscript, setFinalTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const isSupported = useRef(false);

  // Check if speech recognition is supported
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;

      if (SpeechRecognition) {
        isSupported.current = true;
        recognitionRef.current = new SpeechRecognition();

        const recognition = recognitionRef.current;
        recognition.continuous = continuous;
        recognition.interimResults = interimResults;
        recognition.lang = language;

        recognition.onstart = () => {
          setIsListening(true);
          setError(null);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
          setError(event.error);
          setIsListening(false);

          // Handle specific error cases
          switch (event.error) {
            case 'no-speech':
              setError('No speech detected. Please try again.');
              break;
            case 'audio-capture':
              setError('Audio capture failed. Please check your microphone.');
              break;
            case 'not-allowed':
              setError(
                'Microphone access denied. Please enable microphone permission.'
              );
              break;
            case 'network':
              setError('Network error occurred. Please check your connection.');
              break;
            default:
              setError(`Speech recognition error: ${event.error}`);
          }
        };

        recognition.onresult = (event: SpeechRecognitionEvent) => {
          let interimTranscriptValue = '';
          let finalTranscriptValue = '';

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const result = event.results[i];
            const transcriptPart = result[0].transcript;

            if (result.isFinal) {
              finalTranscriptValue += transcriptPart;
            } else {
              interimTranscriptValue += transcriptPart;
            }
          }

          setInterimTranscript(interimTranscriptValue);

          if (finalTranscriptValue) {
            setFinalTranscript((prev) => prev + finalTranscriptValue);
            setTranscript((prev) => prev + finalTranscriptValue);
          }
        };
      } else {
        console.warn('Speech recognition not supported in this browser');
      }
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, [continuous, interimResults, language]);

  const startListening = useCallback(() => {
    if (!isSupported.current) {
      setError('Speech recognition is not supported in this browser');
      return;
    }

    if (recognitionRef.current && !isListening) {
      setError(null);
      setInterimTranscript('');
      try {
        recognitionRef.current.start();
      } catch (err) {
        setError('Failed to start speech recognition');
        console.error('Speech recognition start error:', err);
      }
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
  }, [isListening]);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
    setFinalTranscript('');
  }, []);

  return {
    transcript,
    interimTranscript,
    finalTranscript,
    isListening,
    isSupported: isSupported.current,
    error,
    startListening,
    stopListening,
    resetTranscript,
  };
}
