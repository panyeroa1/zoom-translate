
import React, { useEffect, useRef } from 'react';

interface AudioVisualizerProps {
  volume: number;
  isActive: boolean;
  width?: number;
  height?: number;
  barColor?: string;
  barCount?: number;
  className?: string;
}

const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ 
  volume, 
  isActive, 
  width = 300, 
  height = 60,
  barColor,
  barCount = 20,
  className
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const w = canvas.width;
      const h = canvas.height;
      const barWidth = w / barCount;
      
      // Dynamic color based on Eburon theme or prop
      ctx.fillStyle = barColor || (isActive ? '#00f0ff' : '#404040');

      for (let i = 0; i < barCount; i++) {
        // Base idle animation (always present if not active, or present but low if active & silent)
        const time = Date.now() / 200;
        
        // If Active:
        // 1. If talking (volume > 0.01): Show vigorous random bars
        // 2. If silent (volume ~ 0): Show gentle breathing sine wave to indicate "Alive/Listening"
        
        let barHeight = 2;

        if (isActive) {
            if (volume > 0.01) {
                // Talking
                const sensitivity = h < 50 ? 0.8 : 4;
                const volumeHeight = Math.random() * volume * h * sensitivity;
                barHeight = Math.max(4, volumeHeight);
            } else {
                // Listening / Idle Connected - Gentle "Breathing"
                // Phase shifted sine wave
                barHeight = Math.sin(time + i * 0.3) * (h * 0.15) + (h * 0.2); 
            }
        } else {
            // Disconnected / Idle
             barHeight = Math.sin(time + i * 0.5) * 5 + 5;
             ctx.fillStyle = '#404040'; // Force gray if disconnected
        }
        
        const x = i * barWidth;
        const y = (h - barHeight) / 2;

        ctx.fillRect(x + 1, y, barWidth - 2, barHeight);
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [volume, isActive, barCount, barColor, width, height]);

  return (
    <canvas 
      ref={canvasRef} 
      width={width} 
      height={height} 
      className={className}
      style={{ width: '100%', height: '100%' }}
    />
  );
};

export default AudioVisualizer;
