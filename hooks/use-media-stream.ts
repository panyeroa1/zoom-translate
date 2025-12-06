import { useState, useCallback, useRef, useEffect } from 'react';
import { AudioDevice } from '../types';

export function useMediaStream(selectedDevice?: AudioDevice) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  
  // Use a ref to track the current stream for stable access in callbacks and cleanup
  const streamRef = useRef<MediaStream | null>(null);

  // Stop Stream - Defined before startStream to avoid usage before declaration
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setStream(null);
    setIsStreaming(false);
  }, []);

  // Capture Zoom Meeting Audio (Window Level)
  const captureZoomAudio = async (): Promise<MediaStream> => {
    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: 1,
          height: 1,
          frameRate: 1,
          displaySurface: "window", // Prefer window for Zoom app
        } as any,
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: 2,
          sampleRate: 48000,
          // @ts-ignore
          systemAudio: 'include'
        },
        selfBrowserSurface: "exclude"
      } as any);
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
      let displaySurfaceCheck: 'browser' | 'window' | 'monitor' | null = null;

      // Configuration based on device type
      let displayMediaOptions: any = {
        video: {
            width: 1,
            height: 1,
            frameRate: 1,
        },
        audio: {
            echoCancellation: false, // Essential for high fidelity music/movies
            noiseSuppression: false,
            autoGainControl: false,
            channelCount: 2
        },
        selfBrowserSurface: "exclude" // Prevent capturing the app itself to avoid feedback
      };

      if (selectedDevice?.type === 'microphone') {
         // Standard Mic Capture
         const constraints: MediaStreamConstraints = {
          audio: selectedDevice?.deviceId 
            ? { deviceId: { exact: selectedDevice.deviceId } } 
            : true
        };
        newStream = await navigator.mediaDevices.getUserMedia(constraints);

      } else {
        // Display Media Capture (Tab, Window, System, Zoom)
        
        if (selectedDevice?.type === 'tab') {
            displayMediaOptions.video.displaySurface = "browser";
            displayMediaOptions.preferCurrentTab = false;
            displaySurfaceCheck = 'browser';
        } else if (selectedDevice?.type === 'window' || selectedDevice?.type === 'zoom') {
            displayMediaOptions.video.displaySurface = "window";
            displaySurfaceCheck = 'window';
        } else if (selectedDevice?.type === 'system') {
            displayMediaOptions.video.displaySurface = "monitor";
            displayMediaOptions.systemAudio = "include"; 
            displaySurfaceCheck = 'monitor';
        }

        // Acquire Stream
        newStream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);

        // --- STRICT ISOLATION CHECK ---
        // Verify the user actually selected the correct type of source to prevent audio leakage.
        const videoTrack = newStream.getVideoTracks()[0];
        const settings = videoTrack.getSettings();

        // Note: Some browsers might not report displaySurface, so we check if it exists first.
        if (displaySurfaceCheck && settings.displaySurface && settings.displaySurface !== displaySurfaceCheck) {
            // Stop immediately to prevent leakage
            newStream.getTracks().forEach(t => t.stop());
            
            let msg = "Incorrect Source Selected.";
            if (displaySurfaceCheck === 'browser') {
                msg = "Strict Isolation Failed: You selected a specific Window or Entire Screen instead of a 'Chrome Tab'. This causes audio leakage. Please try again and select the Tab tab.";
            } else if (displaySurfaceCheck === 'window') {
                msg = "Strict Isolation Failed: You selected the Entire Screen instead of a specific Window. Please try again.";
            }
            
            throw new Error(msg);
        }
      }

      // Verify audio track exists (critical for system/zoom/tab capture)
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
      streamRef.current = newStream; // Update ref immediately
      setIsStreaming(true);
    } catch (e: any) {
      console.error("Stream acquisition failed:", e);
      // Clean error message
      let msg = e.message || "Failed to acquire audio stream.";
      if (e.name === 'NotAllowedError') {
          msg = "Permission denied. You cancelled the selection.";
      }
      setError(msg);
      setIsStreaming(false);
    }
  }, [selectedDevice, stopStream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
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