import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Check, Play, Pause, X } from "lucide-react";

interface FocusIslandProps {
  activeFocusTask?: { taskId: string; subtaskId?: string; title: string } | null;
  rouletteTask?: { id: string; title: string } | null;
  onCompleteFocus: (taskId: string, subtaskId?: string) => void;
  onCompleteRoulette: (taskId: string) => void;
  onClearFocus: () => void;
  onClearRoulette: () => void;
}

export const FocusIsland: React.FC<FocusIslandProps> = ({
  activeFocusTask,
  rouletteTask,
  onCompleteFocus,
  onCompleteRoulette,
  onClearFocus,
  onClearRoulette,
}) => {
  const isFlow = !!activeFocusTask;
  const isRoulette = !!rouletteTask;
  const isVisible = isFlow || isRoulette;

  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (isVisible && isFlow) {
      // Reset timer when a new task starts
      setTimeLeft(25 * 60);
      setIsPaused(false);
    }
  }, [activeFocusTask?.taskId, activeFocusTask?.subtaskId, isVisible, isFlow]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isFlow && !isPaused && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            if (activeFocusTask) {
              onCompleteFocus(activeFocusTask.taskId, activeFocusTask.subtaskId);
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isFlow, isPaused, timeLeft, activeFocusTask, onCompleteFocus]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const title = isFlow ? activeFocusTask?.title : rouletteTask?.title;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 50, opacity: 0 }}
          className="fixed z-40 mx-4 left-0 right-0 p-3 flex items-center justify-between bg-gray-900/90 backdrop-blur-md border border-white/10 rounded-2xl shadow-2xl overflow-hidden bottom-20"
        >
          {/* Left Side: Tether */}
          <div className="flex items-center gap-3 overflow-hidden pr-2">
            <div className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse shrink-0 shadow-[0_0_8px_var(--color-primary)]" />
            <span className="truncate text-sm font-semibold text-white">
              {title}
            </span>
          </div>

          {/* Right Side: Quick Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {isFlow ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsPaused(!isPaused)}
                  className="flex items-center justify-center text-white/80 hover:text-white transition-colors"
                >
                  {isPaused ? <Play size={16} /> : <Pause size={16} />}
                </button>
                <div className="text-xs font-mono font-medium text-white tabular-nums px-2 py-1 bg-white/10 rounded-lg">
                  {formatTime(timeLeft)}
                </div>
                <button
                  onClick={() => {
                    if (activeFocusTask) {
                      onCompleteFocus(activeFocusTask.taskId, activeFocusTask.subtaskId);
                    }
                  }}
                  className="w-7 h-7 rounded-full bg-primary/20 text-primary flex items-center justify-center hover:bg-primary/40 transition-colors"
                >
                  <Check size={14} strokeWidth={3} />
                </button>
                <button
                  onClick={onClearFocus}
                  className="w-7 h-7 rounded-full bg-white/10 text-white/50 flex items-center justify-center hover:bg-white/20 transition-colors ml-1"
                >
                  <X size={14} />
                </button>
              </div>
            ) : isRoulette ? (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    if (rouletteTask) {
                      onCompleteRoulette(rouletteTask.id);
                    }
                  }}
                  className="w-8 h-8 rounded-full bg-primary text-background flex items-center justify-center hover:bg-primary/90 transition-colors shadow-lg"
                >
                  <Check size={16} strokeWidth={3} />
                </button>
                <button
                  onClick={onClearRoulette}
                  className="w-8 h-8 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            ) : null}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
