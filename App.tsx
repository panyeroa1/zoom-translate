
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, Power, Globe, Activity, Terminal, User, Settings, Laptop, ArrowRight, Video, AlertTriangle, ExternalLink, Sparkles, MicOff, Waves } from 'lucide-react';
import clsx from 'clsx';
import { useLiveApi } from './hooks/use-live-api';
import { useMediaDevices } from './hooks/use-media-devices';
import { useWebSpeech } from './hooks/use-web-speech';
import { useMediaStream } from './hooks/use-media-stream';
import { useFlashTranscriber } from './hooks/use-flash-transcriber';
import { translateText } from './utils/translator';
import { LANGUAGES, getLanguageCode } from './utils/languages';
import AudioVisualizer from './components/AudioVisualizer';
import ChatMessage from './components/ChatMessage';
import { ConnectionState, TranscriptItem, AudioDevice } from './types';

function App() {
  const [sourceLanguage, setSourceLanguage] = useState('Auto Detect');
  const [targetLanguage, setTargetLanguage] = useState('Spanish');
  const [messages, setMessages] = useState<TranscriptItem[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<AudioDevice | undefined>(undefined);
  const [zoomLink, setZoomLink] = useState('https://us05web.zoom.us/j/9503133821?pwd=Q6fXaVzbmdskUNdUC2AjOZtzjCroIT.1');
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const { devices, fetchDevices, permissionGranted } = useMediaDevices();
  
  // Set default device
  useEffect(() => {
    if (devices.length > 0 && !selectedDevice) {
      const defaultMic = devices.find(d => d.type === 'microphone');
      setSelectedDevice(defaultMic);
    }
  }, [devices, selectedDevice]);

  // --- 1. SOURCE: Media Stream Acquisition ---
  // Gets the stream from Mic, System, or Zoom
  const { 
    stream, 
    startStream, 
    stopStream, 
    isStreaming, 
    error: streamError 
  } = useMediaStream(selectedDevice);

  // --- 2. DESTINATION: TTS Engine (Gemini Live) ---
  // Reads aloud the translated text
  const { 
    connect: connectLive, 
    disconnect: disconnectLive, 
    sendText: sendTextToLive,
    connectionState, 
    volume,
    error: liveError
  } = useLiveApi({ 
    targetLanguage,
  });

  // --- 3A. TRANSCRIPTION (Microphone) ---
  // Uses Web Speech API for low latency local mic transcription
  const webSpeechLang = getLanguageCode(sourceLanguage);
  
  // Handlers for Unified Processing
  const processTranscript = useCallback(async (text: string) => {
    if (!text.trim()) return;

    // Log Original
    setMessages(old => [...old, {
      id: Date.now().toString(),
      speaker: 'user',
      text: text,
      timestamp: new Date()
    }]);

    // Translate (Flash)
    try {
        const translated = await translateText(text, sourceLanguage, targetLanguage);
        
        // Log Translation
        setMessages(old => [...old, {
          id: Date.now() + '_trans',
          speaker: 'eburon',
          text: translated, // Show translation in chat
          timestamp: new Date()
        }]);

        // TTS (Live)
        if (translated && connectionState === ConnectionState.CONNECTED) {
            await sendTextToLive(translated);
        }
    } catch (e) {
        console.error("Pipeline Error", e);
    }
  }, [sourceLanguage, targetLanguage, connectionState, sendTextToLive]);

  // Web Speech Hook
  const { 
    isListening: isWebSpeechListening, 
    interimTranscript: webSpeechInterim, 
    startListening: startWebSpeech, 
    stopListening: stopWebSpeech,
    resetTranscript: resetWebSpeech
  } = useWebSpeech({ 
    language: webSpeechLang,
    onFinalTranscript: (text) => {
      // Only process if we are in Microphone mode
      if (selectedDevice?.type === 'microphone') {
        processTranscript(text);
      }
    }
  });

  // --- 3B. TRANSCRIPTION (System/Zoom) ---
  // Uses Gemini Flash to transcribe the MediaStream since WebSpeech can't
  const { isTranscribing: isFlashTranscribing } = useFlashTranscriber({
    stream: selectedDevice?.type !== 'microphone' ? stream : null, // Only active for non-mic
    onTranscript: processTranscript,
    language: sourceLanguage === 'Auto Detect' ? undefined : sourceLanguage
  });


  // --- CONNECTION MANAGEMENT ---
  const connect = useCallback(async () => {
    // 1. Start Audio Stream (Mic or System)
    await startStream();

    // 2. Connect TTS Engine
    connectLive();

    // 3. Start Web Speech (only acts if mic)
    if (selectedDevice?.type === 'microphone') {
      resetWebSpeech();
      startWebSpeech();
    }
  }, [startStream, connectLive, startWebSpeech, resetWebSpeech, selectedDevice]);

  const disconnect = useCallback(() => {
    stopStream();
    disconnectLive();
    stopWebSpeech();
  }, [stopStream, disconnectLive, stopWebSpeech]);

  const handleToggleConnection = () => {
    if (connectionState === ConnectionState.CONNECTED || isStreaming) {
      disconnect();
    } else {
      setMessages([]);
      connect();
    }
  };

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, webSpeechInterim]);

  // Initial Permission Request
  useEffect(() => {
    if (!permissionGranted) {
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(() => fetchDevices())
        .catch(e => console.warn("Mic permission denied initially", e));
    }
  }, [permissionGranted, fetchDevices]);

  // Status Message
  useEffect(() => {
    if (connectionState === ConnectionState.CONNECTED) {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        speaker: 'eburon',
        text: `Pipeline Active: ${selectedDevice?.label} -> Transcription -> Translation -> TTS`,
        timestamp: new Date()
      }]);
    }
  }, [connectionState, selectedDevice]);


  const handleOpenZoom = () => {
    window.open(zoomLink, '_blank');
  };

  const isConnected = connectionState === ConnectionState.CONNECTED;
  const isConnecting = connectionState === ConnectionState.CONNECTING;

  // Visual State
  const isActive = isConnected && (isWebSpeechListening || isFlashTranscribing);
  const displayInterim = selectedDevice?.type === 'microphone' ? webSpeechInterim : (isFlashTranscribing ? 'Analysing audio stream...' : '');

  const getSourceIcon = () => {
    if (selectedDevice?.type === 'zoom') return <Video size={10} />;
    if (selectedDevice?.type === 'system') return <Laptop size={10} />;
    return <Mic size={10} />;
  };

  return (
    <div className="min-h-screen bg-eburon-900 text-gray-200 font-sans selection:bg-eburon-accent selection:text-black flex flex-col">
      {/* Header */}
      <header className="border-b border-eburon-700 bg-eburon-900/50 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-auto md:h-20 py-4 md:py-0 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="w-10 h-10 bg-eburon-accent/10 rounded border border-eburon-accent/30 flex items-center justify-center">
              <Activity className="text-eburon-accent animate-pulse" size={20} />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white">EBURON <span className="text-eburon-accent">LIVE</span></h1>
              <p className="text-xs text-gray-500 font-mono">NEURAL TRANSLATION PIPELINE</p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center justify-end gap-2 w-full md:w-auto">
             {/* Source Language */}
             <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-eburon-800 border border-eburon-700 max-w-[160px]">
               <span className="text-[10px] text-gray-500 font-mono uppercase">In</span>
               <select 
                 value={sourceLanguage}
                 onChange={(e) => setSourceLanguage(e.target.value)}
                 disabled={isConnected}
                 className="bg-transparent text-sm text-gray-200 focus:outline-none disabled:opacity-50 w-full cursor-pointer"
               >
                 <option value="Auto Detect">Auto Detect</option>
                 {LANGUAGES.map(lang => (
                   <option key={`source-${lang}`} value={lang}>{lang}</option>
                 ))}
               </select>
             </div>

             <ArrowRight size={14} className="text-gray-600 hidden sm:block" />

             {/* Target Language */}
             <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-eburon-800 border border-eburon-700 max-w-[160px]">
               <span className="text-[10px] text-gray-500 font-mono uppercase">Out</span>
               <select 
                 value={targetLanguage}
                 onChange={(e) => setTargetLanguage(e.target.value)}
                 disabled={isConnected}
                 className="bg-transparent text-sm text-gray-200 focus:outline-none disabled:opacity-50 w-full cursor-pointer"
               >
                 {LANGUAGES.map(lang => (
                   <option key={`target-${lang}`} value={lang}>{lang}</option>
                 ))}
               </select>
             </div>
             
             <div className={clsx(
               "flex items-center gap-2 px-3 py-1.5 rounded border text-xs font-mono uppercase ml-2",
               isConnected ? "border-eburon-success/30 bg-eburon-success/10 text-eburon-success" : "border-gray-700 bg-gray-800 text-gray-500"
             )}>
               <div className={clsx("w-2 h-2 rounded-full", isConnected ? "bg-eburon-success animate-pulse" : "bg-gray-500")} />
               {connectionState}
             </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl mx-auto w-full p-4 flex flex-col gap-6 overflow-hidden">
        
        {/* Visualizer & Status */}
        <div className="bg-eburon-800 rounded-xl border border-eburon-700 p-6 flex flex-col items-center justify-center gap-6 relative overflow-hidden shadow-2xl transition-all duration-500">
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 mix-blend-overlay"></div>
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-eburon-900/50"></div>

          <div className="relative z-10 w-full flex flex-col items-center gap-4">
             {/* Use volume from TTS engine for visualization since that's what we want to "see" Eburon speaking */}
             <AudioVisualizer volume={volume} isActive={isConnected} />
             
             {/* Device Selector */}
             {!isConnected && (
               <div className="flex flex-col gap-3 items-center w-full max-w-md">
                 <div className="flex items-center gap-2 bg-black/30 p-2 rounded-lg border border-eburon-700/50 w-full">
                   <Settings size={14} className="text-gray-500 ml-2" />
                   <select 
                     className="bg-transparent text-xs font-mono text-gray-300 focus:outline-none w-full"
                     value={selectedDevice?.deviceId || ''}
                     onChange={(e) => {
                       const device = devices.find(d => d.deviceId === e.target.value);
                       setSelectedDevice(device);
                     }}
                   >
                     {devices.map(device => (
                       <option key={device.deviceId} value={device.deviceId}>
                         {device.label}
                       </option>
                     ))}
                   </select>
                 </div>

                 {/* Zoom Meeting Specific Control */}
                 {selectedDevice?.type === 'zoom' && (
                   <div className="w-full bg-blue-900/10 border border-blue-500/20 rounded-lg p-3 flex flex-col gap-2">
                      <div className="flex items-center gap-2 mb-1">
                        <Video size={14} className="text-blue-400" />
                        <span className="text-xs font-bold text-blue-200 uppercase">Target Meeting</span>
                      </div>
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          value={zoomLink}
                          onChange={(e) => setZoomLink(e.target.value)}
                          className="flex-1 bg-black/40 border border-blue-500/20 rounded px-2 py-1.5 text-xs text-blue-100 focus:outline-none focus:border-blue-500/50 font-mono"
                        />
                        <button 
                          onClick={handleOpenZoom}
                          className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-3 py-1.5 rounded flex items-center gap-1 transition-colors font-medium"
                        >
                          <ExternalLink size={12} /> Open
                        </button>
                      </div>
                      <p className="text-[10px] text-blue-300/60 leading-tight">
                        Step 1: Open the meeting. Step 2: Click 'Initialize' below and select the Zoom tab/window to capture audio.
                      </p>
                   </div>
                 )}
               </div>
             )}

             <div className="text-xs font-mono text-gray-500 mt-2 uppercase tracking-widest flex flex-col items-center gap-2">
               {isConnected ? (
                  <div className="flex flex-col items-center gap-1">
                    <div className="flex items-center gap-2">
                         {selectedDevice?.type === 'zoom' ? (
                            <>
                                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse shadow-[0_0_10px_#3b82f6]" />
                                <span className="text-blue-400 font-bold">ZOOM_MEETING_ACTIVE</span>
                            </>
                         ) : (
                            <>
                                <div className="w-1.5 h-1.5 bg-eburon-accent rounded-full animate-pulse" />
                                <span className="text-eburon-accent">PIPELINE_ACTIVE</span>
                            </>
                         )}
                    </div>
                    {isFlashTranscribing && <span className="text-[9px] text-gray-600">Processing Stream...</span>}
                  </div>
               ) : 'System Standby'}

               {/* Pipeline Indicator */}
               {isConnected && (
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-black/40 border border-gray-800 text-[10px] text-gray-400">
                    <Waves size={10} className="text-gray-500" />
                    <span>{selectedDevice?.type === 'microphone' ? 'WebSpeech' : 'Flash Audio'} Input</span>
                    <span className="text-gray-600">→</span>
                    <Globe size={10} className="text-eburon-accent" />
                    <span>Flash Translate</span>
                    <span className="text-gray-600">→</span>
                    <Sparkles size={10} className="text-eburon-success" />
                    <span>Live TTS</span>
                  </div>
               )}
             </div>
          </div>
        </div>

        {/* Alerts and Warnings */}
        {(selectedDevice?.type === 'system' || selectedDevice?.type === 'zoom') && !isConnected && (
            <div className="bg-amber-900/20 border border-amber-500/30 rounded-lg p-3 flex items-start gap-3">
              <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={16} />
              <div className="text-xs text-amber-200/80">
                <p className="font-bold mb-1">AUDIO PERMISSION REQUIRED:</p>
                <p>When you click Initialize, a browser popup will appear. You MUST select the <strong>Zoom Tab</strong> or <strong>Window</strong> and check the <strong className="text-white border-b border-white/30">"Share Audio"</strong> box.</p>
              </div>
            </div>
        )}

        {/* Live Error */}
        {(liveError || streamError) && (
          <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3 flex items-start gap-3">
            <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={16} />
            <div className="text-xs text-red-200/80">
              <p className="font-bold mb-1">ERROR:</p>
              <p>{liveError || streamError}</p>
            </div>
          </div>
        )}

        {/* Chat / Transcript Area */}
        <div className="flex-1 bg-eburon-900 border border-eburon-700 rounded-xl overflow-hidden flex flex-col relative min-h-[400px]">
          <div className="absolute top-0 left-0 right-0 h-8 bg-eburon-800 border-b border-eburon-700 flex items-center px-4 gap-2 justify-between">
            <div className="flex items-center gap-2">
              <Terminal size={14} className="text-gray-500" />
              <span className="text-xs text-gray-400 font-mono">LIVE_TRANSCRIPT_LOG</span>
            </div>
            {(selectedDevice?.type === 'system' || selectedDevice?.type === 'zoom') && (
              <div className="flex items-center gap-1 text-[10px] text-eburon-accent font-mono border border-eburon-accent/20 px-1.5 rounded bg-eburon-accent/5">
                {getSourceIcon()}
                {selectedDevice.type === 'zoom' ? 'ZOOM_STREAM' : 'SYSTEM_AUDIO'}
              </div>
            )}
          </div>
          
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 pt-10 scroll-smooth">
            {messages.length === 0 && !displayInterim && !isConnected && (
              <div className="h-full flex flex-col items-center justify-center text-gray-600 opacity-50">
                <Globe size={48} className="mb-4 text-eburon-700" />
                <p className="font-mono text-sm">Select language and initialize pipeline.</p>
              </div>
            )}
            
            {messages.map(msg => (
              <ChatMessage key={msg.id} message={msg} />
            ))}

            {/* Live Transcript Bubble (Interim) */}
            {displayInterim && (
              <div className="flex gap-4 p-4 rounded-lg mb-2 border bg-eburon-900 border-eburon-800 text-gray-300 animate-in fade-in slide-in-from-bottom-2">
                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-gray-700/20">
                   <User size={18} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold uppercase tracking-wider opacity-70">
                      {selectedDevice?.type === 'system' || selectedDevice?.type === 'zoom' 
                        ? 'Stream Analysis' 
                        : 'Microphone Input'}
                    </span>
                    <span className="text-[10px] px-1 rounded animate-pulse bg-eburon-accent/10 text-eburon-accent">
                      LISTENING
                    </span>
                  </div>
                  <p className="font-mono text-sm leading-relaxed text-gray-300">
                    {displayInterim}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

      </main>

      {/* Footer Controls */}
      <footer className="border-t border-eburon-700 bg-eburon-900 p-6">
        <div className="max-w-5xl mx-auto flex items-center justify-center gap-6">
          <button
            onClick={handleToggleConnection}
            disabled={isConnecting}
            className={clsx(
              "group relative flex items-center justify-center w-16 h-16 rounded-full transition-all duration-300 shadow-lg hover:shadow-eburon-accent/20",
              isConnected 
                ? "bg-red-500/10 border-2 border-red-500 text-red-500 hover:bg-red-500 hover:text-white" 
                : "bg-eburon-accent/10 border-2 border-eburon-accent text-eburon-accent hover:bg-eburon-accent hover:text-black"
            )}
          >
            {isConnected ? <Power size={24} /> : <Mic size={24} />}
            <span className="absolute -bottom-8 text-[10px] font-mono uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap text-gray-400">
              {isConnected ? 'Terminate' : 'Initialize'}
            </span>
          </button>
        </div>
      </footer>
    </div>
  );
}

export default App;
