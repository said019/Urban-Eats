"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

export default function AdminSetupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ secret: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/auth/setup-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error en el servidor');

      setSuccess(`Admin ${data.action === 'created' ? 'creado' : 'actualizado'}. Redirigiendo al login...`);
      setTimeout(() => router.push('/admin/login'), 1500);
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
        <div className="flex flex-col items-center mb-6 gap-3">
          <img src="/logo.jpeg" alt="Urban Eats Logo" className="w-20 h-20 rounded-xl" />
          <h2 className="text-xl font-bold text-white text-center">
            Setup Admin
            <br />
            <span className="text-brand-orange neon-text text-sm tracking-widest uppercase">
              Crear / Resetear cuenta
            </span>
          </h2>
        </div>

        {error && (
          <div className="p-3 mb-4 bg-red-500/20 border border-red-500 text-red-100 text-sm rounded-lg text-center">
            {error}
          </div>
        )}
        {success && (
          <div className="p-3 mb-4 bg-green-500/20 border border-green-500 text-green-100 text-sm rounded-lg text-center">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-xs text-zinc-400 font-bold tracking-widest pl-2 mb-1 block">
              SECRET (ADMIN_SETUP_SECRET)
            </label>
            <input
              required
              type="password"
              placeholder="Tu frase secreta"
              className="w-full bg-zinc-900 border border-zinc-800 text-white p-4 rounded-xl focus:border-brand-orange focus:outline-none transition-colors"
              value={form.secret}
              onChange={(e) => setForm({ ...form, secret: e.target.value })}
            />
          </div>

          <div>
            <label className="text-xs text-zinc-400 font-bold tracking-widest pl-2 mb-1 block">
              EMAIL
            </label>
            <input
              required
              type="email"
              placeholder="said@urbaneats.com"
              className="w-full bg-zinc-900 border border-zinc-800 text-white p-4 rounded-xl focus:border-brand-orange focus:outline-none transition-colors"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>

          <div>
            <label className="text-xs text-zinc-400 font-bold tracking-widest pl-2 mb-1 block">
              PASSWORD (mín 6)
            </label>
            <input
              required
              minLength={6}
              type="password"
              placeholder="••••••••"
              className="w-full bg-zinc-900 border border-zinc-800 text-white p-4 rounded-xl focus:border-brand-orange focus:outline-none transition-colors"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>

          <button
            disabled={loading}
            type="submit"
            className="w-full mt-2 py-4 rounded-xl bg-brand-orange text-black font-black tracking-widest hover:bg-white hover:text-black transition-colors disabled:opacity-50"
          >
            {loading ? 'CREANDO...' : 'CREAR ADMIN'}
          </button>

          <p className="text-xs text-zinc-500 text-center mt-2">
            Necesitas la ENV var <code className="text-brand-orange">ADMIN_SETUP_SECRET</code> en Railway.
          </p>
        </form>
      </motion.div>
    </div>
  );
}
