"use client";

import { useEffect, useState } from "react";
import { Cake, Send } from "lucide-react";

type Client = {
  id: string;
  name: string;
  country_code: string;
  phone: string;
  birthday: string;
  stamps: number;
};

export default function BirthdaysPage() {
  const [when, setWhen] = useState<'today' | 'week' | 'month'>('today');
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const token = () => (typeof window !== 'undefined' ? localStorage.getItem('admin_token') : '');

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/birthdays?when=${when}`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (res.ok) setClients(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [when]);

  const sendPush = async () => {
    if (!confirm(`Enviar push "¡Feliz cumpleaños!" a los que cumplen HOY?`)) return;
    setSending(true);
    try {
      const res = await fetch('/api/admin/birthdays', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}` },
      });
      const data = await res.json();
      alert(`Enviado a ${data.sent} de ${data.totalDevices} dispositivos`);
    } catch {
      alert('Error de red');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 relative z-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black tracking-widest uppercase flex items-center gap-3">
            <Cake className="w-8 h-8 text-pink-400" /> Cumpleaños
          </h1>
          <p className="text-zinc-500 font-medium tracking-wide text-sm mt-1">
            Sorprende a tus clientes con un regalo en su día.
          </p>
        </div>
        <button
          onClick={sendPush}
          disabled={sending}
          className="flex items-center gap-2 bg-pink-500 text-white px-4 py-3 rounded-xl font-bold tracking-widest text-xs hover:bg-pink-400 transition-colors disabled:opacity-50"
        >
          <Send className="w-4 h-4" /> {sending ? 'ENVIANDO...' : 'PUSH A LOS DE HOY'}
        </button>
      </div>

      <div className="flex gap-2">
        {(['today', 'week', 'month'] as const).map((key) => (
          <button
            key={key}
            onClick={() => setWhen(key)}
            className={`px-4 py-2 rounded-xl text-xs font-bold tracking-widest transition-colors ${when === key ? 'bg-pink-500 text-white' : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-white'}`}
          >
            {key === 'today' ? 'HOY' : key === 'week' ? 'ESTA SEMANA' : 'ESTE MES'}
          </button>
        ))}
      </div>

      <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-zinc-500 font-bold tracking-widest text-sm">CARGANDO...</div>
        ) : clients.length === 0 ? (
          <div className="p-10 text-center text-zinc-500 font-bold tracking-widest text-sm">
            NADIE CUMPLE {when === 'today' ? 'HOY' : when === 'week' ? 'ESTA SEMANA' : 'ESTE MES'}
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-950/50 text-xs text-zinc-500 font-bold tracking-widest">
                <th className="p-4 pl-6 uppercase">Cliente</th>
                <th className="p-4 uppercase">Contacto</th>
                <th className="p-4 uppercase">Cumple</th>
                <th className="p-4 uppercase text-center">Sellos</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => {
                const d = new Date(c.birthday);
                const isToday =
                  d.getMonth() === new Date().getMonth() && d.getDate() === new Date().getDate();
                return (
                  <tr key={c.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/20">
                    <td className="p-4 pl-6 font-bold text-white">{c.name}</td>
                    <td className="p-4 text-zinc-400 text-sm">{c.country_code} {c.phone}</td>
                    <td className="p-4">
                      {isToday && <span className="text-pink-400 mr-2">🎂</span>}
                      <span className={isToday ? 'text-pink-400 font-black' : 'text-zinc-300'}>
                        {d.toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })}
                      </span>
                    </td>
                    <td className="p-4 text-center text-white font-bold">{c.stamps}/10</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
