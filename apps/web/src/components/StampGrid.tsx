"use client";

import { motion } from "framer-motion";

const TOTAL_STAMPS = 6;

export const StampGrid = ({ stamps, handleRedeem }: { stamps: number; handleRedeem: (type: 'discount' | 'free') => void }) => {
  const claimable = stamps >= TOTAL_STAMPS;
  const filled = Math.min(stamps, TOTAL_STAMPS);

  return (
    <div className="glass-panel p-6 rounded-3xl w-full max-w-sm mx-auto relative z-10 border border-pink-400/20 bg-gradient-to-br from-pink-900/40 to-rose-950/60">
      <div className="grid grid-cols-3 gap-4 mb-4">
        {Array.from({ length: TOTAL_STAMPS }).map((_, index) => {
          const num = index + 1;
          const isActive = num <= filled;
          return (
            <motion.div
              key={num}
              initial={false}
              animate={{
                scale: isActive ? 1.05 : 1,
                borderColor: isActive ? 'rgba(244, 63, 94, 0.6)' : 'rgba(251, 207, 232, 0.18)',
              }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className={`aspect-square rounded-full border-2 flex items-center justify-center relative overflow-hidden ${
                isActive
                  ? 'bg-gradient-to-br from-pink-500 to-rose-600 shadow-[0_0_20px_rgba(244,63,94,0.45)]'
                  : 'bg-pink-950/40 border-dashed'
              }`}
            >
              {isActive ? (
                <RamenBowl />
              ) : (
                <span className="text-pink-200/40 font-bold text-xl">{num}</span>
              )}
              {isActive && (
                <span className="absolute bottom-[-4px] right-[-4px] w-5 h-5 bg-rose-50 text-pink-700 rounded-full flex items-center justify-center text-[10px] font-black shadow-md">
                  ✓
                </span>
              )}
            </motion.div>
          );
        })}
      </div>

      <div className="w-full bg-pink-950/60 rounded-full h-1.5 mt-6 relative overflow-hidden">
        <motion.div
          className="bg-gradient-to-r from-pink-400 via-rose-400 to-pink-300 h-1.5 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${(filled / TOTAL_STAMPS) * 100}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>

      <p className="text-center text-xs font-bold mt-4 tracking-widest text-pink-200/70">
        <span className="text-rose-300 mr-1">
          {filled} of {TOTAL_STAMPS}
        </span>
        RAMENS · {claimable ? '¡PREMIO LISTO!' : `${TOTAL_STAMPS - filled} para tu ramen gratis`}
      </p>

      {claimable && (
        <motion.button
          initial={{ y: 8, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          onClick={() => handleRedeem('free')}
          className="w-full mt-4 py-3 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 text-white font-black tracking-widest text-sm hover:from-pink-400 hover:to-rose-400 shadow-[0_0_20px_rgba(244,63,94,0.55)]"
        >
          🍜 CANJEAR RAMEN GRATIS
        </motion.button>
      )}
    </div>
  );
};

function RamenBowl() {
  return (
    <svg viewBox="0 0 64 64" className="w-[70%] h-[70%]" aria-hidden>
      <path d="M14 35 H50 A18 14 0 0 1 14 35 Z" fill="#FFFFFF" />
      <path d="M16 41 A20 14 0 0 0 48 41" stroke="rgba(131,24,67,0.4)" strokeWidth="2" fill="none" />
      <path d="M18 33 q4 -6 8 0 q4 6 8 0 q4 -6 8 0 q4 6 8 0" stroke="rgba(131,24,67,0.65)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <line x1="40" y1="22" x2="56" y2="12" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" />
      <line x1="44" y1="26" x2="58" y2="16" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M22 15 q-4 -8 0 -12" stroke="#FFFFFF" strokeWidth="1.8" fill="none" strokeLinecap="round" opacity="0.7" />
      <path d="M32 13 q-4 -8 0 -12" stroke="#FFFFFF" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <path d="M42 15 q-4 -8 0 -12" stroke="#FFFFFF" strokeWidth="1.8" fill="none" strokeLinecap="round" opacity="0.7" />
    </svg>
  );
}
