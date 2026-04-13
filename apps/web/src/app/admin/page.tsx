"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, PlusCircle, ArrowRight } from "lucide-react";

export default function AdminDashboardPage() {
  const router = useRouter();
  const [clients, setClients] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchClients = async (query = '') => {
    setLoading(true);
    const token = localStorage.getItem('admin_token');
    
    try {
      const res = await fetch(`/api/admin/clients-list?search=${encodeURIComponent(query)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setClients(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  // Búsqueda en tiempo real simplificada (debounce básico)
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchClients(search);
    }, 400);
    return () => clearTimeout(delayDebounceFn);
  }, [search]);

  return (
    <div className="w-full max-w-5xl mx-auto space-y-8 relative z-10">
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-widest uppercase">Base de Clientes</h1>
          <p className="text-zinc-500 font-medium tracking-wide text-sm mt-1">Busca por teléfono o nombre para otorgar sellos.</p>
        </div>
        
        {/* En un caso real podrías permitir a los administradores registrar desde el panel */}
        <button 
          onClick={() => window.open('/register', '_blank')}
          className="flex items-center gap-2 bg-brand-yellow/10 border border-brand-yellow text-brand-yellow px-4 py-3 rounded-xl font-bold tracking-widest text-xs hover:bg-brand-yellow hover:text-black transition-colors"
        >
          <PlusCircle className="w-4 h-4" /> REGISTRAR NUEVO (LINK)
        </button>
      </div>

      {/* Caja de Búsqueda */}
      <div className="relative">
        <label className="text-xs text-zinc-500 font-bold tracking-widest mb-2 block pl-1">BÚSQUEDA RÁPIDA</label>
        <div className="relative flex items-center">
          <Search className="absolute left-4 w-5 h-5 text-zinc-500" />
          <input 
            type="text" 
            placeholder="Ej. Sarah o 300 123 4567..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-zinc-900/50 border border-zinc-800 text-white pl-12 pr-4 py-4 rounded-xl focus:border-brand-orange focus:outline-none transition-colors backdrop-blur-sm"
          />
        </div>
      </div>

      {/* Tabla de Clientes */}
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
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody>
              {clients.length === 0 ? (
                <tr>
                   <td colSpan={4} className="p-10 text-center text-zinc-500 font-bold tracking-widest text-sm">NO HAY RESULTADOS MATCH</td>
                </tr>
              ) : (
                clients.map(c => (
                  <tr key={c.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/20 transition-colors group">
                    <td className="p-4 pl-6">
                      <p className="font-bold text-white text-base truncate">{c.name}</p>
                      <p className="text-xs text-zinc-500 font-medium tracking-wide sm:hidden">{c.country_code} {c.phone}</p>
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
