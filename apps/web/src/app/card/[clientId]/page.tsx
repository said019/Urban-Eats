"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { StampGrid } from "@/components/StampGrid";
import { RedeemModal } from "@/components/RedeemModal";
import { motion } from "framer-motion";

export default function CardPage() {
  const params = useParams();
  const clientId = params?.clientId as string;
  
  const [dbClientId, setDbClientId] = useState<string | null>(null);
  const [stamps, setStamps] = useState(0);
  const [clientName, setClientName] = useState("Cargando...");
  const [isLoading, setIsLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [redeemType, setRedeemType] = useState<'discount' | 'free' | null>(null);
  const [isRedeeming, setIsRedeeming] = useState(false);

  useEffect(() => {
    // URL Base para conexión nativa
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

    // Buscar al cliente por su URL slug (ej: sarah)
    fetch(`${API_BASE}/api/loyalty/clients/search/${clientId}`)
      .then(res => res.json())
      .then(data => {
        if (!data.error) {
          setDbClientId(data.id);
          setClientName(data.name);
          setStamps(data.stamps);
        } else {
          // Fallback para demo si postgres no está cargado
          setClientName(clientId as string);
          setStamps(5);
        }
      })
      .catch(() => {
        // Fallback visual si el servidor backend no responde
        setClientName(clientId as string);
        setStamps(5);
      })
      .finally(() => setIsLoading(false));
  }, [clientId]);

  // Background neon flares
  const backgroundFlares = (
    <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
      <div className="absolute top-[-10%] left-[-20%] w-[500px] h-[500px] bg-brand-orange/20 rounded-full blur-[100px]" />
      <div className="absolute bottom-[-10%] right-[-20%] w-[400px] h-[400px] bg-brand-yellow/15 rounded-full blur-[100px]" />
    </div>
  );

  const handleRedeemClick = (type: 'discount' | 'free') => {
    setRedeemType(type);
    setIsModalOpen(true);
  };

  const handleConfirmRedeem = async () => {
    setIsRedeeming(true);
    
    // URL Base para conexión nativa
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

    if (dbClientId) {
      try {
        const res = await fetch(`${API_BASE}/api/loyalty/clients/${dbClientId}/redeem`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: redeemType })
        });
        const data = await res.json();
        
        if (data.success) {
          setStamps(data.newStamps);
          alert(data.message);
        } else {
          alert('Error: ' + data.error);
        }
      } catch (err) {
        alert("Ocurrió un error conectando con el servidor de la tienda.");
      }
    } else {
      // Offline / Demo Mode fallback
      await new Promise(r => setTimeout(r, 1500));
      if (redeemType === 'free') setStamps(0);
      alert("¡Recompensa simulada exitosa! Ingresa a producción para base de datos real.");
    }
    
    setIsRedeeming(false);
    setIsModalOpen(false);
    setRedeemType(null);
  };

  return (
    <div className="min-h-screen relative flex flex-col items-center pt-12 px-6 pb-20 justify-between">
      {backgroundFlares}

      <div className="w-full max-w-sm mx-auto flex flex-col items-center">
        {/* Header / Logo */}
        <motion.div 
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="flex flex-col items-center gap-2 mb-8"
        >
          <img src="/logo.jpeg" alt="Urban Eats Logo" className="w-24 h-24 object-cover rounded-xl shadow-[0_0_20px_rgba(255,184,0,0.5)] border-2 border-brand-orange" />
        </motion.div>

        {/* Welcome Text */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-center mb-8"
        >
          <h2 className="text-xl font-medium text-white mb-1">Welcome, {clientName}</h2>
          <p className="text-brand-yellow font-medium text-sm tracking-widest neon-text">GOLD MEMBER</p>
        </motion.div>

        <motion.div
           initial={{ scale: 0.95, opacity: 0 }}
           animate={{ scale: 1, opacity: 1 }}
           transition={{ delay: 0.3 }}
           className="w-full flex justify-center mb-2"
        >
          <h3 className="text-zinc-400 font-bold tracking-widest text-xs">URBAN REWARDS</h3>
        </motion.div>
        
        <motion.div
           initial={{ scale: 0.95, opacity: 0 }}
           animate={{ scale: 1, opacity: 1 }}
           transition={{ delay: 0.4 }}
           className="w-full flex justify-center mb-6"
        >
           <h4 className="text-brand-orange font-black tracking-widest text-lg neon-text">DIGITAL STAMP CARD</h4>
        </motion.div>

        {/* Main Card */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4, type: "spring" }}
          className="w-full"
        >
          <StampGrid stamps={stamps} handleRedeem={handleRedeemClick} />
        </motion.div>

        <p className="mt-6 text-xs text-zinc-500 font-medium tracking-wide">
          TAP A GLOWING REWARD TO REDEEM IN-STORE!
        </p>
      </div>

      {/* Wallet Buttons */}
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="w-full max-w-sm mt-12 space-y-3"
      >
        <a 
          href={dbClientId ? `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/loyalty/clients/${dbClientId}/apple-wallet` : '#'}
          className={`w-full py-4 rounded-full border border-zinc-700 bg-black/40 backdrop-blur-md flex items-center justify-center gap-3 text-sm font-bold text-white transition-colors ${dbClientId ? 'hover:border-brand-orange cursor-pointer' : 'opacity-50 cursor-not-allowed'}`}
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.06.45-2.05.65-3.05-.28C2.5 15.65 3.51 7.23 8.35 6.94c1.3.06 2.36.78 3.08.78.71 0 2.05-.88 3.55-.74 2.13.11 3.54 1.1 4.3 2.65-3.6 2.1-2.99 6.7.74 8.23-.74 1.12-1.57 2.22-2.97 2.42m-4.57-13.8c-.3-2.03 1.34-3.8 3.25-4.1.34 2.1-1.5 3.86-3.25 4.1z" />
          </svg>
          Add to Apple Wallet
        </a>
        
        <button className="w-full py-4 rounded-full border border-zinc-700 bg-black/40 backdrop-blur-md flex items-center justify-center gap-3 text-sm font-bold text-white hover:border-brand-yellow transition-colors">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
             {/* Mock Google Wallet Icon */}
            <path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" stroke="currentColor" strokeWidth="2" />
            <path d="M2 10h20" stroke="currentColor" strokeWidth="2" />
            <path d="M15 15h2" stroke="#ffb800" strokeWidth="3" strokeLinecap="round" />
            <path d="M11 15h2" stroke="#ffb800" strokeWidth="3" strokeLinecap="round" />
            <path d="M7 15h2" stroke="#4285F4" strokeWidth="3" strokeLinecap="round" />
          </svg>
          Add to Google Wallet
        </button>
      </motion.div>

      <RedeemModal 
        isOpen={isModalOpen}
        onClose={() => !isRedeeming && setIsModalOpen(false)}
        onConfirm={handleConfirmRedeem}
        type={redeemType}
        loading={isRedeeming}
      />
    </div>
  );
}
