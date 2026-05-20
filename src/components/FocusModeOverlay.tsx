import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Pause, Play, Check, X } from 'lucide-react';

interface FocusModeOverlayProps {
  task: { taskId: string; subtaskId: string; title: string };
  onClose: () => void;
  onComplete: (taskId: string, subtaskId: string) => void;
}

export const FocusModeOverlay: React.FC<FocusModeOverlayProps> = ({ task, onClose, onComplete }) => {
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (!isPaused && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            onComplete(task.taskId, task.subtaskId);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPaused, timeLeft, task, onComplete]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-md flex flex-col items-center justify-center p-6 sm:p-12 animate-in fade-in duration-500">
      <motion.div 
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: 0.1, duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-2xl flex flex-col items-center justify-center space-y-12"
      >
        <div className="text-center space-y-2">
          <p className="text-primary font-medium tracking-[0.2em] uppercase text-xs sm:text-sm">Flow State</p>
          <h2 className="text-2xl sm:text-4xl font-light text-content">{task.title}</h2>
        </div>

        <div className="text-[5rem] sm:text-[8rem] font-mono font-extralight tracking-tighter text-content tabular-nums leading-none">
          {formatTime(timeLeft)}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 mt-12 w-full">
          <button
            onClick={() => setIsPaused(!isPaused)}
            className="flex items-center justify-center gap-2 px-6 py-3 rounded-full border border-outline hover:border-muted text-muted hover:text-content transition-colors w-40"
          >
            {isPaused ? <><Play size={18} /> Resume</> : <><Pause size={18} /> Pause</>}
          </button>
          
          <button
            onClick={() => onComplete(task.taskId, task.subtaskId)}
            className="flex items-center justify-center gap-2 px-8 py-3 rounded-full bg-primary text-background hover:bg-primary/90 transition-colors shadow-lg font-medium w-48"
          >
            <Check size={20} /> Mark Complete
          </button>
          
          <button
            onClick={onClose}
            className="flex items-center justify-center gap-2 px-6 py-3 rounded-full text-red-500 hover:bg-red-500/10 transition-colors w-40"
          >
            <X size={18} /> Abandon
          </button>
        </div>
      </motion.div>
    </div>
  );
};
