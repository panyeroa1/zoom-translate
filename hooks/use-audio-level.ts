
import { useState, useEffect, useRef } from 'react';

export function useAudioLevel(stream: MediaStream | null) {
  const [level, setLevel] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!stream || !stream.active) {
      setLevel(0);
      return;
    }

    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioContextClass();
      audioContextRef.current = audioContext;

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      analyserRef.current = analyser;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      sourceRef.current = source;

      const updateLevel = () => {
        if (!analyser) return;
        
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(dataArray);

        // Calculate RMS (Root Mean Square) for better volume approximation
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const average = sum / dataArray.length;
        
        // Normalize to roughly 0-1 range (128 is usually typical max for speech)
        const normalized = Math.min(1, average / 60); 
        
        setLevel(normalized);
        rafRef.current = requestAnimationFrame(updateLevel);
      };

      updateLevel();

      return () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        if (sourceRef.current) sourceRef.current.disconnect();
        if (audioContextRef.current) audioContextRef.current.close();
      };
    } catch (e) {
      console.error("Failed to initialize audio level analysis:", e);
      setLevel(0);
    }
  }, [stream]);

  return { level };
}
