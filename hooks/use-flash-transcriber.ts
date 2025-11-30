
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
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const mimeTypeRef = useRef<string>('');
  
  // Chunk duration (ms). 
  // 3s is a good balance between latency and context for the model.
  const CHUNK_DURATION = 3000; 

  const processAudioChunk = useCallback(async (blob: Blob) => {
    if (blob.size < 1000) return; // Ignore empty chunks

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
      console.error("Flash Transcription Error:", e);
    }
  }, [language, onTranscript]);

  useEffect(() => {
    if (!stream || !stream.active || stream.getAudioTracks().length === 0) {
      setIsTranscribing(false);
      return;
    }

    try {
      // 1. Detect supported MIME type
      // Browsers vary in support. We check common types.
      const types = [
        'audio/webm;codecs=opus', 
        'audio/webm',
        'audio/mp4',
        'audio/aac',
        'audio/ogg',
        '' // Allow browser default
      ];
      
      let options: MediaRecorderOptions = {};
      for (const type of types) {
        if (type === '' || MediaRecorder.isTypeSupported(type)) {
          if (type) options = { mimeType: type };
          break;
        }
      }

      const recorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = recorder;
      
      // Store the *actual* mime type the browser decided to use
      // This is critical for the API to know how to decode the inlineData
      mimeTypeRef.current = recorder.mimeType; 

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          processAudioChunk(e.data);
        }
      };

      recorder.start();
      setIsTranscribing(true);

      // Slice the audio into chunks periodically
      intervalRef.current = setInterval(() => {
        if (recorder.state === 'recording') {
          recorder.requestData();
        }
      }, CHUNK_DURATION);

    } catch (e) {
      console.error("Failed to start MediaRecorder for transcription:", e);
      setIsTranscribing(false);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, [stream, processAudioChunk]);

  return { isTranscribing };
}
