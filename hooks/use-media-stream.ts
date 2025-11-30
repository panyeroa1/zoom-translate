
import { useState, useCallback, useRef, useEffect } from 'react';
import { AudioDevice } from '../types';

export function useMediaStream(selectedDevice?: AudioDevice) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);

  // Capture Zoom Meeting Audio
  const captureZoomAudio = async (): Promise<MediaStream> => {
    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
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
      return displayStream;
    } catch (err: any) {
      if (err.name === 'NotAllowedError' && err.message.includes('permissions policy')) {
        throw new Error("Screen sharing is blocked. 'display-capture' permission required.");
      }
      throw err;
    }
  };

  const startStream = useCallback(async () => {
    setError(null);
    try {
      let newStream: MediaStream;

      if (selectedDevice?.type === 'zoom') {
        newStream = await captureZoomAudio();
      } else if (selectedDevice?.type === 'system') {
        newStream = await navigator.mediaDevices.getDisplayMedia({
          video: { width: 1, height: 1 },
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
            // @ts-ignore
            systemAudio: 'include'
          }
        });
      } else {
        // Microphone
        const constraints: MediaStreamConstraints = {
          audio: selectedDevice?.deviceId 
            ? { deviceId: { exact: selectedDevice.deviceId } } 
            : true
        };
        newStream = await navigator.mediaDevices.getUserMedia(constraints);
      }

      // Verify audio track exists (critical for system/zoom capture)
      if (newStream.getAudioTracks().length === 0) {
        newStream.getTracks().forEach(t => t.stop());
        throw new Error("No audio track detected. You MUST check the 'Share Audio' box in the browser popup.");
      }

      // Handle stream ending (user clicks "Stop Sharing")
      newStream.getTracks().forEach(track => {
        track.onended = () => {
          stopStream();
        };
      });

      setStream(newStream);
      setIsStreaming(true);
    } catch (e: any) {
      console.error("Stream acquisition failed:", e);
      setError(e.message || "Failed to acquire audio stream.");
      setIsStreaming(false);
    }
  }, [selectedDevice]);

  const stopStream = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
      setIsStreaming(false);
    }
  }, [stream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return {
    stream,
    isStreaming,
    error,
    startStream,
    stopStream
  };
}
