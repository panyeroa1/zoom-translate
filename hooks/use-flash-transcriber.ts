
import { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI } from "@google/genai";

// Helper to convert blob to base64
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        // Remove data URL prefix (e.g. "data:audio/webm;base64,")
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      } else {
        reject(new Error("Failed to convert blob"));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

interface UseFlashTranscriberProps {
  stream: MediaStream | null;
  onTranscript: (text: string) => void;
  language?: string;
}

export function useFlashTranscriber({ stream, onTranscript, language = 'en-US' }: UseFlashTranscriberProps) {
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mimeTypeRef = useRef<string>('');
  
  // Queue Management for Ordered Output
  const chunkSequenceRef = useRef(0);
  const nextOutputSequenceRef = useRef(0);
  const pendingChunksRef = useRef<Map<number, string>>(new Map());

  // Faster updates for streaming feel
  const CHUNK_DURATION = 1000; 

  const flushQueue = useCallback(() => {
    let nextId = nextOutputSequenceRef.current;
    
    // Process available consecutive chunks
    while (pendingChunksRef.current.has(nextId)) {
        const text = pendingChunksRef.current.get(nextId);
        pendingChunksRef.current.delete(nextId);
        
        if (text && text.trim()) {
            onTranscript(text);
        }
        
        nextId++;
    }
    nextOutputSequenceRef.current = nextId;
  }, [onTranscript]);

  const processAudioChunk = useCallback(async (blob: Blob, sequenceId: number) => {
    // Lower threshold to capture short commands
    if (blob.size < 50) {
        // Even if empty, we must mark this sequence as done to not block the queue
        pendingChunksRef.current.set(sequenceId, "");
        flushQueue();
        return;
    }

    try {
      const apiKey = process.env.API_KEY;
      if (!apiKey) throw new Error("No API Key");

      const ai = new GoogleGenAI({ apiKey });
      const base64Audio = await blobToBase64(blob);

      const prompt = `
        Task: Transcribe this audio segment from a continuous stream verbatim.
        Language: ${language}.
        Rules:
        - Output ONLY the transcribed text.
        - No notes, no explanations.
        - If audio is cut off, transcribe what is audible.
        - If no speech, return empty string.
      `;

      // Use the actual mime type determined by the recorder
      const mimeType = mimeTypeRef.current || 'audio/webm';

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Audio
            }
          },
          { text: prompt }
        ]
      });

      const text = response.text?.trim() || "";
      
      // Store result and attempt to flush
      pendingChunksRef.current.set(sequenceId, text);
      flushQueue();

    } catch (e) {
      // If a chunk fails, mark it empty so queue proceeds
      console.warn(`Chunk ${sequenceId} failed processing`, e);
      pendingChunksRef.current.set(sequenceId, "");
      flushQueue();
    }
  }, [language, flushQueue]);

  useEffect(() => {
    // 1. Basic Stream Validation
    if (!stream || !stream.active || stream.getAudioTracks().length === 0) {
      setIsTranscribing(false);
      return;
    }

    const audioTrack = stream.getAudioTracks()[0];
    if (audioTrack.readyState === 'ended') {
        setIsTranscribing(false);
        return;
    }

    // Cleanup previous recorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) { /* ignore */ }
    }

    // Reset Queue state on new stream start
    chunkSequenceRef.current = 0;
    nextOutputSequenceRef.current = 0;
    pendingChunksRef.current.clear();

    const startRecording = () => {
        // 2. Late Binding Validation
        if (!stream || !stream.active) {
            setIsTranscribing(false);
            return;
        }

        const currentTrack = stream.getAudioTracks()[0];
        if (!currentTrack || currentTrack.readyState !== 'live') {
             setIsTranscribing(false);
             return;
        }

        try {
            // Prioritize widely supported codecs
            const types = [
                'audio/webm;codecs=opus', 
                'audio/webm',
                'audio/mp4',
                '' // Default fallback
            ];
            
            let options: MediaRecorderOptions | undefined = undefined;
            
            for (const type of types) {
                if (type === '' || MediaRecorder.isTypeSupported(type)) {
                    if (type) {
                        options = { mimeType: type };
                    }
                    break;
                }
            }

            let recorder: MediaRecorder;
            try {
                recorder = new MediaRecorder(stream, options);
            } catch (e) {
                recorder = new MediaRecorder(stream);
            }

            mediaRecorderRef.current = recorder;
            mimeTypeRef.current = recorder.mimeType;

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    // Assign ID immediately to preserve order
                    const id = chunkSequenceRef.current++;
                    processAudioChunk(e.data, id);
                }
            };

            recorder.onerror = (e) => {
                console.warn("MediaRecorder Error:", e);
            };

            try {
                recorder.start(CHUNK_DURATION);
                setIsTranscribing(true);
            } catch (startErr) {
                console.error("Failed to start MediaRecorder:", startErr);
                setIsTranscribing(false);
            }

        } catch (e) {
            console.error("Failed to initialize MediaRecorder:", e);
            setIsTranscribing(false);
        }
    };

    // Safety delay for browser media pipeline
    const timer = setTimeout(startRecording, 250);

    return () => {
      clearTimeout(timer);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
            mediaRecorderRef.current.stop();
        } catch (e) { /* ignore */ }
      }
    };
  }, [stream, processAudioChunk]);

  return { isTranscribing };
}
