"use client";

import { motion } from "framer-motion";

export const StampGrid = ({ stamps, handleRedeem }: { stamps: number, handleRedeem: (type: 'discount' | 'free') => void }) => {
  const totalStamps = 10;
  
  return (
    <div className="glass-panel p-6 rounded-3xl w-full max-w-sm mx-auto relative z-10 border border-zinc-700/50">
      <div className="grid grid-cols-3 gap-5 mb-4">
        {[...Array(totalStamps)].map((_, index) => {
          const num = index + 1;
          const isActive = num <= stamps;
          const isDiscount = num === 5;
          const isFree = num === 10;
          
          let content = null;
          if (isActive && !isDiscount && !isFree) {
            content = <img src="/logo.jpeg" alt="Sello de Urban Eats" className="w-[80%] h-[80%] object-cover rounded-full shadow-[0_0_15px_rgba(255,184,0,0.5)]" />;
          } else if (isDiscount) {
            content = isActive ? (
              <motion.div 
                whileTap={{ scale: 0.95 }}
                className="flex flex-col items-center justify-center font-bold text-center cursor-pointer text-brand-orange neon-text text-sm leading-tight relative"
                onClick={() => handleRedeem('discount')}
              >
                <span className="text-xl">25%</span>
                <span className="text-[10px]">NEXT</span>
                <span className="text-[10px]">ORDER!</span>
              </motion.div>
            ) : (
              <span className="text-brand-orange/40 font-bold text-sm text-center leading-tight">25%<br/>OFF</span>
            );
          } else if (isFree) {
            content = isActive ? (
              <motion.div 
                whileTap={{ scale: 0.95 }}
                className="flex flex-col items-center justify-center cursor-pointer relative"
                onClick={() => handleRedeem('free')}
              >
                <div className="absolute inset-0 bg-brand-yellow/20 rounded-full blur-md" />
                <span className="font-black text-brand-yellow neon-text text-[11px] leading-tight text-center z-10">FREE<br/>MINI DOG!</span>
              </motion.div>
            ) : (
              <span className="text-brand-yellow/40 font-bold text-[11px] text-center leading-tight">FREE<br/>MINI</span>
            );
          } else {
             content = <span className="text-zinc-600 font-medium text-xl">{num}</span>;
          }

          return (
            <motion.div
              key={num}
              initial={false}
              animate={{ 
                scale: isActive ? 1.05 : 1,
                borderColor: isActive ? 'rgba(255, 184, 0, 0.4)' : 'rgba(255, 255, 255, 0.1)'
              }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className={`
                aspect-square rounded-full border-2 flex items-center justify-center relative
                ${isActive && !isDiscount && !isFree ? 'border-brand-orange neon-glow inner-glow' : ''}
                ${isDiscount ? `${isActive ? 'border-brand-orange shadow-[0_0_20px_rgba(255,94,0,0.6)]' : 'border-brand-orange/30'} border-dashed` : ''}
                ${isFree ? `${isActive ? 'border-brand-yellow shadow-[0_0_25px_rgba(255,184,0,0.8)] outline-dotted outline-brand-yellow/50' : 'border-brand-yellow/30'} border-double` : ''}
              `}
            >
              {isActive && (
                <motion.svg 
                  className="absolute bottom-[-5px] right-[-5px] w-5 h-5 text-brand-yellow bg-zinc-900 rounded-full" 
                  viewBox="0 0 24 24" 
                  fill="currentColor"
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2 }}
                >
                  <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z" />
                </motion.svg>
              )}
              {content}
            </motion.div>
          );
        })}
      </div>
      <div className="w-full bg-zinc-800 rounded-full h-1.5 mt-6 relative overflow-hidden">
        <motion.div 
          className="bg-gradient-to-r from-brand-orange to-brand-yellow h-1.5 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${(stamps / totalStamps) * 100}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>
      <p className="text-center text-xs font-bold mt-4 tracking-widest text-zinc-400">
        <span className="text-brand-yellow neon-text mr-1">{stamps} of {totalStamps}</span> STAMPS COLLECTED
      </p>
    </div>
  );
};
