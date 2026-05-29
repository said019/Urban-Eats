"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { LogOut, LayoutDashboard, Users, Gift, Megaphone, Cake, ShoppingCart, Package, BarChart3 } from "lucide-react";
import Link from "next/link";

// Destinos de navegación, compartidos entre la barra lateral (desktop) y la
// barra inferior (móvil) para no duplicar. `match` decide el estado activo.
type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  match: (path: string | null) => boolean;
  activeClass: string;
};

const NAV_ITEMS: NavItem[] = [
  { href: '/admin/pos', label: 'Punto de Venta', icon: <ShoppingCart className="w-4 h-4" />, match: (p) => !!p?.startsWith('/admin/pos'), activeClass: 'bg-pink-500/10 border border-pink-500/40 text-pink-400' },
  { href: '/admin/inventory', label: 'Inventario', icon: <Package className="w-4 h-4" />, match: (p) => !!p?.startsWith('/admin/inventory'), activeClass: 'bg-pink-500/10 border border-pink-500/40 text-pink-400' },
  { href: '/admin/reports', label: 'Reportes', icon: <BarChart3 className="w-4 h-4" />, match: (p) => !!p?.startsWith('/admin/reports'), activeClass: 'bg-zinc-900 border border-zinc-800 text-brand-orange' },
  { href: '/admin', label: 'Clientes', icon: <Users className="w-4 h-4" />, match: (p) => p === '/admin', activeClass: 'bg-zinc-900 border border-zinc-800 text-brand-yellow' },
  { href: '/admin/rewards', label: 'Recompensas', icon: <Gift className="w-4 h-4" />, match: (p) => !!p?.startsWith('/admin/rewards'), activeClass: 'bg-zinc-900 border border-zinc-800 text-brand-orange' },
  { href: '/admin/broadcast', label: 'Push Masivo', icon: <Megaphone className="w-4 h-4" />, match: (p) => !!p?.startsWith('/admin/broadcast'), activeClass: 'bg-zinc-900 border border-zinc-800 text-brand-orange' },
  { href: '/admin/birthdays', label: 'Cumpleaños', icon: <Cake className="w-4 h-4" />, match: (p) => !!p?.startsWith('/admin/birthdays'), activeClass: 'bg-zinc-900 border border-zinc-800 text-pink-400' },
];

// Subconjunto que se muestra en la barra inferior móvil (las 4 acciones más
// usadas por un cajero con el celular en la mano).
const MOBILE_NAV_HREFS = ['/admin/pos', '/admin/inventory', '/admin', '/admin/reports'];

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
    // Trata valores vacíos/corruptos como sesión inexistente (mismo criterio
    // que adminFetch), para no renderizar el panel con un token inservible.
    const valid = !!token && token !== 'undefined' && token !== 'null';
    if (!valid) {
      if (token) localStorage.removeItem('admin_token');
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
            <span className="text-xl">BUNSIK POS</span>
          </div>
          <nav className="flex flex-col gap-2">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 px-4 py-3 rounded-xl font-bold text-sm tracking-wide transition-colors ${item.match(pathname) ? item.activeClass : 'text-zinc-400 hover:text-white hover:bg-zinc-900/50'}`}
              >
                {item.icon} {item.label}
              </Link>
            ))}
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
          <span className="font-black tracking-widest text-brand-orange text-lg">BUNSIK POS</span>
          <button onClick={handleLogout} className="p-2 text-zinc-400 hover:text-red-400">
            <LogOut className="w-5 h-5" />
          </button>
        </header>

        <div className="flex-1 p-6 sm:p-10 pb-24 md:pb-10">
          {children}
        </div>

        {/* Barra de navegación inferior — solo móvil. En el celular la barra
            lateral está oculta (hidden md:flex), así que sin esto no habría
            forma de tocar para moverse entre secciones. */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-zinc-950/95 backdrop-blur-md border-t border-zinc-800 flex justify-around">
          {NAV_ITEMS.filter((i) => MOBILE_NAV_HREFS.includes(i.href)).map((item) => {
            const active = item.match(pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-1 flex-1 py-2.5 text-[10px] font-bold tracking-wide transition-colors ${active ? 'text-brand-orange' : 'text-zinc-500 hover:text-white'}`}
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </main>
    </div>
  );
}
