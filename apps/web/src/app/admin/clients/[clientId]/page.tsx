"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, PlusCircle, Send, Bug } from "lucide-react";
import { StampGrid } from "@/components/StampGrid";

export default function AdminClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.clientId as string;
  
  const [client, setClient] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [debugInfo, setDebugInfo] = useState<any>(null);

  const fetchClientStatus = async () => {
    try {
      const res = await fetch(`/api/loyalty/clients/${clientId}`);
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
    
    try {
      const res = await fetch(`/api/admin/stamp/${clientId}`, {
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

  const handleForceSync = async () => {
    setSyncing(true);
    const token = localStorage.getItem('admin_token');
    try {
      const res = await fetch(`/api/admin/wallet-sync/${clientId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        alert(`Push enviado a ${data.devices} dispositivo(s). Sellos actuales: ${data.stamps}`);
      } else {
        alert(data.error || 'Error al sincronizar');
      }
    } catch {
      alert('Falla de red.');
    } finally {
      setSyncing(false);
    }
  };

  const handleDebug = async () => {
    const token = localStorage.getItem('admin_token');
    try {
      const res = await fetch(`/api/admin/wallet-debug/${clientId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setDebugInfo(data);
    } catch {
      alert('Falla de red.');
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
            onClick={handleForceSync}
            disabled={syncing}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-xl border border-brand-yellow bg-brand-yellow/10 text-brand-yellow font-bold tracking-widest hover:bg-brand-yellow hover:text-black transition-colors disabled:opacity-50"
          >
            <Send className="w-5 h-5" /> {syncing ? 'ENVIANDO...' : 'FORZAR SYNC WALLET'}
          </button>

          <button
            onClick={handleDebug}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-zinc-700 bg-transparent text-zinc-400 text-xs font-bold tracking-widest hover:text-white hover:border-white transition-colors"
          >
            <Bug className="w-4 h-4" /> VER DIAGNÓSTICO
          </button>
        </div>

        {debugInfo && (
          <div className="mt-4 p-4 bg-zinc-950 border border-zinc-800 rounded-xl text-xs">
            <p className="text-brand-orange font-bold tracking-widest mb-2">DIAGNÓSTICO</p>
            <p className="text-zinc-300 mb-3">{debugInfo.message}</p>
            <div className="space-y-1 text-zinc-400 font-mono">
              <p>Dispositivos Apple registrados: <span className="text-white font-bold">{debugInfo.deviceCount}</span></p>
              <p>Updates recientes: <span className="text-white font-bold">{debugInfo.recentUpdates?.length || 0}</span></p>
              <details className="mt-2">
                <summary className="cursor-pointer text-brand-yellow">ENV vars configuradas</summary>
                <pre className="mt-2 text-[10px] overflow-x-auto">{JSON.stringify(debugInfo.env, null, 2)}</pre>
              </details>
              {debugInfo.registeredDevices?.length > 0 && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-brand-yellow">Dispositivos</summary>
                  <pre className="mt-2 text-[10px] overflow-x-auto">{JSON.stringify(debugInfo.registeredDevices, null, 2)}</pre>
                </details>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
