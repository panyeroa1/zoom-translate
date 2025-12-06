
import { useState, useEffect, useCallback } from 'react';
import { AudioDevice } from '../types';

export function useMediaDevices() {
  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const [permissionGranted, setPermissionGranted] = useState(false);

  const fetchDevices = useCallback(async () => {
    try {
      // We need to verify permission to get labels
      const perms = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      setPermissionGranted(perms.state === 'granted');

      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = allDevices.filter(d => d.kind === 'audioinput');
      
      const formattedDevices: AudioDevice[] = audioInputs.map(d => ({
        deviceId: d.deviceId,
        label: d.label || `Microphone ${d.deviceId.slice(0, 5)}...`,
        type: 'microphone'
      }));

      // 1. Browser Tab
      formattedDevices.push({
        deviceId: 'browser-tab-audio',
        label: 'Browser Tab (Isolated Audio)',
        type: 'tab'
      });

      // 2. Specific App Window
      formattedDevices.push({
        deviceId: 'app-window-audio',
        label: 'Specific App Window (Spotify, VLC...)',
        type: 'window'
      });

      // 3. System Audio
      formattedDevices.push({
        deviceId: 'system-audio',
        label: 'Device Internal Audio',
        type: 'system'
      });

      // 4. Zoom Meeting
      formattedDevices.push({
        deviceId: 'zoom-api-stream',
        label: 'Zoom Meeting (Live Stream)',
        type: 'zoom'
      });

      setDevices(formattedDevices);
    } catch (e) {
      console.error("Error enumerating devices", e);
    }
  }, []);

  useEffect(() => {
    fetchDevices();
    navigator.mediaDevices.addEventListener('devicechange', fetchDevices);
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', fetchDevices);
    };
  }, [fetchDevices]);

  return { devices, fetchDevices, permissionGranted };
}
