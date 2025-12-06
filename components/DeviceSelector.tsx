
import React, { useState, useRef, useEffect } from 'react';
import { AudioDevice } from '../types';
import { Mic, Laptop, Video, Globe, Layers, ChevronDown, Check } from 'lucide-react';
import clsx from 'clsx';

interface DeviceSelectorProps {
  devices: AudioDevice[];
  selectedDevice?: AudioDevice;
  onSelect: (device: AudioDevice) => void;
}

const DeviceSelector: React.FC<DeviceSelectorProps> = ({ devices, selectedDevice, onSelect }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const getIcon = (type: string) => {
    switch (type) {
      case 'zoom': return <Video size={14} className="text-blue-400" />;
      case 'tab': return <Globe size={14} className="text-purple-400" />;
      case 'window': return <Layers size={14} className="text-pink-400" />;
      case 'system': return <Laptop size={14} className="text-orange-400" />;
      default: return <Mic size={14} className="text-eburon-accent" />;
    }
  };

  const getLabelColor = (type?: string) => {
     switch (type) {
      case 'zoom': return "text-blue-100 group-hover:text-blue-50";
      case 'tab': return "text-purple-100 group-hover:text-purple-50";
      case 'window': return "text-pink-100 group-hover:text-pink-50";
      case 'system': return "text-orange-100 group-hover:text-orange-50";
      default: return "text-gray-200 group-hover:text-white";
    }
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-3 bg-black/40 border border-gray-700 hover:border-gray-500 rounded-lg px-4 py-3 transition-colors text-left"
      >
        <div className="flex items-center gap-3 overflow-hidden">
          {selectedDevice ? getIcon(selectedDevice.type) : <Mic size={14} />}
          <div className="flex flex-col truncate">
            <span className="text-xs text-gray-500 font-mono uppercase tracking-wider">Audio Source</span>
            <span className={clsx("text-sm font-medium truncate", getLabelColor(selectedDevice?.type))}>
              {selectedDevice?.label || "Select Device"}
            </span>
          </div>
        </div>
        <ChevronDown size={16} className={clsx("text-gray-500 transition-transform", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-eburon-900 border border-eburon-700 rounded-lg shadow-xl overflow-hidden z-50 max-h-64 overflow-y-auto">
          {devices.map((device) => {
            const isSelected = selectedDevice?.deviceId === device.deviceId;
            return (
              <button
                key={device.deviceId}
                onClick={() => {
                  onSelect(device);
                  setIsOpen(false);
                }}
                className={clsx(
                  "w-full flex items-center gap-3 px-4 py-3 hover:bg-eburon-800 transition-colors text-left group border-b border-gray-800 last:border-0",
                  isSelected && "bg-eburon-800"
                )}
              >
                <div className={clsx(
                    "w-8 h-8 rounded flex items-center justify-center shrink-0",
                    isSelected ? "bg-white/10" : "bg-black/20"
                )}>
                    {getIcon(device.type)}
                </div>
                <div className="flex-1 truncate">
                    <div className={clsx("text-sm font-medium", getLabelColor(device.type))}>
                        {device.label}
                    </div>
                    <div className="text-[10px] text-gray-500 font-mono uppercase">
                        {device.type === 'system' ? 'Device Internal' : device.type}
                    </div>
                </div>
                {isSelected && <Check size={14} className="text-eburon-accent" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DeviceSelector;
