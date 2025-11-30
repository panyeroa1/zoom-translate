
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
  
  // Chunk duration (ms). 
  const CHUNK_DURATION = 3000; 

  const processAudioChunk = useCallback(async (blob: Blob) => {
    if (blob.size < 1000) return; // Ignore empty/tiny chunks

    try {
      const apiKey = process.env.API_KEY;
      if (!apiKey) return;

      const ai = new GoogleGenAI({ apiKey });
      const base64Audio = await blobToBase64(blob);

      const prompt = `
        Task: Transcribe the speech in this audio verbatim.
        Language: The audio is likely in ${language}.
        Output: Only the transcribed text. If no speech is detected, output nothing.
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

      const text = response.text?.trim();
      if (text) {
        onTranscript(text);
      }
    } catch (e) {
      // Silent error for transcription glitches to avoid console spam
    }
  }, [language, onTranscript]);

  useEffect(() => {
    if (!stream || !stream.active || stream.getAudioTracks().length === 0) {
      setIsTranscribing(false);
      return;
    }

    // Cleanup previous recorder if it exists
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    const startRecording = () => {
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

            // Attempt to create recorder
            let recorder: MediaRecorder;
            try {
                recorder = new MediaRecorder(stream, options);
            } catch (e) {
                // Final fallback: Let browser decide everything
                recorder = new MediaRecorder(stream);
            }

            mediaRecorderRef.current = recorder;
            mimeTypeRef.current = recorder.mimeType;

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    processAudioChunk(e.data);
                }
            };

            recorder.onerror = (e) => {
                console.warn("MediaRecorder Error:", e);
                setIsTranscribing(false);
            };

            // Use timeslice to get chunks automatically
            recorder.start(CHUNK_DURATION);
            setIsTranscribing(true);

        } catch (e) {
            console.error("Failed to start MediaRecorder for transcription:", e);
            setIsTranscribing(false);
        }
    };

    // Small delay to ensure stream is fully ready (fixes some race conditions with getDisplayMedia)
    const timer = setTimeout(startRecording, 100);

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
