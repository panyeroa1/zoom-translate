
import React, { useEffect, useRef } from 'react';

interface AudioVisualizerProps {
  volume: number;
  isActive: boolean;
}

const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ volume, isActive }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let bars = 20;
    const draw = () => {
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const width = canvas.width;
      const height = canvas.height;
      const barWidth = width / bars;
      
      // Dynamic color based on Eburon theme
      ctx.fillStyle = isActive ? '#00f0ff' : '#404040';

      for (let i = 0; i < bars; i++) {
        // Base height plus variable volume height
        // Sine wave effect for idle state
        const time = Date.now() / 200;
        const idleHeight = isActive ? 0 : Math.sin(time + i * 0.5) * 5 + 5;
        
        // Volume reaction
        const volumeHeight = isActive ? Math.random() * volume * height * 4 : 0;
        
        const barHeight = Math.max(2, idleHeight + volumeHeight);
        const x = i * barWidth;
        const y = (height - barHeight) / 2;

        ctx.fillRect(x + 1, y, barWidth - 2, barHeight);
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [volume, isActive]);

  return (
    <canvas 
      ref={canvasRef} 
      width={300} 
      height={60} 
      className="w-full max-w-[300px] h-[60px]" 
    />
  );
};

export default AudioVisualizer;
