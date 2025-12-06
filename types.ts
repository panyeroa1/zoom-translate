
export enum ConnectionState {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  ERROR = 'ERROR'
}

export interface AudioConfig {
  sampleRate: number;
  channelCount: number;
}

export interface TranscriptItem {
  id: string;
  speaker: 'user' | 'eburon';
  text: string;
  timestamp: Date;
  isFinal?: boolean;
}

export interface LiveConfig {
  targetLanguage: string;
}

export type VoiceName = 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr';

export interface AudioDevice {
  deviceId: string;
  label: string;
  type: 'microphone' | 'system' | 'zoom' | 'tab' | 'window';
}
