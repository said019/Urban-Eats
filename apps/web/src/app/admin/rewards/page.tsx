"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Save, Gift } from "lucide-react";

type Reward = {
  id: string;
  stamp_number: number;
  type: 'discount' | 'free_item';
  value: string;
  description: string;
  active: boolean;
};

export default function RewardsPage() {
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ stamp_number: 5, type: 'discount' as 'discount' | 'free_item', value: '', description: '' });

  const token = () => (typeof window !== 'undefined' ? localStorage.getItem('admin_token') : '');

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/rewards', { headers: { Authorization: `Bearer ${token()}` } });
      if (res.ok) setRewards(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/rewards', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setShowNew(false);
        setForm({ stamp_number: 5, type: 'discount', value: '', description: '' });
        await load();
      } else {
        alert((await res.json()).error || 'Error');
      }
    } finally {
      setSaving(false);
    }
  };

  const update = async (id: string, patch: Partial<Reward>) => {
    const res = await fetch(`/api/admin/rewards/${id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (res.ok) await load();
  };

  const remove = async (id: string) => {
    if (!confirm('¿Eliminar esta recompensa?')) return;
    const res = await fetch(`/api/admin/rewards/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token()}` },
    });
    if (res.ok) await load();
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-8 relative z-10">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-widest uppercase flex items-center gap-3">
            <Gift className="w-8 h-8 text-brand-orange" /> Recompensas
          </h1>
          <p className="text-zinc-500 font-medium tracking-wide text-sm mt-1">
            Define los hitos de sellos y sus premios.
          </p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-2 bg-brand-orange text-black px-4 py-3 rounded-xl font-bold tracking-widest text-xs hover:bg-white transition-colors"
        >
          <Plus className="w-4 h-4" /> NUEVA RECOMPENSA
        </button>
      </div>

      {showNew && (
        <div className="bg-zinc-900/50 border border-brand-orange/50 rounded-2xl p-6 space-y-4">
          <h3 className="text-white font-black tracking-widest text-sm">NUEVA RECOMPENSA</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-zinc-400 font-bold tracking-widest mb-1 block">SELLOS</label>
              <input
                type="number"
                min={1}
                max={10}
                value={form.stamp_number}
                onChange={(e) => setForm({ ...form, stamp_number: parseInt(e.target.value) || 0 })}
                className="w-full bg-zinc-950 border border-zinc-800 text-white p-3 rounded-xl focus:border-brand-orange focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-400 font-bold tracking-widest mb-1 block">TIPO</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as any })}
                className="w-full bg-zinc-950 border border-zinc-800 text-white p-3 rounded-xl focus:border-brand-orange focus:outline-none"
              >
                <option value="discount">Descuento</option>
                <option value="free_item">Producto gratis</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-zinc-400 font-bold tracking-widest mb-1 block">VALOR (ej. "25" o "Perro Gratis")</label>
            <input
              value={form.value}
              onChange={(e) => setForm({ ...form, value: e.target.value })}
              className="w-full bg-zinc-950 border border-zinc-800 text-white p-3 rounded-xl focus:border-brand-orange focus:outline-none"
              placeholder="25"
            />
          </div>
          <div>
            <label className="text-xs text-zinc-400 font-bold tracking-widest mb-1 block">DESCRIPCIÓN</label>
            <input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full bg-zinc-950 border border-zinc-800 text-white p-3 rounded-xl focus:border-brand-orange focus:outline-none"
              placeholder="25% de descuento en tu siguiente compra"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button
              disabled={saving}
              onClick={create}
              className="bg-brand-orange text-black px-4 py-2 rounded-lg font-bold tracking-widest text-xs hover:bg-white disabled:opacity-50"
            >
              {saving ? 'GUARDANDO...' : 'GUARDAR'}
            </button>
            <button
              onClick={() => setShowNew(false)}
              className="bg-zinc-800 text-zinc-300 px-4 py-2 rounded-lg font-bold tracking-widest text-xs hover:bg-zinc-700"
            >
              CANCELAR
            </button>
          </div>
        </div>
      )}

      <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl overflow-hidden backdrop-blur-sm">
        {loading ? (
          <div className="p-10 text-center text-zinc-500 font-bold tracking-widest text-sm">CARGANDO...</div>
        ) : rewards.length === 0 ? (
          <div className="p-10 text-center text-zinc-500 font-bold tracking-widest text-sm">
            NO HAY RECOMPENSAS CONFIGURADAS
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-950/50 text-xs text-zinc-500 font-bold tracking-widest">
                <th className="p-4 pl-6 uppercase">Sello #</th>
                <th className="p-4 uppercase">Tipo</th>
                <th className="p-4 uppercase">Valor</th>
                <th className="p-4 uppercase">Descripción</th>
                <th className="p-4 uppercase text-center">Activa</th>
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody>
              {rewards.map((r) => (
                <tr key={r.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/20">
                  <td className="p-4 pl-6">
                    <span className="text-brand-orange font-black text-lg">{r.stamp_number}</span>
                  </td>
                  <td className="p-4">
                    <span className={`text-xs font-bold tracking-widest px-2 py-1 rounded ${r.type === 'free_item' ? 'bg-brand-orange/20 text-brand-orange' : 'bg-brand-yellow/20 text-brand-yellow'}`}>
                      {r.type === 'free_item' ? 'GRATIS' : 'DESCUENTO'}
                    </span>
                  </td>
                  <td className="p-4 text-white font-bold">{r.value}</td>
                  <td className="p-4 text-zinc-400 text-sm">{r.description}</td>
                  <td className="p-4 text-center">
                    <input
                      type="checkbox"
                      checked={r.active}
                      onChange={(e) => update(r.id, { active: e.target.checked })}
                      className="w-5 h-5 accent-brand-orange cursor-pointer"
                    />
                  </td>
                  <td className="p-4 text-right pr-6">
                    <button
                      onClick={() => remove(r.id)}
                      className="p-2 bg-zinc-800 text-zinc-300 rounded-lg hover:bg-red-500/20 hover:text-red-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
