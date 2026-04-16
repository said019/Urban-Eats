"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { LogOut, LayoutDashboard, Users, Gift } from "lucide-react";
import Link from "next/link";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    // Si estamos en la ruta de login, no hay que checar nada.
    if (pathname === '/admin/login' || pathname === '/admin/setup') {
      queueMicrotask(() => setAuthorized(true));
      return;
    }

    const token = localStorage.getItem('admin_token');
    if (!token) {
      queueMicrotask(() => setAuthorized(false));
      router.replace(`/admin/login?next=${encodeURIComponent(pathname || '/admin')}`);
    } else {
      queueMicrotask(() => setAuthorized(true));
    }
  }, [pathname, router]);

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    router.push('/admin/login');
  };

  if (!authorized) return <div className="min-h-screen bg-black flex items-center justify-center text-zinc-500 font-bold tracking-widest text-sm">CARGANDO RECURSOS CORPORATIVOS...</div>;

  // Renderizar layout sólo si no estamos en login
  if (pathname === '/admin/login' || pathname === '/admin/setup') {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen bg-black text-white font-sans overflow-hidden">
      {/* Sidebar para Tablets / Desktop */}
      <aside className="w-64 bg-zinc-950 border-r border-zinc-800 flex flex-col justify-between hidden md:flex">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-10 text-brand-orange neon-text font-black tracking-widest">
            <LayoutDashboard className="w-6 h-6" />
            <span className="text-xl">URBAN POS</span>
          </div>
          <nav className="flex flex-col gap-2">
            <Link
              href="/admin"
              className={`flex items-center gap-2 px-4 py-3 rounded-xl font-bold text-sm tracking-wide transition-colors ${pathname === '/admin' ? 'bg-zinc-900 border border-zinc-800 text-brand-yellow' : 'text-zinc-400 hover:text-white hover:bg-zinc-900/50'}`}
            >
              <Users className="w-4 h-4" /> Clientes
            </Link>
            <Link
              href="/admin/rewards"
              className={`flex items-center gap-2 px-4 py-3 rounded-xl font-bold text-sm tracking-wide transition-colors ${pathname?.startsWith('/admin/rewards') ? 'bg-zinc-900 border border-zinc-800 text-brand-orange' : 'text-zinc-400 hover:text-white hover:bg-zinc-900/50'}`}
            >
              <Gift className="w-4 h-4" /> Recompensas
            </Link>
          </nav>
        </div>
        
        <div className="p-6">
          <button 
            onClick={handleLogout}
            className="flex items-center gap-2 text-zinc-500 text-sm font-bold tracking-widest hover:text-red-400 transition-colors w-full"
          >
            <LogOut className="w-4 h-4" /> CERRAR TURNO
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative overflow-auto">
        <div className="absolute top-0 right-0 w-full h-40 bg-gradient-to-b from-brand-orange/5 to-transparent pointer-events-none" />
        
        {/* Mobile Header (Fallback para celulares de cajeros) */}
        <header className="md:hidden flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-20">
          <span className="font-black tracking-widest text-brand-orange text-lg">URBAN POS</span>
          <button onClick={handleLogout} className="p-2 text-zinc-400 hover:text-red-400">
            <LogOut className="w-5 h-5" />
          </button>
        </header>

        <div className="flex-1 p-6 sm:p-10">
          {children}
        </div>
      </main>
    </div>
  );
}
