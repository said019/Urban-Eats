"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, PlusCircle, ArrowRight, QrCode, Users, Zap, Moon, Cake, Stamp, Gift } from "lucide-react";
import { QrScanner } from "@/components/QrScanner";

type Stats = {
  totalClients: number;
  activeClients: number;
  dormantClients: number;
  newToday: number;
  stampsToday: number;
  redemptionsToday: number;
  birthdaysToday: number;
  weekly: { day: string; stamps: number }[];
};

type Client = {
  id: string;
  name: string;
  country_code: string;
  phone: string;
  stamps: number;
  status?: 'active' | 'dormant' | 'inactive';
  birthday?: string | null;
};

export default function AdminDashboardPage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'dormant'>('all');
  const [stats, setStats] = useState<Stats | null>(null);

  const token = () => (typeof window !== 'undefined' ? localStorage.getItem('admin_token') : '');

  const fetchClients = async (query = '', currentFilter = filter) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/clients-list?search=${encodeURIComponent(query)}&filter=${currentFilter}`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (res.ok) setClients(await res.json());
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/admin/stats', { headers: { Authorization: `Bearer ${token()}` } });
      if (res.ok) setStats(await res.json());
    } catch {}
  };

  useEffect(() => {
    fetchClients();
    fetchStats();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => fetchClients(search, filter), 400);
    return () => clearTimeout(t);
  }, [search, filter]);

  const maxStamps = stats?.weekly?.reduce((m, d) => Math.max(m, d.stamps), 0) || 1;

  return (
    <div className="w-full max-w-5xl mx-auto space-y-8 relative z-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-widest uppercase">Dashboard</h1>
          <p className="text-zinc-500 font-medium tracking-wide text-sm mt-1">
            Hoy {new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>

        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setScannerOpen(true)}
            className="flex items-center gap-2 bg-brand-orange text-black px-4 py-3 rounded-xl font-bold tracking-widest text-xs hover:bg-white transition-colors"
          >
            <QrCode className="w-4 h-4" /> ESCANEAR QR
          </button>
          <button
            onClick={() => window.open('/register', '_blank')}
            className="flex items-center gap-2 bg-brand-yellow/10 border border-brand-yellow text-brand-yellow px-4 py-3 rounded-xl font-bold tracking-widest text-xs hover:bg-brand-yellow hover:text-black transition-colors"
          >
            <PlusCircle className="w-4 h-4" /> NUEVO CLIENTE
          </button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={<Users className="w-5 h-5" />} label="Miembros" value={stats?.totalClients ?? '—'} color="text-brand-orange" />
        <StatCard icon={<Zap className="w-5 h-5" />} label="Activos (30d)" value={stats?.activeClients ?? '—'} color="text-brand-yellow" />
        <StatCard icon={<Moon className="w-5 h-5" />} label="Dormidos" value={stats?.dormantClients ?? '—'} color="text-red-400" />
        <StatCard icon={<PlusCircle className="w-5 h-5" />} label="Nuevos hoy" value={stats?.newToday ?? '—'} color="text-green-400" />
        <StatCard icon={<Stamp className="w-5 h-5" />} label="Sellos hoy" value={stats?.stampsToday ?? '—'} color="text-brand-orange" />
        <StatCard icon={<Gift className="w-5 h-5" />} label="Canjes hoy" value={stats?.redemptionsToday ?? '—'} color="text-brand-yellow" />
        <StatCard
          icon={<Cake className="w-5 h-5" />}
          label="Cumpleaños hoy"
          value={stats?.birthdaysToday ?? '—'}
          color="text-pink-400"
          onClick={stats?.birthdaysToday ? () => router.push('/admin/birthdays') : undefined}
        />
        <StatCard
          icon={<Zap className="w-5 h-5" />}
          label="Push masivo"
          value="→"
          color="text-white"
          onClick={() => router.push('/admin/broadcast')}
        />
      </div>

      {/* Weekly chart */}
      {stats?.weekly && stats.weekly.length > 0 && (
        <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-6">
          <p className="text-xs text-zinc-500 font-bold tracking-widest mb-4">SELLOS · ÚLTIMOS 7 DÍAS</p>
          <div className="flex items-end gap-2 h-24">
            {stats.weekly.map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full bg-brand-orange/40 border-t-2 border-brand-orange rounded-t"
                  style={{ height: `${(d.stamps / maxStamps) * 100}%` }}
                />
                <span className="text-[10px] text-zinc-500 font-medium">
                  {new Date(d.day).toLocaleDateString('es-MX', { weekday: 'short' })}
                </span>
                <span className="text-[10px] text-white font-bold">{d.stamps}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <QrScanner
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={(clientId) => {
          setScannerOpen(false);
          router.push(`/admin/clients/${clientId}`);
        }}
      />

      {/* Filtros y búsqueda */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <FilterChip active={filter === 'all'} onClick={() => setFilter('all')}>
            TODOS ({stats?.totalClients ?? '—'})
          </FilterChip>
          <FilterChip active={filter === 'active'} onClick={() => setFilter('active')}>
            ACTIVOS ({stats?.activeClients ?? '—'})
          </FilterChip>
          <FilterChip active={filter === 'dormant'} onClick={() => setFilter('dormant')}>
            DORMIDOS ({stats?.dormantClients ?? '—'})
          </FilterChip>
        </div>

        <div className="relative flex items-center">
          <Search className="absolute left-4 w-5 h-5 text-zinc-500" />
          <input
            type="text"
            placeholder="Buscar por nombre o teléfono..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-zinc-900/50 border border-zinc-800 text-white pl-12 pr-4 py-4 rounded-xl focus:border-brand-orange focus:outline-none transition-colors backdrop-blur-sm"
          />
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl overflow-hidden backdrop-blur-sm">
        {loading ? (
          <div className="p-10 text-center text-zinc-500 font-bold tracking-widest text-sm">SINCRONIZANDO DATOS...</div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-950/50 text-xs text-zinc-500 font-bold tracking-widest">
                <th className="p-4 pl-6 uppercase">Cliente</th>
                <th className="p-4 uppercase hidden sm:table-cell">Contacto</th>
                <th className="p-4 uppercase text-center">Sellos</th>
                <th className="p-4 uppercase hidden md:table-cell">Estado</th>
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody>
              {clients.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-10 text-center text-zinc-500 font-bold tracking-widest text-sm">
                    SIN RESULTADOS
                  </td>
                </tr>
              ) : (
                clients.map((c) => (
                  <tr key={c.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/20 transition-colors group">
                    <td className="p-4 pl-6">
                      <p className="font-bold text-white text-base truncate">{c.name}</p>
                      <p className="text-xs text-zinc-500 font-medium tracking-wide sm:hidden">
                        {c.country_code} {c.phone}
                      </p>
                    </td>
                    <td className="p-4 text-zinc-400 font-medium text-sm hidden sm:table-cell">
                      {c.country_code} {c.phone}
                    </td>
                    <td className="p-4">
                      <div className="flex justify-center items-center gap-1">
                        <span className={`font-black text-lg ${c.stamps >= 10 ? 'text-brand-orange neon-text' : c.stamps >= 5 ? 'text-brand-yellow' : 'text-white'}`}>
                          {c.stamps}
                        </span>
                        <span className="text-zinc-600 text-sm font-bold">/ 10</span>
                      </div>
                    </td>
                    <td className="p-4 hidden md:table-cell">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="p-4 text-right pr-6">
                      <button
                        onClick={() => router.push(`/admin/clients/${c.id}`)}
                        className="p-2 bg-zinc-800 text-zinc-300 rounded-lg group-hover:bg-brand-orange group-hover:text-black transition-all"
                      >
                        <ArrowRight className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon, label, value, color, onClick,
}: { icon: React.ReactNode; label: string; value: number | string; color: string; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`text-left p-4 rounded-xl bg-zinc-900/40 border border-zinc-800 ${onClick ? 'hover:border-brand-orange cursor-pointer' : 'cursor-default'} transition-colors`}
    >
      <div className={`flex items-center gap-2 ${color}`}>
        {icon}
        <span className="text-[10px] font-bold tracking-widest uppercase">{label}</span>
      </div>
      <p className={`mt-2 text-2xl font-black ${color}`}>{value}</p>
    </button>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-xl text-xs font-bold tracking-widest transition-colors ${active ? 'bg-brand-orange text-black' : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'}`}
    >
      {children}
    </button>
  );
}

function StatusBadge({ status }: { status?: 'active' | 'dormant' | 'inactive' }) {
  if (status === 'active') {
    return <span className="text-[10px] font-bold tracking-widest px-2 py-1 rounded bg-brand-yellow/20 text-brand-yellow">ACTIVO</span>;
  }
  if (status === 'dormant') {
    return <span className="text-[10px] font-bold tracking-widest px-2 py-1 rounded bg-red-500/20 text-red-400">DORMIDO</span>;
  }
  return <span className="text-[10px] font-bold tracking-widest px-2 py-1 rounded bg-zinc-800 text-zinc-500">NUEVO</span>;
}
