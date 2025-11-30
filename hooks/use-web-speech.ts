
import { useState, useEffect, useRef, useCallback } from 'react';

interface UseWebSpeechReturn {
  isListening: boolean;
  transcript: string;
  interimTranscript: string;
  startListening: () => void;
  stopListening: () => void;
  resetTranscript: () => void;
  isSupported: boolean;
}

interface UseWebSpeechProps {
  language?: string;
  onFinalTranscript?: (text: string) => void;
}

export function useWebSpeech({ language = 'en-US', onFinalTranscript }: UseWebSpeechProps = {}): UseWebSpeechReturn {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isSupported, setIsSupported] = useState(false);
  
  const recognitionRef = useRef<any>(null);
  const onFinalCallbackRef = useRef(onFinalTranscript);

  // Keep callback fresh
  useEffect(() => {
    onFinalCallbackRef.current = onFinalTranscript;
  }, [onFinalTranscript]);

  useEffect(() => {
    // Check for browser support
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      setIsSupported(true);
      if (!recognitionRef.current) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = true;
        recognitionRef.current.interimResults = true;
      }
      
      // Update language when it changes
      recognitionRef.current.lang = language;

      recognitionRef.current.onresult = (event: any) => {
        let finalTranscript = '';
        let currentInterim = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            currentInterim += event.results[i][0].transcript;
          }
        }

        if (finalTranscript) {
          const trimmed = finalTranscript.trim();
          setTranscript((prev) => prev + ' ' + trimmed);
          // Trigger callback for the new final chunk
          if (onFinalCallbackRef.current) {
            onFinalCallbackRef.current(trimmed);
          }
        }
        setInterimTranscript(currentInterim);
      };

      recognitionRef.current.onerror = (event: any) => {
        // Ignore "no-speech" errors as they are common when silent
        if (event.error !== 'no-speech') {
           console.error('Speech recognition error', event.error);
        }
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setIsListening(false);
        }
      };

      recognitionRef.current.onend = () => {
        if (isListening) {
           // Auto-restart if it stops unexpectedly while supposed to be listening
           try {
             recognitionRef.current.start();
           } catch (e) {
             setIsListening(false);
           }
        }
      };
    }
  }, [isListening, language]);

  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListening) {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (e) {
        console.error("Failed to start speech recognition", e);
      }
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      setIsListening(false); // Update state first to prevent auto-restart
      recognitionRef.current.stop();
    }
  }, [isListening]);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
  }, []);

  return {
    isListening,
    transcript,
    interimTranscript,
    startListening,
    stopListening,
    resetTranscript,
    isSupported
  };
}