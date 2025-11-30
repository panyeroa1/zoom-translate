
import { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { float32ToBase64, convertPCM24kToFloat32 } from '../utils/audio-utils';
import { ConnectionState, VoiceName, AudioDevice } from '../types';

interface UseLiveApiProps {
  onTranscriptUpdate?: (text: string, isUser: boolean, isFinal: boolean) => void;
  targetLanguage?: string;
  sourceLanguage?: string;
  audioDevice?: AudioDevice;
  enableAudioInput?: boolean; // Control whether to stream audio to the model
}

export function useLiveApi({ 
  onTranscriptUpdate, 
  targetLanguage = 'Spanish', 
  sourceLanguage = 'Auto Detect',
  audioDevice,
  enableAudioInput = true
}: UseLiveApiProps = {}) {
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
  const [volume, setVolume] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  
  // We need to keep the session promise to send data
  const sessionPromiseRef = useRef<Promise<any> | null>(null);

  const cleanupAudio = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (outputAudioContextRef.current) {
      outputAudioContextRef.current.close();
      outputAudioContextRef.current = null;
    }
  }, []);

  const disconnect = useCallback(async () => {
    setConnectionState(ConnectionState.DISCONNECTED);
    cleanupAudio();
    sessionPromiseRef.current = null;
  }, [cleanupAudio]);

  // Specialized function to capture Zoom Meeting Audio
  const captureZoomAudio = async (): Promise<MediaStream> => {
    console.log("Initializing Zoom Audio Bridge...");
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: 1,
          height: 1,
          frameRate: 1, 
          displaySurface: "window", 
        } as any, 
        audio: {
          echoCancellation: false, 
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: 2,
          sampleRate: 48000,
          // @ts-ignore
          systemAudio: 'include' 
        }
      });
      return stream;
    } catch (error: any) {
      console.error("Zoom Bridge Connection Failed", error);
      if (error.name === 'NotAllowedError' && error.message.includes('permissions policy')) {
        throw new Error("Screen sharing is blocked by the environment. Please ensure 'display-capture' permission is allowed.");
      }
      throw error;
    }
  };

  const connect = useCallback(async () => {
    try {
      setError(null);
      setConnectionState(ConnectionState.CONNECTING);
      
      const apiKey = process.env.API_KEY;
      if (!apiKey) {
        throw new Error('API_KEY not found in environment');
      }

      const ai = new GoogleGenAI({ apiKey });

      // Initialize Audio Contexts
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      audioContextRef.current = new AudioContextClass({ sampleRate: 16000 }); 
      outputAudioContextRef.current = new AudioContextClass({ sampleRate: 24000 }); 

      // Get Audio Stream based on selected device
      let stream: MediaStream;

      if (audioDevice?.type === 'zoom') {
        stream = await captureZoomAudio();
      } else if (audioDevice?.type === 'system') {
        try {
          stream = await navigator.mediaDevices.getDisplayMedia({
            video: { width: 1, height: 1 },
            audio: {
              echoCancellation: false,
              noiseSuppression: false,
              autoGainControl: false,
              // @ts-ignore
              systemAudio: 'include'
            }
          });
        } catch (err: any) {
          if (err.name === 'NotAllowedError' && err.message.includes('permissions policy')) {
            throw new Error("Screen sharing blocked by policy. 'display-capture' permission required.");
          }
          throw err;
        }
      } else {
        const constraints: MediaStreamConstraints = {
          audio: audioDevice?.deviceId 
            ? { deviceId: { exact: audioDevice.deviceId } } 
            : true
        };
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      }

      if (stream.getAudioTracks().length === 0) {
        stream.getTracks().forEach(track => track.stop());
        throw new Error("No audio detected. You MUST check the 'Share Audio' box in the browser popup.");
      }

      mediaStreamRef.current = stream;

      stream.getTracks().forEach(track => {
        track.onended = () => {
          console.log("Stream ended");
          disconnect();
        };
      });

      // Setup Input Audio Processing
      sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
      processorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);

      const silentGain = audioContextRef.current.createGain();
      silentGain.gain.value = 0;
      sourceRef.current.connect(processorRef.current);
      processorRef.current.connect(silentGain);
      silentGain.connect(audioContextRef.current.destination);

      // Determine System Instruction based on pipeline mode
      let systemInstruction = "";
      
      if (!enableAudioInput) {
        // TTS / Reader Mode (Hybrid Pipeline)
        // STRICT INSTRUCTION: Pure Reader, No Chat, No Audio Listening
        systemInstruction = `
        ROLE: High-fidelity Text-to-Speech Reader.
        INPUT: You will receive text messages that are ALREADY TRANSLATED into ${targetLanguage}.
        TASK: Read the text aloud in ${targetLanguage} with a natural, professional voice.
        
        CRITICAL RULES:
        1. DO NOT translate the text. It is already in the target language.
        2. DO NOT respond conversationally (e.g., no "Okay", "Reading now").
        3. DO NOT output text. Only output AUDIO.
        4. If the text is empty or meaningless, remain silent.
        `;
      } else if (audioDevice?.type === 'zoom') {
        // Zoom Interpreter Mode
        systemInstruction = `
        TASK: You are a professional simultaneous interpreter for a Zoom meeting.
        INPUT SOURCE: The audio is coming directly from a Zoom meeting stream.
        GUIDELINES:
        1. Accurately translate speech from all participants in real-time.
        2. IGNORE "Recording in progress", "Mute", "Unmute" announcements.
        3. IGNORE join/leave chimes and background notification sounds.
        4. Focus on the human speakers. If multiple people speak, prioritize the dominant voice.
        5. Maintain a neutral, professional tone.
        Target Language: ${targetLanguage}.
        `;
      } else {
         // Standard Interpreter Mode
         systemInstruction = `You are Eburon, an advanced AI translator. 
          Input Audio Language: ${sourceLanguage === 'Auto Detect' ? 'Detect automatically' : sourceLanguage}.
          Target Language: ${targetLanguage}.
          Task: Translate the input audio into the Target Language and speak it out loud.
          Constraint: If the input audio is detected to be the same as the Target Language, translate it into English (bidirectional mode).
          Keep translations precise, natural, and immediate. Do not add filler conversational text, just translate.`;
      }

      const config = {
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' as VoiceName } },
          },
          // CRITICAL: Explicitly undefined when not using audio input to prevent model from expecting/processing audio
          inputAudioTranscription: enableAudioInput ? {} : undefined, 
          systemInstruction: systemInstruction,
        },
      };

      // Connect to Gemini Live
      const sessionPromise = ai.live.connect({
        ...config,
        callbacks: {
          onopen: () => {
            console.log('Gemini Live Connected');
            setConnectionState(ConnectionState.CONNECTED);
          },
          onmessage: async (message: LiveServerMessage) => {
            // Handle Audio Output
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
                const gainNode = outputAudioContextRef.current.createGain();
                gainNode.gain.value = 1.0; 
                
                source.connect(gainNode);
                gainNode.connect(outputAudioContextRef.current.destination);
                
                source.start(nextStartTimeRef.current);
                nextStartTimeRef.current += audioBuffer.duration;
               } catch (e) {
                 console.error("Error processing output audio", e);
               }
            }

            // Handle Input Transcription (User Speech) - Only if streaming audio
            if (enableAudioInput) {
                const inputTranscript = message.serverContent?.inputTranscription?.text;
                if (inputTranscript && onTranscriptUpdate) {
                  onTranscriptUpdate(inputTranscript, true, false);
                }

                if (message.serverContent?.turnComplete && onTranscriptUpdate) {
                  onTranscriptUpdate("", true, true);
                }
            }
          },
          onerror: (err) => {
            console.error('Gemini Live Error:', err);
            setConnectionState(ConnectionState.ERROR);
            setError("Connection Error. Please check permissions and try again.");
          },
          onclose: () => {
            console.log('Gemini Live Closed');
            setConnectionState(ConnectionState.DISCONNECTED);
          }
        }
      });

      sessionPromiseRef.current = sessionPromise;

      // Audio Processing Loop
      processorRef.current.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        
        // Always calculate volume for visualizer
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) {
          sum += inputData[i] * inputData[i];
        }
        const rms = Math.sqrt(sum / inputData.length);
        setVolume(rms);

        // SECURITY: Strictly block audio sending if enableAudioInput is false
        if (enableAudioInput) {
            const base64PCM = float32ToBase64(inputData);
            sessionPromise.then((session) => {
              session.sendRealtimeInput({
                media: {
                  mimeType: 'audio/pcm;rate=16000',
                  data: base64PCM
                }
              });
            });
        }
      };

    } catch (error: any) {
      console.error('Failed to connect:', error);
      setConnectionState(ConnectionState.ERROR);
      setError(error.message || "Failed to initialize audio.");
      cleanupAudio();
    }
  }, [targetLanguage, sourceLanguage, cleanupAudio, audioDevice, onTranscriptUpdate, disconnect, enableAudioInput]);

  // Method to manually send text to be spoken (TTS)
  const sendText = useCallback(async (text: string) => {
    if (sessionPromiseRef.current) {
        const session = await sessionPromiseRef.current;
        // Sending text directly to the model
        // The System Instruction ensures it simply reads this text aloud
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
