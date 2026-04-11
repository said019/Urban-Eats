"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({ name: '', phone: '', country_code: '+57' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

    try {
      const res = await fetch(`${API_BASE}/api/admin/clients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error en el servidor');
      
      // Redirigir al cliente recién creado a su billetera.
      // API devuelve: { success: true, clientId: 'UUID' }
      if (data.clientId) {
        router.push(`/card/${data.clientId}`);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex flex-col items-center justify-center p-6 pb-20">
      <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-[-10%] left-[-20%] w-[500px] h-[500px] bg-brand-orange/20 rounded-full blur-[100px]" />
      </div>

      <motion.div 
        initial={{ y: 20, opacity: 0 }} 
        animate={{ y: 0, opacity: 1 }} 
        className="w-full max-w-sm bg-black/40 backdrop-blur-md p-8 rounded-2xl border border-zinc-800 shadow-2xl"
      >
        <div className="flex flex-col items-center mb-8 gap-3">
          <img src="/logo.jpeg" alt="Urban Eats Logo" className="w-20 h-20 rounded-xl" />
          <h2 className="text-xl font-bold text-white text-center">Únete a Urban Eats<br/><span className="text-brand-orange neon-text text-sm tracking-widest uppercase">Rewards Club</span></h2>
        </div>

        {error && <div className="p-3 mb-6 bg-red-500/20 border border-red-500 text-red-100 text-sm rounded-lg text-center">{error}</div>}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-xs text-zinc-400 font-bold tracking-widest pl-2 mb-1 block">TU NOMBRE</label>
            <input 
              required
              type="text" 
              placeholder="Ej. Sarah Juarez"
              className="w-full bg-zinc-900 border border-zinc-800 text-white p-4 rounded-xl focus:border-brand-orange focus:outline-none transition-colors"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div className="flex gap-2">
            <div className="w-1/3">
              <label className="text-xs text-zinc-400 font-bold tracking-widest pl-2 mb-1 block">PAÍS</label>
              <select 
                className="w-full bg-zinc-900 border border-zinc-800 text-white p-4 rounded-xl focus:border-brand-orange focus:outline-none appearance-none cursor-pointer"
                value={formData.country_code}
                onChange={(e) => setFormData({ ...formData, country_code: e.target.value })}
              >
                <option value="+57">🇨🇴 +57</option>
                <option value="+52">🇲🇽 +52</option>
                <option value="+54">🇦🇷 +54</option>
              </select>
            </div>
            <div className="w-2/3">
              <label className="text-xs text-zinc-400 font-bold tracking-widest pl-2 mb-1 block">WHATSAPP</label>
              <input 
                required
                type="tel" 
                placeholder="300 123 4567"
                className="w-full bg-zinc-900 border border-zinc-800 text-white p-4 rounded-xl focus:border-brand-orange focus:outline-none transition-colors"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
          </div>

          <button 
            disabled={loading}
            type="submit" 
            className="w-full mt-4 py-4 rounded-xl bg-brand-orange text-black font-black tracking-widest hover:bg-white hover:text-black transition-colors disabled:opacity-50"
          >
            {loading ? 'CREANDO PASAPORTE...' : 'OBTENER TARJETA DIGITAL'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
