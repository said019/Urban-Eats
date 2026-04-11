"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle, PlusCircle, RefreshCcw } from "lucide-react";
import { StampGrid } from "@/components/StampGrid";

export default function AdminClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.clientId as string;
  
  const [client, setClient] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchClientStatus = async () => {
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    try {
      // Re-utilizamos la vista pública (que extrae todo lo necesario)
      const res = await fetch(`${API_BASE}/api/loyalty/clients/${clientId}`);
      if (res.ok) {
        const data = await res.json();
        setClient(data);
      } else {
        alert("Cliente no encontrado o error de base de datos.");
        router.push('/admin');
      }
    } catch {
      alert("Falla de conexión.");
      router.push('/admin');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClientStatus();
  }, [clientId]);

  const handleAddStamp = async () => {
    if (client.stamps >= 10) return alert("El cliente ya tiene su tarjeta llena.");
    if (!confirm(`¿Añadir un sello a ${client.name}?`)) return;

    setActionLoading(true);
    const token = localStorage.getItem('admin_token');
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    
    try {
      const res = await fetch(`${API_BASE}/api/admin/clients/${clientId}/stamp`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        await fetchClientStatus(); // refresh UI
      } else {
        const err = await res.json();
        alert(err.error || "Algo falló.");
      }
    } catch (e) {
      alert("Falla de Red.");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading || !client) return <div className="p-10 font-bold text-zinc-500 tracking-widest text-sm">CARGANDO RECURSOS...</div>;

  return (
    <div className="w-full max-w-lg mx-auto space-y-6">
      <button 
        onClick={() => router.push('/admin')}
        className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors text-sm font-bold tracking-widest"
      >
        <ArrowLeft className="w-4 h-4" /> VOLVER
      </button>

      <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl">
        <h1 className="text-2xl font-black text-white">{client.name}</h1>
        <p className="text-zinc-400 text-sm font-medium tracking-widest">{client.country_code} {client.phone}</p>
        
        <div className="my-6">
          <div className="bg-black/50 p-4 rounded-xl border border-zinc-800 transform scale-90 origin-top">
             <StampGrid stamps={client.stamps} handleRedeem={() => {}} />
          </div>
        </div>

        <div className="space-y-3">
          <button
            onClick={handleAddStamp}
            disabled={actionLoading || client.stamps >= 10}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-xl text-black bg-brand-orange font-black tracking-widest hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
             <PlusCircle className="w-5 h-5" /> AGREGAR SELLO {client.stamps >= 10 && '(LLENO)'}
          </button>
          
          <button
             disabled={true}
             className="w-full flex items-center justify-center gap-2 py-4 rounded-xl border border-zinc-700 bg-transparent text-zinc-500 font-bold tracking-widest cursor-not-allowed"
          >
             <RefreshCcw className="w-5 h-5" /> REINICIAR (Pronto)
          </button>
        </div>
      </div>
    </div>
  );
}
