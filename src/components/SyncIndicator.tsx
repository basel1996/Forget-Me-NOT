import React, { useEffect, useState } from 'react';
import { CloudOff, RefreshCw, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SyncIndicatorProps {
  status: 'synced' | 'syncing' | 'offline_saved';
}

export const SyncIndicator: React.FC<SyncIndicatorProps> = ({ status }) => {
  const [showSynced, setShowSynced] = useState(false);

  useEffect(() => {
    if (status === 'synced') {
      setShowSynced(true);
      const timer = setTimeout(() => {
        setShowSynced(false);
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [status]);

  if (status === 'synced' && !showSynced) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="fixed top-4 right-4 z-50 flex items-center justify-center text-xs px-2 py-1 rounded-full bg-gray-800/50 backdrop-blur-sm border border-white/5"
      >
        {status === 'offline_saved' && (
          <div className="flex items-center gap-1.5 text-gray-400">
            <CloudOff size={12} />
            <span>Saved locally</span>
          </div>
        )}
        {status === 'syncing' && (
          <div className="flex items-center gap-1.5 text-primary">
            <RefreshCw size={12} className="animate-spin" />
            <span>Syncing...</span>
          </div>
        )}
        {status === 'synced' && showSynced && (
          <div className="flex items-center gap-1.5 text-green-400">
            <CheckCircle2 size={12} />
            <span>Synced</span>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};
