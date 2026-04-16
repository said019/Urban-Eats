"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";

export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const referralId = searchParams?.get('ref') || '';
  const [formData, setFormData] = useState({ name: '', phone: '', country_code: '+52', birthday: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'register' | 'lookup'>('register');

  useEffect(() => {
    if (typeof window !== 'undefined' && !referralId) {
      const savedId = localStorage.getItem('urban_eats_client_id');
      if (savedId) {
        router.replace(`/card/${savedId}`);
      }
    }
  }, [router, referralId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (mode === 'lookup') {
        const res = await fetch(`/api/loyalty/lookup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: formData.phone, country_code: formData.country_code })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'No encontramos tu tarjeta');
        if (data.clientId) {
          localStorage.setItem('urban_eats_client_id', data.clientId);
          router.push(`/card/${data.clientId}`);
        }
        return;
      }

      const res = await fetch(`/api/admin/clients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, referred_by: referralId || undefined })
      });

      const data = await res.json();
      if (!res.ok && res.status !== 409) throw new Error(data.error || 'Error en el servidor');

      if (data.clientId) {
        localStorage.setItem('urban_eats_client_id', data.clientId);
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
        <div className="flex flex-col items-center mb-6 gap-3">
          <img src="/logo.jpeg" alt="Urban Eats Logo" className="w-20 h-20 rounded-xl" />
          <h2 className="text-xl font-bold text-white text-center">
            {mode === 'register' ? 'Únete a Urban Eats' : 'Recupera tu tarjeta'}
            <br/>
            <span className="text-brand-orange neon-text text-sm tracking-widest uppercase">
              {mode === 'register' ? 'Rewards Club' : 'Ingresa tu WhatsApp'}
            </span>
          </h2>
        </div>

        {referralId && mode === 'register' && (
          <div className="mb-4 p-3 rounded-xl bg-brand-orange/10 border border-brand-orange/50 text-center">
            <p className="text-brand-orange text-xs font-black tracking-widest">¡VIENES INVITADO! 🎉</p>
            <p className="text-white text-xs mt-1">Ganas +1 sello de regalo al registrarte</p>
          </div>
        )}

        <div className="flex mb-6 rounded-xl bg-zinc-900 p-1 border border-zinc-800">
          <button
            type="button"
            onClick={() => { setMode('register'); setError(''); }}
            className={`flex-1 py-2 rounded-lg text-xs font-bold tracking-widest transition-colors ${mode === 'register' ? 'bg-brand-orange text-black' : 'text-zinc-400'}`}
          >
            REGISTRARME
          </button>
          <button
            type="button"
            onClick={() => { setMode('lookup'); setError(''); }}
            className={`flex-1 py-2 rounded-lg text-xs font-bold tracking-widest transition-colors ${mode === 'lookup' ? 'bg-brand-orange text-black' : 'text-zinc-400'}`}
          >
            YA TENGO TARJETA
          </button>
        </div>

        {error && <div className="p-3 mb-6 bg-red-500/20 border border-red-500 text-red-100 text-sm rounded-lg text-center">{error}</div>}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {mode === 'register' && (
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
          )}

          <div className="flex gap-2">
            <div className="w-1/3">
              <label className="text-xs text-zinc-400 font-bold tracking-widest pl-2 mb-1 block">PAÍS</label>
              <select 
                className="w-full bg-zinc-900 border border-zinc-800 text-white p-4 rounded-xl focus:border-brand-orange focus:outline-none appearance-none cursor-pointer"
                value={formData.country_code}
                onChange={(e) => setFormData({ ...formData, country_code: e.target.value })}
              >
                <option value="+52">🇲🇽 +52</option>
                <option value="+57">🇨🇴 +57</option>
                <option value="+54">🇦🇷 +54</option>
                <option value="+56">🇨🇱 +56</option>
                <option value="+51">🇵🇪 +51</option>
                <option value="+593">🇪🇨 +593</option>
                <option value="+58">🇻🇪 +58</option>
                <option value="+591">🇧🇴 +591</option>
                <option value="+595">🇵🇾 +595</option>
                <option value="+598">🇺🇾 +598</option>
                <option value="+506">🇨🇷 +506</option>
                <option value="+507">🇵🇦 +507</option>
                <option value="+502">🇬🇹 +502</option>
                <option value="+503">🇸🇻 +503</option>
                <option value="+504">🇭🇳 +504</option>
                <option value="+505">🇳🇮 +505</option>
                <option value="+53">🇨🇺 +53</option>
                <option value="+1809">🇩🇴 +1809</option>
                <option value="+1">🇺🇸 +1</option>
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

          {mode === 'register' && (
            <div>
              <label className="text-xs text-zinc-400 font-bold tracking-widest pl-2 mb-1 block">
                CUMPLEAÑOS (opcional · recibes premio en tu día 🎂)
              </label>
              <input
                type="date"
                max={new Date().toISOString().split('T')[0]}
                className="w-full bg-zinc-900 border border-zinc-800 text-white p-4 rounded-xl focus:border-brand-orange focus:outline-none transition-colors"
                value={formData.birthday}
                onChange={(e) => setFormData({ ...formData, birthday: e.target.value })}
              />
            </div>
          )}

          <button
            disabled={loading}
            type="submit"
            className="w-full mt-4 py-4 rounded-xl bg-brand-orange text-black font-black tracking-widest hover:bg-white hover:text-black transition-colors disabled:opacity-50"
          >
            {loading
              ? (mode === 'register' ? 'CREANDO PASAPORTE...' : 'BUSCANDO...')
              : (mode === 'register' ? 'OBTENER TARJETA DIGITAL' : 'ENTRAR A MI TARJETA')}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
