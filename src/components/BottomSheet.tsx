import React from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({ isOpen, onClose, children }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            drag="y"
            dragConstraints={{ top: 0 }}
            dragElastic={0.2}
            onDragEnd={(_, info) => {
              if (info.offset.y > 100) {
                onClose();
              }
            }}
            className="fixed inset-x-0 bottom-0 z-50 flex flex-col bg-surface rounded-t-3xl shadow-2xl max-h-[90vh] overflow-hidden border-t border-outline"
          >
            <div className="w-full flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing shrink-0">
              <div className="w-12 h-1.5 bg-muted/40 rounded-full" />
            </div>
            <div className="flex-1 overflow-y-auto w-full px-4 pb-8 sm:px-6">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
