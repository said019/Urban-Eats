"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

function safeNextPath(value: string | null): string {
  if (!value || !value.startsWith('/admin')) return '/admin';
  if (value.startsWith('/admin/login') || value.startsWith('/admin/setup')) return '/admin';
  return value;
}

export default function AdminLoginPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (!token) return;

    const next = new URLSearchParams(window.location.search).get('next');
    router.replace(safeNextPath(next));
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Autenticación fallida');
      
      // Guardar JWT
      localStorage.setItem('admin_token', data.token);
      const next = new URLSearchParams(window.location.search).get('next');
      router.push(safeNextPath(next));

    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Autenticación fallida');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-96 h-96 bg-brand-yellow/10 blur-[150px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-brand-orange/10 blur-[150px] pointer-events-none" />

      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }} 
        animate={{ scale: 1, opacity: 1 }} 
        className="w-full max-w-sm z-10"
      >
        <div className="text-center mb-10">
          <h1 className="text-3xl font-black text-white tracking-widest leading-tight">CAJA<br/><span className="text-brand-orange neon-text">URBAN EATS</span></h1>
          <p className="text-zinc-500 mt-2 text-sm font-medium tracking-wide">INGRESA CON TUS CREDENCIALES</p>
        </div>

        {error && <div className="p-4 mb-6 bg-red-500/10 border border-red-500 text-red-400 text-sm rounded-lg text-center font-bold tracking-wide">{error}</div>}

        <form onSubmit={handleLogin} className="flex flex-col gap-5">
          <div>
            <label className="text-xs text-zinc-500 font-bold tracking-widest mb-2 block">CORREO DEL LOCAL</label>
            <input 
              required
              type="email" 
              placeholder="admin@urbaneats.com"
              className="w-full bg-zinc-900 border border-zinc-800 text-white p-4 rounded-xl focus:border-brand-yellow focus:outline-none transition-colors"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>

          <div>
             <label className="text-xs text-zinc-500 font-bold tracking-widest mb-2 block">CONTRASEÑA SEGURA</label>
             <input 
              required
              type="password" 
              placeholder="••••••••"
              className="w-full bg-zinc-900 border border-zinc-800 text-white p-4 rounded-xl focus:border-brand-yellow focus:outline-none transition-colors"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            />
          </div>

          <button 
            disabled={loading}
            type="submit" 
            className="w-full mt-6 py-4 rounded-xl bg-brand-yellow text-black font-black tracking-widest hover:bg-white transition-colors disabled:opacity-50"
          >
            {loading ? 'AUTENTICANDO...' : 'INICIAR TURNO'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
