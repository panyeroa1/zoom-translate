import React from 'react';
import { TranscriptItem } from '../types';
import clsx from 'clsx';
import { Bot, User } from 'lucide-react';

interface ChatMessageProps {
  message: TranscriptItem;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isEburon = message.speaker === 'eburon';
  
  return (
    <div className={clsx(
      "flex gap-4 p-4 rounded-lg mb-2 border",
      isEburon 
        ? "bg-eburon-800 border-eburon-700 text-eburon-accent" 
        : "bg-eburon-900 border-eburon-800 text-gray-300"
    )}>
      <div className={clsx(
        "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
        isEburon ? "bg-eburon-accent/20" : "bg-gray-700/20"
      )}>
        {isEburon ? <Bot size={18} /> : <User size={18} />}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-bold uppercase tracking-wider opacity-70">
            {isEburon ? 'Eburon System' : 'Operator'}
          </span>
          <span className="text-xs opacity-40">
            {message.timestamp.toLocaleTimeString()}
          </span>
        </div>
        <p className="font-mono text-sm leading-relaxed">
          {message.text}
        </p>
      </div>
    </div>
  );
};

export default ChatMessage;
