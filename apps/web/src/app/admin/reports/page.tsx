"use client";

import { useEffect, useState } from "react";
import {
  BarChart3, TrendingUp, DollarSign, Stamp, ShoppingBag,
  Banknote, CreditCard, ArrowRightLeft, User,
} from "lucide-react";
import { adminFetch } from "@/lib/admin-fetch";

type Range = 'today' | 'week' | 'month';

type Totals = {
  sales: number;
  revenue: number;
  profit: number;
  ramen: number;
  cost: number;
};

type PaymentRow = { method: string; count: number; revenue: number };

type TopProduct = {
  product_id: string;
  product_name: string;
  units: number;
  revenue: number;
  profit: number;
};

type SaleSummary = {
  id: number;
  created_at: string;
  total: number;
  profit: number;
  payment_method: string;
  reward_used: boolean;
  client_name: string | null;
  items: { product_id: string; product_name: string; qty: number; unit_price: number }[];
};

type ReportData = {
  range: Range;
  totals: Totals;
  byPayment: PaymentRow[];
  topProducts: TopProduct[];
  sales: SaleSummary[];
};

const RANGES: { key: Range; label: string }[] = [
  { key: 'today', label: 'HOY' },
  { key: 'week', label: '7 DÍAS' },
  { key: 'month', label: '30 DÍAS' },
];

export default function ReportsPage() {
  const [range, setRange] = useState<Range>('today');
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async (r: Range) => {
    setLoading(true);
    try {
      const res = await adminFetch(`/api/admin/reports?range=${r}`);
      if (res.ok) setData(await res.json());
    } catch {
      // sesión vencida → adminFetch ya redirige a /admin/login
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(range); }, [range]);

  const totals = data?.totals;

  return (
    <div className="w-full max-w-5xl mx-auto space-y-8 relative z-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-widest uppercase">Reportes</h1>
          <p className="text-zinc-500 font-medium tracking-wide text-sm mt-1">
            Ventas, márgenes e historial del negocio
          </p>
        </div>

        {/* Tabs de rango */}
        <div className="flex gap-2">
          {RANGES.map((r) => (
            <RangeChip key={r.key} active={range === r.key} onClick={() => setRange(r.key)}>
              {r.label}
            </RangeChip>
          ))}
        </div>
      </div>

      {/* Tarjetas de totales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={<ShoppingBag className="w-5 h-5" />} label="Ventas" value={totals?.sales ?? '—'} color="text-brand-yellow" />
        <StatCard icon={<DollarSign className="w-5 h-5" />} label="Ingresos" value={totals ? `$${totals.revenue.toFixed(0)}` : '—'} color="text-brand-orange" />
        <StatCard icon={<TrendingUp className="w-5 h-5" />} label="Margen" value={totals ? `$${totals.profit.toFixed(0)}` : '—'} color="text-green-400" />
        <StatCard icon={<Stamp className="w-5 h-5" />} label="Ramens" value={totals?.ramen ?? '—'} color="text-pink-400" />
      </div>

      {loading ? (
        <div className="p-10 text-center text-zinc-500 font-bold tracking-widest text-sm">CARGANDO REPORTE...</div>
      ) : (
        <>
          {/* Por método de pago */}
          <Section title="POR MÉTODO DE PAGO">
            {!data || data.byPayment.length === 0 ? (
              <EmptyRow text="Sin ventas en este periodo" />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {data.byPayment.map((p) => (
                  <div key={p.method} className="bg-zinc-950/50 border border-zinc-800 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-zinc-400">
                      <PaymentIcon method={p.method} />
                      <span className="text-xs font-bold tracking-widest uppercase">{p.method}</span>
                    </div>
                    <p className="mt-2 text-2xl font-black text-white">${Number(p.revenue).toFixed(0)}</p>
                    <p className="text-xs text-zinc-500 font-medium">{p.count} {p.count === 1 ? 'venta' : 'ventas'}</p>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Top productos */}
          <Section title="TOP PRODUCTOS">
            {!data || data.topProducts.length === 0 ? (
              <EmptyRow text="Sin ventas en este periodo" />
            ) : (
              <div className="divide-y divide-zinc-800/50">
                {data.topProducts.map((p, i) => (
                  <div key={p.product_id} className="flex items-center gap-3 py-3">
                    <span className="w-6 text-center font-black text-zinc-600">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-white text-sm truncate">{p.product_name}</p>
                      <p className="text-xs text-zinc-500 font-medium">${Number(p.revenue).toFixed(0)} bruto · +${Number(p.profit).toFixed(0)} margen</p>
                    </div>
                    <div className="text-right">
                      <span className="font-black text-lg text-brand-orange">{p.units}</span>
                      <span className="text-zinc-600 text-xs font-bold ml-1">u</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Historial de ventas */}
          <Section title={`HISTORIAL DE VENTAS${data && data.sales.length > 0 ? ` · ${data.sales.length}` : ''}`}>
            {!data || data.sales.length === 0 ? (
              <EmptyRow text="Aún no hay ventas en este periodo" icon />
            ) : (
              <div className="divide-y divide-zinc-800/50">
                {data.sales.map((s) => (
                  <div key={s.id} className="py-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-white flex items-center gap-2 flex-wrap">
                        {new Date(s.created_at).toLocaleString('es-MX', {
                          day: range === 'today' ? undefined : '2-digit',
                          month: range === 'today' ? undefined : 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                        <span className="text-xs text-zinc-500 font-normal">{s.payment_method}</span>
                        {s.client_name && (
                          <span className="text-xs text-pink-400 font-bold flex items-center gap-1">
                            <User size={10} />{s.client_name}
                          </span>
                        )}
                        {s.reward_used && (
                          <span className="text-[10px] font-bold text-green-400 bg-green-500/15 px-1.5 py-0.5 rounded">RECOMPENSA</span>
                        )}
                      </div>
                      <div className="text-xs text-zinc-500 truncate">
                        {s.items.map((i) => `${i.qty}× ${i.product_name}`).join(', ')}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-brand-orange">${Number(s.total).toFixed(0)}</div>
                      <div className="text-[10px] text-green-400 font-bold">+${Number(s.profit).toFixed(0)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </>
      )}
    </div>
  );
}

function RangeChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-xl text-xs font-bold tracking-widest transition-colors ${active ? 'bg-brand-orange text-black' : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'}`}
    >
      {children}
    </button>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number | string; color: string }) {
  return (
    <div className="text-left p-4 rounded-xl bg-zinc-900/40 border border-zinc-800">
      <div className={`flex items-center gap-2 ${color}`}>
        {icon}
        <span className="text-[10px] font-bold tracking-widest uppercase">{label}</span>
      </div>
      <p className={`mt-2 text-2xl font-black ${color}`}>{value}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-6 backdrop-blur-sm">
      <p className="text-xs text-zinc-500 font-bold tracking-widest mb-4">{title}</p>
      {children}
    </div>
  );
}

function EmptyRow({ text, icon }: { text: string; icon?: boolean }) {
  return (
    <div className="py-8 text-center text-zinc-600">
      {icon && <BarChart3 size={40} className="mx-auto mb-2 opacity-30" />}
      <p className="text-sm font-medium">{text}</p>
    </div>
  );
}

function PaymentIcon({ method }: { method: string }) {
  const m = method.toLowerCase();
  if (m.includes('efectivo')) return <Banknote className="w-4 h-4" />;
  if (m.includes('tarjeta')) return <CreditCard className="w-4 h-4" />;
  if (m.includes('transfer')) return <ArrowRightLeft className="w-4 h-4" />;
  return <DollarSign className="w-4 h-4" />;
}
