
import { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { convertPCM24kToFloat32 } from '../utils/audio-utils';
import { ConnectionState, VoiceName } from '../types';

interface UseLiveApiProps {
  targetLanguage?: string;
}

export function useLiveApi({ 
  targetLanguage = 'Spanish', 
}: UseLiveApiProps = {}) {
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
  const [error, setError] = useState<string | null>(null);
  const [volume, setVolume] = useState(0); // Only for output volume now
  
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number>(0);
  
  const sessionPromiseRef = useRef<Promise<any> | null>(null);

  // Initialize output audio context
  useEffect(() => {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    outputAudioContextRef.current = new AudioContextClass({ sampleRate: 24000 });
    
    // Setup analyzer for visualization of the *spoken* audio
    const analyser = outputAudioContextRef.current.createAnalyser();
    analyser.fftSize = 256;
    analyserRef.current = analyser;

    // Visualizer Loop
    const updateVolume = () => {
        if (analyserRef.current) {
            const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
            analyserRef.current.getByteFrequencyData(dataArray);
            
            // Calculate average volume
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
                sum += dataArray[i];
            }
            const avg = sum / dataArray.length;
            setVolume(avg / 128); // Normalize roughly 0-1
        }
        animationFrameRef.current = requestAnimationFrame(updateVolume);
    };
    updateVolume();

    return () => {
        if (outputAudioContextRef.current) {
            outputAudioContextRef.current.close();
        }
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
        }
    };
  }, []);

  const disconnect = useCallback(async () => {
    setConnectionState(ConnectionState.DISCONNECTED);
    sessionPromiseRef.current = null;
  }, []);

  const connect = useCallback(async () => {
    try {
      setError(null);
      setConnectionState(ConnectionState.CONNECTING);
      
      const apiKey = process.env.API_KEY;
      if (!apiKey) {
        throw new Error('API_KEY not found in environment');
      }

      const ai = new GoogleGenAI({ apiKey });

      // STRICT TTS Configuration with Charismatic Persona
      // UPDATED: Language agnostic to support dynamic switching
      const systemInstruction = `
        ROLE: Professional Voice Actor / Dynamic Orator.
        TASK: You will receive text. Your ONLY job is to read it aloud in the language it is written in.
        
        VOICE STYLE GUIDE (Apply STRICTLY):
        1. DYNAMIC & MODULATED: Do not be monotone. Shift frequently from soft, conversational whispers (to draw the audience in) to loud, projecting shouts (to emphasize power and conviction).
        2. RHYTHMIC & REPETITIVE: Use a "preaching cadence". Build momentum rhythmically. Use repetition (anaphora) effectively.
        3. STACCATO & EMPHATIC: When listing struggles or key points, use a punchy, staccato delivery to make words land heavily.
        4. THEATRICAL: Use dramatic pauses to let concepts sink in. Act out the emotions (defiance, hope, authority).
        
        TONE:
        - Passionate and Urgent.
        - Encouraging but Authoritative.
        - Defiant against negativity.
        - Speak with ABSOLUTE CONVICTION.
        
        RULES:
        1. DO NOT translate. The text provided is already in the target language.
        2. DO NOT converse. Do not say "Okay" or "Sure".
        3. READ IMMEDIATELY in the language of the text.
        4. If you receive no text, be silent.
      `;

      const config = {
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Fenrir' as VoiceName } }, // Switched to Fenrir for more intensity/depth
          },
          // CRITICAL: Disable all input audio processing
          inputAudioTranscription: undefined, 
          systemInstruction: systemInstruction,
        },
      };

      const sessionPromise = ai.live.connect({
        ...config,
        callbacks: {
          onopen: () => {
            console.log('Gemini Live Connected (TTS Mode)');
            setConnectionState(ConnectionState.CONNECTED);
          },
          onmessage: async (message: LiveServerMessage) => {
            // Handle Audio Output (TTS)
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            
            if (base64Audio && outputAudioContextRef.current) {
               try {
                if (outputAudioContextRef.current.state === 'suspended') {
                  await outputAudioContextRef.current.resume();
                }

                const binaryString = window.atob(base64Audio);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                  bytes[i] = binaryString.charCodeAt(i);
                }
                
                const dataView = new DataView(bytes.buffer);
                const float32Data = convertPCM24kToFloat32(dataView);
                
                const audioBuffer = outputAudioContextRef.current.createBuffer(1, float32Data.length, 24000);
                audioBuffer.getChannelData(0).set(float32Data);

                const currentTime = outputAudioContextRef.current.currentTime;
                if (nextStartTimeRef.current < currentTime) {
                    nextStartTimeRef.current = currentTime;
                }
                
                const source = outputAudioContextRef.current.createBufferSource();
                source.buffer = audioBuffer;
                
                // Route through analyser for visualization
                if (analyserRef.current) {
                    source.connect(analyserRef.current);
                    analyserRef.current.connect(outputAudioContextRef.current.destination);
                } else {
                    source.connect(outputAudioContextRef.current.destination);
                }
                
                source.start(nextStartTimeRef.current);
                nextStartTimeRef.current += audioBuffer.duration;
               } catch (e) {
                 console.error("Error processing output audio", e);
               }
            }
          },
          onerror: (err) => {
            console.error('Gemini Live Error:', err);
            setConnectionState(ConnectionState.ERROR);
            setError("TTS Connection Error.");
          },
          onclose: () => {
            console.log('Gemini Live Closed');
            setConnectionState(ConnectionState.DISCONNECTED);
          }
        }
      });

      sessionPromiseRef.current = sessionPromise;

    } catch (error: any) {
      console.error('Failed to connect:', error);
      setConnectionState(ConnectionState.ERROR);
      setError(error.message || "Failed to initialize TTS.");
    }
  }, [disconnect]); // Removed targetLanguage dependency to prevent unnecessary reconnects

  const sendText = useCallback(async (text: string) => {
    if (sessionPromiseRef.current) {
        const session = await sessionPromiseRef.current;
        session.send({ parts: [{ text }] });
    }
  }, []);

  return {
    connect,
    disconnect,
    sendText,
    connectionState,
    volume,
    error
  };
}
