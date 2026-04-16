"use client";

import { useState } from "react";
import { Megaphone, Send, Users, Moon, Zap } from "lucide-react";

export default function BroadcastPage() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [segment, setSegment] = useState<'all' | 'active' | 'dormant'>('all');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<any>(null);

  const presets = [
    { title: 'Urban Eats 🌭', body: '¡Martes 2x1 en todos nuestros hot dogs! Solo hoy.' },
    { title: 'Urban Eats 🔥', body: 'Happy Hour 3pm-5pm: doble sello en cada compra.' },
    { title: 'Urban Eats ✨', body: 'Nuevo en el menú: ¡prueba el perro de la casa!' },
    { title: 'Urban Eats 💛', body: '¡Te extrañamos! Ven esta semana y llévate un sello bonus.' },
  ];

  const send = async () => {
    if (!title || !body) return alert('Completa título y mensaje');
    if (!confirm(`¿Enviar a todos los ${segment === 'dormant' ? 'clientes dormidos' : segment === 'active' ? 'clientes activos' : 'clientes'}?`)) return;

    setSending(true);
    setResult(null);
    const token = localStorage.getItem('admin_token');
    try {
      const res = await fetch('/api/admin/broadcast', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, body, segment }),
      });
      const data = await res.json();
      setResult(data);
      if (data.success) {
        setTitle('');
        setBody('');
      }
    } catch {
      alert('Error de red');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6 relative z-10">
      <div>
        <h1 className="text-3xl font-black tracking-widest uppercase flex items-center gap-3">
          <Megaphone className="w-8 h-8 text-brand-orange" /> Push Masivo
        </h1>
        <p className="text-zinc-500 font-medium tracking-wide text-sm mt-1">
          Envía notificaciones a los wallets de tus clientes.
        </p>
      </div>

      <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-6 space-y-4">
        <div>
          <label className="text-xs text-zinc-400 font-bold tracking-widest mb-2 block">
            SEGMENTO
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => setSegment('all')}
              className={`flex flex-col items-center gap-1 p-3 rounded-xl border transition-colors ${segment === 'all' ? 'bg-brand-orange/10 border-brand-orange text-brand-orange' : 'border-zinc-800 text-zinc-500 hover:text-white'}`}
            >
              <Users className="w-5 h-5" />
              <span className="text-xs font-bold tracking-widest">TODOS</span>
            </button>
            <button
              onClick={() => setSegment('active')}
              className={`flex flex-col items-center gap-1 p-3 rounded-xl border transition-colors ${segment === 'active' ? 'bg-brand-yellow/10 border-brand-yellow text-brand-yellow' : 'border-zinc-800 text-zinc-500 hover:text-white'}`}
            >
              <Zap className="w-5 h-5" />
              <span className="text-xs font-bold tracking-widest">ACTIVOS</span>
            </button>
            <button
              onClick={() => setSegment('dormant')}
              className={`flex flex-col items-center gap-1 p-3 rounded-xl border transition-colors ${segment === 'dormant' ? 'bg-red-500/10 border-red-500 text-red-400' : 'border-zinc-800 text-zinc-500 hover:text-white'}`}
            >
              <Moon className="w-5 h-5" />
              <span className="text-xs font-bold tracking-widest">DORMIDOS</span>
            </button>
          </div>
          <p className="text-xs text-zinc-500 mt-2">
            {segment === 'all' && 'Todos los clientes con pase en wallet.'}
            {segment === 'active' && 'Clientes con visita en los últimos 30 días.'}
            {segment === 'dormant' && 'Clientes sin visita hace 30+ días (reactivación).'}
          </p>
        </div>

        <div>
          <label className="text-xs text-zinc-400 font-bold tracking-widest mb-1 block">TÍTULO</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={60}
            placeholder="Urban Eats 🌭"
            className="w-full bg-zinc-950 border border-zinc-800 text-white p-3 rounded-xl focus:border-brand-orange focus:outline-none"
          />
        </div>

        <div>
          <label className="text-xs text-zinc-400 font-bold tracking-widest mb-1 block">MENSAJE</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={200}
            rows={3}
            placeholder="¡Martes 2x1 solo hoy!"
            className="w-full bg-zinc-950 border border-zinc-800 text-white p-3 rounded-xl focus:border-brand-orange focus:outline-none resize-none"
          />
          <p className="text-xs text-zinc-500 mt-1">{body.length}/200</p>
        </div>

        <div>
          <label className="text-xs text-zinc-400 font-bold tracking-widest mb-2 block">
            PLANTILLAS RÁPIDAS
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {presets.map((p, i) => (
              <button
                key={i}
                onClick={() => { setTitle(p.title); setBody(p.body); }}
                className="text-left p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-300 text-xs hover:border-brand-orange transition-colors"
              >
                <p className="font-bold text-white">{p.title}</p>
                <p className="mt-1 text-zinc-400">{p.body}</p>
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={send}
          disabled={sending || !title || !body}
          className="w-full flex items-center justify-center gap-2 bg-brand-orange text-black py-4 rounded-xl font-black tracking-widest hover:bg-white transition-colors disabled:opacity-50"
        >
          <Send className="w-5 h-5" /> {sending ? 'ENVIANDO...' : 'ENVIAR PUSH'}
        </button>

        {result && (
          <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-950 text-sm">
            {result.success ? (
              <div>
                <p className="text-green-400 font-bold mb-2">✓ Push enviado</p>
                <p className="text-zinc-300">Dispositivos objetivo: {result.totalDevices}</p>
                <p className="text-zinc-300">Enviados con éxito: {result.sent}</p>
                {result.pruned > 0 && <p className="text-zinc-500">Tokens inválidos eliminados: {result.pruned}</p>}
              </div>
            ) : (
              <p className="text-red-400">Error: {result.error}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
