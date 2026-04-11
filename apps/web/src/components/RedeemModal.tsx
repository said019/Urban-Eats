"use client";

import { motion, AnimatePresence } from "framer-motion";

interface RedeemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  type: 'discount' | 'free' | null;
  loading: boolean;
}

export const RedeemModal = ({ isOpen, onClose, onConfirm, type, loading }: RedeemModalProps) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-panel p-8 rounded-[2rem] w-full max-w-sm relative z-50 border border-brand-orange/40 shadow-[0_10px_50px_rgba(255,94,0,0.15)] flex flex-col items-center text-center overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-yellow via-brand-orange to-brand-yellow" />
              
              <h2 className="text-2xl font-bold mb-6 text-white tracking-wide">
                Congratulations!
              </h2>

              <div className="relative w-32 h-32 mb-6 flex items-center justify-center rounded-full border border-brand-yellow/30 bg-brand-yellow/5">
                <div className="absolute inset-0 rounded-full border border-brand-yellow neon-glow animate-[spin_4s_linear_infinite]" style={{ borderTopColor: 'transparent', borderRightColor: 'transparent' }} />
                <div className="absolute inset-2 rounded-full border border-brand-orange neon-glow animate-[spin_3s_linear_infinite_reverse]" style={{ borderBottomColor: 'transparent', borderLeftColor: 'transparent' }} />
                
                {type === 'discount' ? (
                  <div className="flex items-center justify-center flex-col z-10">
                    <span className="text-3xl font-black text-brand-orange neon-text">25%</span>
                    <span className="text-sm font-bold text-brand-yellow neon-text">OFF</span>
                  </div>
                ) : (
                  <img src="/logo.jpeg" alt="Urban Eats Premio" className="w-[80%] h-[80%] object-cover rounded-full shadow-[0_0_20px_var(--glow-orange)] z-10" />
                )}
              </div>

              <div className="mb-8 space-y-2">
                <p className="font-bold text-brand-orange">You have unlocked your reward.</p>
                <p className="text-sm text-zinc-400">Show this screen to the cashier to redeem. Do not press the button yourself.</p>
              </div>

              <div className="flex flex-col w-full gap-3">
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={onConfirm}
                  disabled={loading}
                  className="w-full py-4 rounded-full bg-transparent border-2 border-brand-orange text-brand-yellow font-bold text-lg tracking-wider neon-glow hover:bg-brand-orange/10 transition-colors relative overflow-hidden group disabled:opacity-50"
                >
                  <span className="relative z-10">{loading ? 'Processing...' : 'Redeem Now'}</span>
                  <div className="absolute inset-0 h-full w-full bg-gradient-to-r from-transparent via-brand-orange/20 to-transparent -translate-x-[100%] group-hover:animate-[shimmer_1.5s_infinite]" />
                </motion.button>

                <button
                  onClick={onClose}
                  disabled={loading}
                  className="w-full py-3 rounded-full text-zinc-400 hover:text-white font-medium text-sm transition-colors"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
