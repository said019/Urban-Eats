"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Plus, Minus, Trash2, ShoppingCart, CreditCard, Banknote, Check, Search, X,
  User, Gift, BarChart3,
} from "lucide-react";

const RAMEN_FOR_REWARD = 6;

type Product = {
  id: string;
  category_id: string;
  category_name: string;
  category_color: string;
  is_ramen: boolean;
  name: string;
  cost: number;
  price: number;
  stock: number;
  is_service: boolean;
  is_active: boolean;
};

type CartItem = Product & { qty: number };

type ApiClient = {
  id: string;
  name: string;
  country_code: string;
  phone: string;
  stamps: number;
};

type SaleSummary = {
  id: number;
  created_at: string;
  subtotal: number;
  discount: number;
  total: number;
  total_cost: number;
  profit: number;
  payment_method: string;
  ramen_qty: number;
  reward_used: boolean;
  client_uuid: string | null;
  client_name: string | null;
  items: { product_id: string; product_name: string; qty: number; unit_price: number }[];
};

const tokenHeader = () => {
  const t = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : '';
  return { Authorization: `Bearer ${t}` };
};

export default function POSPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [activeCat, setActiveCat] = useState<string>('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [currentCustomer, setCurrentCustomer] = useState<ApiClient | null>(null);
  const [showCustomerLookup, setShowCustomerLookup] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [useReward, setUseReward] = useState(false);
  const [lastSale, setLastSale] = useState<SaleSummary | null>(null);
  const [processing, setProcessing] = useState(false);
  const [todaySales, setTodaySales] = useState<SaleSummary[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  const loadProducts = async () => {
    try {
      const r = await fetch('/api/admin/products', { headers: tokenHeader() });
      if (r.ok) {
        const data: Product[] = await r.json();
        setProducts(data);
        if (!activeCat && data.length > 0) setActiveCat(data[0].category_id);
      }
    } finally {
      setLoadingProducts(false);
    }
  };

  const loadTodaySales = async () => {
    try {
      const r = await fetch('/api/admin/sales?range=today', { headers: tokenHeader() });
      if (r.ok) setTodaySales(await r.json());
    } catch {}
  };

  useEffect(() => { loadProducts(); loadTodaySales(); }, []);

  const categories = useMemo(() => {
    const map = new Map<string, { key: string; name: string; color: string }>();
    products.forEach((p) => { if (!map.has(p.category_id)) map.set(p.category_id, { key: p.category_id, name: p.category_name, color: p.category_color }); });
    return Array.from(map.values());
  }, [products]);

  const visibleProducts = useMemo(() => {
    if (search) return products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));
    return products.filter((p) => p.category_id === activeCat);
  }, [products, search, activeCat]);

  const addToCart = (p: Product) => {
    const isOut = !p.is_service && p.stock <= 0;
    if (isOut) return;
    const existing = cart.find((c) => c.id === p.id);
    if (existing) {
      if (!p.is_service && existing.qty >= p.stock) return;
      setCart(cart.map((c) => (c.id === p.id ? { ...c, qty: c.qty + 1 } : c)));
    } else {
      setCart([...cart, { ...p, qty: 1 }]);
    }
  };

  const updateQty = (id: string, delta: number) => {
    const item = cart.find((c) => c.id === id);
    if (!item) return;
    const newQty = item.qty + delta;
    if (newQty <= 0) { setCart(cart.filter((c) => c.id !== id)); return; }
    if (!item.is_service && newQty > item.stock) return;
    setCart(cart.map((c) => (c.id === id ? { ...c, qty: newQty } : c)));
  };

  const removeFromCart = (id: string) => setCart(cart.filter((c) => c.id !== id));

  const subtotal = cart.reduce((s, c) => s + c.price * c.qty, 0);
  const totalCost = cart.reduce((s, c) => s + c.cost * c.qty, 0);
  const ramenInCart = cart.filter((c) => c.is_ramen);
  const cheapestRamenPrice = ramenInCart.length > 0 ? Math.min(...ramenInCart.map((c) => c.price)) : 0;
  const canUseReward = !!currentCustomer && currentCustomer.stamps >= RAMEN_FOR_REWARD && ramenInCart.length > 0;
  const discount = useReward && canUseReward ? cheapestRamenPrice : 0;
  const total = subtotal - discount;
  const profit = total - totalCost;

  const finalize = async (method: string) => {
    if (cart.length === 0) return;
    setProcessing(true);
    try {
      const r = await fetch('/api/admin/sales', {
        method: 'POST',
        headers: { ...tokenHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_uuid: currentCustomer?.id || null,
          client_name: currentCustomer?.name || null,
          payment_method: method,
          use_reward: useReward && canUseReward,
          items: cart.map((c) => ({ product_id: c.id, qty: c.qty })),
        }),
      });
      const data = await r.json();
      if (!r.ok) {
        alert(data.error || 'Error registrando la venta');
        return;
      }
      setLastSale(data.sale);
      setCart([]); setCurrentCustomer(null); setUseReward(false); setShowCheckout(false);
      await Promise.all([loadProducts(), loadTodaySales()]);
    } catch {
      alert('Falla de red');
    } finally {
      setProcessing(false);
    }
  };

  const todayRevenue = todaySales.reduce((s, x) => s + Number(x.total), 0);
  const todayProfit = todaySales.reduce((s, x) => s + Number(x.profit), 0);

  return (
    <div className="-m-6 sm:-m-10 min-h-[calc(100vh-4rem)] bg-gradient-to-br from-pink-50 via-white to-rose-50 text-gray-800">
      <div className="px-4 py-3 sticky top-0 z-20 bg-white/95 backdrop-blur border-b-4 border-pink-500 flex items-center justify-between">
        <div className="flex items-center">
          <span className="text-[10px] font-black tracking-widest text-pink-500 -mr-0.5" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>RAMEN</span>
          <span className="text-3xl font-black text-pink-500 tracking-tighter ml-1">BUNSIK</span>
        </div>
        <button onClick={() => setShowSummary(true)} className="flex items-center gap-2 bg-pink-50 hover:bg-pink-100 text-pink-700 px-3 py-2 rounded-lg font-semibold text-sm transition">
          <BarChart3 size={18} /><span>${todayRevenue.toFixed(0)}</span>
        </button>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input type="text" placeholder="Buscar producto..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-10 pr-10 py-3 bg-white border-2 border-pink-100 rounded-xl focus:border-pink-400 focus:outline-none text-gray-800" />
            {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X size={18} /></button>}
          </div>

          {!search && categories.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
              {categories.map((cat) => (
                <button key={cat.key} onClick={() => setActiveCat(cat.key)} className={`whitespace-nowrap px-4 py-2.5 rounded-xl font-bold text-sm transition-all ${activeCat === cat.key ? 'text-white shadow-md scale-105' : 'bg-white text-gray-600 hover:bg-pink-50 border-2 border-pink-100'}`} style={activeCat === cat.key ? { backgroundColor: cat.color } : {}}>
                  {cat.name}
                </button>
              ))}
            </div>
          )}

          {loadingProducts ? (
            <div className="p-10 text-center text-pink-400 font-bold tracking-widest text-sm">CARGANDO CATÁLOGO...</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {visibleProducts.map((item) => {
                const isOut = !item.is_service && item.stock <= 0;
                const inCart = cart.find((c) => c.id === item.id);
                return (
                  <button key={item.id} disabled={isOut} onClick={() => addToCart(item)} className={`relative text-left bg-white rounded-2xl p-3 shadow-sm border-2 transition-all hover:shadow-md hover:-translate-y-0.5 ${isOut ? 'opacity-40 cursor-not-allowed' : inCart ? 'border-pink-400' : 'border-transparent'}`}>
                    {inCart && <div className="absolute -top-2 -right-2 bg-pink-500 text-white text-xs font-bold rounded-full w-7 h-7 flex items-center justify-center shadow-md">{inCart.qty}</div>}
                    <div className="h-16 rounded-xl mb-2 flex items-center justify-center text-white font-black text-2xl" style={{ backgroundColor: item.category_color }}>
                      {item.is_service ? '🍜' : item.name.charAt(0)}
                    </div>
                    <div className="text-xs font-semibold text-gray-800 leading-tight mb-1 line-clamp-2 min-h-[2rem]">{item.name}</div>
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-black text-pink-600">${item.price}</span>
                      {!item.is_service && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${item.stock <= 3 ? 'bg-red-100 text-red-700' : item.stock <= 8 ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                          {item.stock}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="lg:sticky lg:top-32 lg:self-start space-y-3">
          <div className="bg-white rounded-2xl shadow-sm border-2 border-pink-100 p-3">
            {currentCustomer ? (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-pink-500 rounded-full flex items-center justify-center text-white font-bold">{currentCustomer.name.charAt(0).toUpperCase()}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-gray-800 truncate">{currentCustomer.name}</div>
                  <div className="text-xs text-gray-500">
                    {currentCustomer.stamps} / {RAMEN_FOR_REWARD} sellos
                    {currentCustomer.stamps >= RAMEN_FOR_REWARD && <span className="bg-green-100 text-green-700 font-bold px-1.5 py-0.5 rounded text-[10px] ml-1">¡RECOMPENSA!</span>}
                  </div>
                </div>
                <button onClick={() => { setCurrentCustomer(null); setUseReward(false); }} className="text-gray-400 hover:text-gray-600 p-1"><X size={16} /></button>
              </div>
            ) : (
              <button onClick={() => setShowCustomerLookup(true)} className="w-full flex items-center gap-2 text-gray-500 hover:text-pink-600 text-sm font-medium py-1">
                <User size={18} /><span>Asignar cliente frecuente</span>
              </button>
            )}
            {canUseReward && (
              <label className="flex items-center gap-2 mt-3 p-2 bg-green-50 border border-green-200 rounded-lg cursor-pointer">
                <input type="checkbox" checked={useReward} onChange={(e) => setUseReward(e.target.checked)} className="w-4 h-4 accent-green-600" />
                <Gift size={16} className="text-green-600" />
                <span className="text-xs font-bold text-green-800 flex-1">Aplicar ramen gratis (-${cheapestRamenPrice})</span>
              </label>
            )}
          </div>

          <div className="bg-white rounded-2xl shadow-lg border-2 border-pink-100 overflow-hidden">
            <div className="bg-gradient-to-r from-pink-500 to-rose-500 px-4 py-3 flex items-center gap-2 text-white">
              <ShoppingCart size={20} /><h2 className="font-bold text-lg">Pedido</h2>
              {cart.length > 0 && <span className="ml-auto bg-white/20 text-xs font-bold px-2 py-0.5 rounded-full">{cart.reduce((s, c) => s + c.qty, 0)} items</span>}
            </div>
            <div className="max-h-[350px] overflow-y-auto">
              {cart.length === 0 ? (
                <div className="p-8 text-center text-gray-400">
                  <ShoppingCart size={48} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Toca un producto para empezar</p>
                </div>
              ) : (
                <div className="divide-y divide-pink-50">
                  {cart.map((item) => (
                    <div key={item.id} className="p-3 flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm text-gray-800 truncate">{item.name}</div>
                        <div className="text-xs text-gray-500">${item.price} c/u</div>
                      </div>
                      <div className="flex items-center gap-1 bg-pink-50 rounded-lg p-1">
                        <button onClick={() => updateQty(item.id, -1)} className="w-7 h-7 rounded bg-white text-pink-600 hover:bg-pink-100 flex items-center justify-center"><Minus size={14} /></button>
                        <span className="font-bold text-sm w-6 text-center">{item.qty}</span>
                        <button onClick={() => updateQty(item.id, 1)} className="w-7 h-7 rounded bg-white text-pink-600 hover:bg-pink-100 flex items-center justify-center"><Plus size={14} /></button>
                      </div>
                      <div className="font-bold text-pink-600 w-16 text-right text-sm">${(item.price * item.qty).toFixed(0)}</div>
                      <button onClick={() => removeFromCart(item.id)} className="text-gray-300 hover:text-red-500 p-1"><Trash2 size={14} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {cart.length > 0 && (
              <div className="border-t-2 border-pink-100 p-4 space-y-2 bg-pink-50/50">
                {discount > 0 && (
                  <>
                    <div className="flex justify-between text-sm text-gray-600"><span>Subtotal</span><span>${subtotal.toFixed(0)}</span></div>
                    <div className="flex justify-between text-sm text-green-700 font-bold"><span className="flex items-center gap-1"><Gift size={14} /> Ramen gratis</span><span>-${discount.toFixed(0)}</span></div>
                  </>
                )}
                <div className="flex justify-between items-baseline pt-1">
                  <span className="text-gray-600 font-medium">Total</span>
                  <span className="text-3xl font-black text-pink-600">${total.toFixed(0)}</span>
                </div>
                <div className="text-xs text-gray-400 flex justify-between">
                  <span>Costo: ${totalCost.toFixed(0)}</span>
                  <span className="text-green-600 font-bold">Margen: ${profit.toFixed(0)}</span>
                </div>
                <button onClick={() => setShowCheckout(true)} className="w-full bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-bold py-3 rounded-xl shadow-md transition-all">
                  Cobrar ${total.toFixed(0)}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {showCustomerLookup && (
        <CustomerLookup onSelect={(c) => { setCurrentCustomer(c); setShowCustomerLookup(false); }} onClose={() => setShowCustomerLookup(false)} />
      )}

      {showCheckout && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => !processing && setShowCheckout(false)}>
          <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-pink-500 to-rose-500 p-5 text-white text-center">
              <div className="text-sm font-bold opacity-90">Total a cobrar</div>
              <div className="text-5xl font-black my-1">${total.toFixed(0)}</div>
              <div className="text-xs opacity-75">{cart.reduce((s, c) => s + c.qty, 0)} productos{currentCustomer && ` · ${currentCustomer.name}`}</div>
            </div>
            <div className="p-5 space-y-3">
              <div className="text-sm font-bold text-gray-700 mb-2">Método de pago</div>
              <button disabled={processing} onClick={() => finalize('Efectivo')} className="w-full flex items-center gap-3 bg-green-50 hover:bg-green-100 border-2 border-green-200 p-4 rounded-xl transition disabled:opacity-50">
                <Banknote className="text-green-600" size={24} /><span className="font-bold text-green-900">Efectivo</span>
              </button>
              <button disabled={processing} onClick={() => finalize('Tarjeta')} className="w-full flex items-center gap-3 bg-blue-50 hover:bg-blue-100 border-2 border-blue-200 p-4 rounded-xl transition disabled:opacity-50">
                <CreditCard className="text-blue-600" size={24} /><span className="font-bold text-blue-900">Tarjeta</span>
              </button>
              <button disabled={processing} onClick={() => finalize('Transferencia')} className="w-full flex items-center gap-3 bg-purple-50 hover:bg-purple-100 border-2 border-purple-200 p-4 rounded-xl transition disabled:opacity-50">
                <CreditCard className="text-purple-600" size={24} /><span className="font-bold text-purple-900">Transferencia</span>
              </button>
              <button disabled={processing} onClick={() => setShowCheckout(false)} className="w-full text-gray-500 font-medium py-2 hover:text-gray-700">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {lastSale && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setLastSale(null)}>
          <div className="bg-white rounded-2xl max-w-md w-full p-6 text-center" onClick={(e) => e.stopPropagation()}>
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3"><Check className="text-green-600" size={32} /></div>
            <div className="text-2xl font-black text-gray-800 mb-1">¡Venta exitosa!</div>
            <div className="text-3xl font-black text-pink-600 mb-1">${lastSale.total.toFixed(0)}</div>
            <div className="text-sm text-gray-500 mb-3">{lastSale.payment_method} · Margen: ${lastSale.profit.toFixed(0)}</div>
            {lastSale.client_name && (
              <div className="bg-pink-50 rounded-xl p-3 mb-4">
                <div className="text-xs font-bold text-pink-700 mb-2">{lastSale.client_name}</div>
                {lastSale.reward_used && (
                  <div className="text-xs text-green-700 font-bold mt-2 flex items-center justify-center gap-1">
                    <Gift size={12} /> Recompensa canjeada
                  </div>
                )}
              </div>
            )}
            <button onClick={() => setLastSale(null)} className="w-full bg-pink-500 hover:bg-pink-600 text-white font-bold py-3 rounded-xl">Continuar</button>
          </div>
        </div>
      )}

      {showSummary && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowSummary(false)}>
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[80vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-pink-500 to-rose-500 p-5 text-white flex items-center justify-between">
              <div>
                <div className="text-sm font-bold opacity-90">Resumen del día</div>
                <div className="text-xl font-black">{new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
              </div>
              <button onClick={() => setShowSummary(false)} className="hover:bg-white/20 rounded-lg p-1"><X size={24} /></button>
            </div>
            <div className="p-5 grid grid-cols-3 gap-3 border-b">
              <div className="text-center"><div className="text-xs text-gray-500 font-medium">Ventas</div><div className="text-2xl font-black text-pink-600">{todaySales.length}</div></div>
              <div className="text-center"><div className="text-xs text-gray-500 font-medium">Ingreso</div><div className="text-2xl font-black text-pink-600">${todayRevenue.toFixed(0)}</div></div>
              <div className="text-center"><div className="text-xs text-gray-500 font-medium">Margen</div><div className="text-2xl font-black text-green-600">${todayProfit.toFixed(0)}</div></div>
            </div>
            <div className="overflow-y-auto flex-1">
              {todaySales.length === 0 ? (
                <div className="p-8 text-center text-gray-400"><BarChart3 size={48} className="mx-auto mb-2 opacity-30" /><p>Aún no hay ventas hoy</p></div>
              ) : (
                <div className="divide-y">
                  {todaySales.map((s) => (
                    <div key={s.id} className="p-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold flex items-center gap-2 flex-wrap">
                          {new Date(s.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                          <span className="text-xs text-gray-400 font-normal">{s.payment_method}</span>
                          {s.client_name && <span className="text-xs text-pink-600 font-bold flex items-center gap-1"><User size={10} />{s.client_name}</span>}
                        </div>
                        <div className="text-xs text-gray-500 truncate">{s.items.map((i) => `${i.qty}× ${i.product_name}`).join(', ')}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-pink-600">${Number(s.total).toFixed(0)}</div>
                        <div className="text-[10px] text-green-600 font-bold">+${Number(s.profit).toFixed(0)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CustomerLookup({ onSelect, onClose }: { onSelect: (c: ApiClient) => void; onClose: () => void }) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<ApiClient[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');

  useEffect(() => {
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await fetch(`/api/admin/clients-list?search=${encodeURIComponent(search)}`, { headers: tokenHeader() });
        if (r.ok) setResults(await r.json());
      } finally { setLoading(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const create = async () => {
    if (!newName.trim() || !newPhone.trim()) return;
    const r = await fetch('/api/admin/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim(), phone: newPhone.trim(), country_code: '+52' }),
    });
    const data = await r.json();
    if (data.clientId) {
      onSelect({ id: data.clientId, name: newName.trim(), phone: newPhone.trim(), country_code: '+52', stamps: 0 });
    } else {
      alert(data.error || 'Error al crear cliente');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-pink-500 to-rose-500 p-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-2"><User size={20} /><div className="font-bold text-lg">Cliente Frecuente</div></div>
          <button onClick={onClose} className="hover:bg-white/20 rounded p-1"><X size={20} /></button>
        </div>
        {!creating ? (
          <>
            <div className="p-3 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input autoFocus type="text" placeholder="Buscar por nombre o teléfono..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-10 pr-3 py-2.5 border-2 border-pink-100 rounded-xl focus:border-pink-400 focus:outline-none text-sm" />
              </div>
            </div>
            <div className="overflow-y-auto flex-1">
              {loading ? (
                <div className="p-6 text-center text-gray-400 text-sm">Buscando...</div>
              ) : results.length === 0 ? (
                <div className="p-6 text-center text-gray-400 text-sm">{search ? 'Sin resultados' : 'Comienza a buscar...'}</div>
              ) : (
                <div className="divide-y">
                  {results.map((c) => (
                    <button key={c.id} onClick={() => onSelect(c)} className="w-full text-left p-3 hover:bg-pink-50 flex items-center gap-3">
                      <div className="w-10 h-10 bg-pink-500 text-white rounded-full flex items-center justify-center font-bold">{c.name.charAt(0).toUpperCase()}</div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-sm">{c.name}</div>
                        <div className="text-xs text-gray-500">{c.country_code} {c.phone}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-gray-500">{c.stamps}/{RAMEN_FOR_REWARD}</div>
                        {c.stamps >= RAMEN_FOR_REWARD && <div className="text-xs font-bold text-green-600">¡Recompensa!</div>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="p-3 border-t bg-pink-50">
              <button onClick={() => setCreating(true)} className="w-full bg-pink-500 hover:bg-pink-600 text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-2">
                <Plus size={18} /> Registrar nuevo
              </button>
            </div>
          </>
        ) : (
          <div className="p-4 space-y-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Nombre</label>
              <input autoFocus type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="María González" className="w-full px-3 py-2.5 border-2 border-pink-100 rounded-xl focus:border-pink-400 focus:outline-none text-sm" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Teléfono (sin lada)</label>
              <input type="tel" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="442 123 4567" className="w-full px-3 py-2.5 border-2 border-pink-100 rounded-xl focus:border-pink-400 focus:outline-none text-sm" />
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setCreating(false)} className="flex-1 border-2 border-gray-200 text-gray-600 font-bold py-2.5 rounded-xl">Cancelar</button>
              <button onClick={create} className="flex-1 bg-pink-500 hover:bg-pink-600 text-white font-bold py-2.5 rounded-xl">Crear y usar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
