"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Package, Edit2, AlertCircle, TrendingUp, DollarSign, Check, X, Plus, Sparkles,
} from "lucide-react";
import { adminFetch } from "@/lib/admin-fetch";

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

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [editingPrice, setEditingPrice] = useState<string | null>(null);
  const [adjustingStock, setAdjustingStock] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await adminFetch('/api/admin/products');
      if (r.ok) setProducts(await r.json());
    } catch {
      // sesión vencida → adminFetch redirige al login
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const tangible = useMemo(() => products.filter((p) => !p.is_service), [products]);
  const services = useMemo(() => products.filter((p) => p.is_service), [products]);
  const valueAtCost = tangible.reduce((s, i) => s + i.cost * i.stock, 0);
  const valueAtPrice = tangible.reduce((s, i) => s + i.price * i.stock, 0);
  const lowStock = tangible.filter((i) => i.stock <= 3);

  // Categorías de productos físicos (para los chips de filtro).
  const categories = useMemo(() => {
    const map = new Map<string, { key: string; name: string; color: string }>();
    tangible.forEach((p) => { if (!map.has(p.category_id)) map.set(p.category_id, { key: p.category_id, name: p.category_name, color: p.category_color }); });
    return Array.from(map.values());
  }, [tangible]);

  // Todas las categorías (incluye las de servicios) para el formulario de creación.
  const allCategories = useMemo(() => {
    const map = new Map<string, { key: string; name: string; color: string; is_ramen: boolean }>();
    products.forEach((p) => { if (!map.has(p.category_id)) map.set(p.category_id, { key: p.category_id, name: p.category_name, color: p.category_color, is_ramen: p.is_ramen }); });
    return Array.from(map.values());
  }, [products]);

  const filtered = useMemo(() => {
    if (filter === 'services') return services;
    return tangible.filter((i) => {
      if (filter === 'all') return true;
      if (filter === 'low') return i.stock <= 3;
      return i.category_id === filter;
    });
  }, [filter, tangible, services]);

  const patchProduct = async (id: string, body: Partial<Product> & { stock_delta?: number }) => {
    try {
      const r = await adminFetch(`/api/admin/products/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (r.ok) {
        const updated: Product = await r.json();
        setProducts((prev) => prev.map((p) => (p.id === id ? updated : p)));
      } else {
        const err = await r.json().catch(() => ({}));
        alert(err.error || 'Error guardando');
      }
    } catch {
      // sesión vencida → adminFetch redirige al login
    }
  };

  return (
    <div className="-m-6 sm:-m-10 min-h-[calc(100vh-4rem)] bg-gradient-to-br from-pink-50 via-white to-rose-50 text-gray-800 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-4">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <Package className="w-8 h-8 text-pink-500" />
            <h1 className="text-3xl font-black text-pink-600">Inventario</h1>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-pink-500 hover:bg-pink-600 text-white font-bold px-4 py-2.5 rounded-xl shadow-sm transition"
          >
            <Plus size={18} /> <span className="hidden sm:inline">Nuevo</span>
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl p-4 border-2 border-pink-100">
            <div className="text-xs text-gray-500 font-medium flex items-center gap-1"><DollarSign size={12} /> Valor al Costo</div>
            <div className="text-2xl font-black text-gray-800 mt-1">${valueAtCost.toFixed(0)}</div>
          </div>
          <div className="bg-white rounded-xl p-4 border-2 border-pink-100">
            <div className="text-xs text-gray-500 font-medium flex items-center gap-1"><TrendingUp size={12} /> Valor a Venta</div>
            <div className="text-2xl font-black text-pink-600 mt-1">${valueAtPrice.toFixed(0)}</div>
          </div>
          <div className="bg-white rounded-xl p-4 border-2 border-pink-100">
            <div className="text-xs text-gray-500 font-medium">Ganancia Potencial</div>
            <div className="text-2xl font-black text-green-600 mt-1">${(valueAtPrice - valueAtCost).toFixed(0)}</div>
          </div>
          <div className="bg-white rounded-xl p-4 border-2 border-pink-100">
            <div className="text-xs text-gray-500 font-medium flex items-center gap-1"><AlertCircle size={12} /> Stock Bajo</div>
            <div className="text-2xl font-black text-red-600 mt-1">{lowStock.length}</div>
          </div>
        </div>

        {lowStock.length > 0 && (
          <div className="bg-red-50 border-2 border-red-200 rounded-xl p-3">
            <div className="font-bold text-red-900 text-sm mb-2 flex items-center gap-2">
              <AlertCircle size={16} /> ¡Atención! {lowStock.length} producto{lowStock.length !== 1 ? 's' : ''} con stock bajo
            </div>
            <div className="text-xs text-red-700">
              {lowStock.slice(0, 6).map((i) => i.name).join(', ')}
              {lowStock.length > 6 && ` y ${lowStock.length - 6} más...`}
            </div>
          </div>
        )}

        <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
          <button onClick={() => setFilter('all')} className={`whitespace-nowrap px-4 py-2 rounded-xl font-bold text-sm ${filter === 'all' ? 'bg-pink-500 text-white' : 'bg-white text-gray-600 border-2 border-pink-100'}`}>Todos</button>
          <button onClick={() => setFilter('low')} className={`whitespace-nowrap px-4 py-2 rounded-xl font-bold text-sm ${filter === 'low' ? 'bg-red-500 text-white' : 'bg-white text-gray-600 border-2 border-pink-100'}`}>Stock Bajo</button>
          <button onClick={() => setFilter('services')} className={`whitespace-nowrap px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-1.5 ${filter === 'services' ? 'bg-purple-500 text-white' : 'bg-white text-gray-600 border-2 border-pink-100'}`}><Sparkles size={14} /> Servicios{services.length > 0 ? ` (${services.length})` : ''}</button>
          {categories.map((cat) => (
            <button key={cat.key} onClick={() => setFilter(cat.key)} className={`whitespace-nowrap px-4 py-2 rounded-xl font-bold text-sm ${filter === cat.key ? 'text-white' : 'bg-white text-gray-600 border-2 border-pink-100'}`} style={filter === cat.key ? { backgroundColor: cat.color } : {}}>
              {cat.name}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-2xl border-2 border-pink-100 overflow-hidden">
          <div className="hidden md:grid grid-cols-12 gap-2 px-4 py-2 bg-pink-50 text-xs font-bold text-gray-600 uppercase tracking-wider">
            <div className="col-span-4">Producto</div>
            <div className="col-span-2">Categoría</div>
            <div className="col-span-2 text-center">Stock</div>
            <div className="col-span-1 text-right">Costo</div>
            <div className="col-span-2 text-right">Precio</div>
            <div className="col-span-1 text-right">Margen</div>
          </div>
          <div className="divide-y divide-pink-50 max-h-[60vh] overflow-y-auto">
            {loading ? (
              <div className="p-10 text-center text-pink-400 font-bold tracking-widest text-sm">CARGANDO INVENTARIO...</div>
            ) : filtered.length === 0 ? (
              <div className="p-10 text-center text-gray-500 font-medium text-sm">Sin productos en este filtro</div>
            ) : (
              filtered.map((item) => {
                const margin = item.cost > 0 ? ((item.price - item.cost) / item.cost * 100).toFixed(0) : null;
                return (
                  <div key={item.id} className="grid grid-cols-12 gap-2 px-4 py-3 items-center hover:bg-pink-50/50">
                    <div className="col-span-12 md:col-span-4 flex items-center gap-2">
                      <div className="w-8 h-8 rounded flex items-center justify-center text-white font-bold text-sm flex-shrink-0" style={{ backgroundColor: item.category_color }}>
                        {item.name.charAt(0)}
                      </div>
                      <div className="font-semibold text-sm text-gray-800 truncate">{item.name}</div>
                    </div>
                    <div className="col-span-6 md:col-span-2"><span className="text-xs text-gray-500">{item.category_name}</span></div>
                    <div className="col-span-6 md:col-span-2 flex items-center justify-end md:justify-center gap-1">
                      {item.is_service ? (
                        <span className="text-xs font-bold px-3 py-1 rounded-lg bg-purple-100 text-purple-700 flex items-center gap-1">
                          <Sparkles size={10} /> Servicio
                        </span>
                      ) : adjustingStock === item.id ? (
                        <StockEditor
                          currentStock={item.stock}
                          onSave={async (n) => { await patchProduct(item.id, { stock: n }); setAdjustingStock(null); }}
                          onCancel={() => setAdjustingStock(null)}
                        />
                      ) : (
                        <button
                          onClick={() => setAdjustingStock(item.id)}
                          className={`text-sm font-bold px-3 py-1 rounded-lg transition ${item.stock <= 3 ? 'bg-red-100 text-red-700 hover:bg-red-200' : item.stock <= 8 ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}
                        >
                          {item.stock} <Edit2 size={10} className="inline ml-1" />
                        </button>
                      )}
                    </div>
                    <div className="col-span-3 md:col-span-1 text-right text-xs text-gray-500">${item.cost}</div>
                    <div className="col-span-6 md:col-span-2 text-right">
                      {editingPrice === item.id ? (
                        <PriceEditor
                          currentPrice={item.price}
                          onSave={async (p) => { await patchProduct(item.id, { price: p }); setEditingPrice(null); }}
                          onCancel={() => setEditingPrice(null)}
                        />
                      ) : (
                        <button onClick={() => setEditingPrice(item.id)} className="font-bold text-pink-600 hover:bg-pink-100 px-2 py-1 rounded inline-flex items-center gap-1">
                          ${item.price} <Edit2 size={10} />
                        </button>
                      )}
                    </div>
                    <div className="col-span-3 md:col-span-1 text-right">
                      <span className="text-xs font-bold text-green-600">{margin !== null ? `${margin}%` : '—'}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {showCreate && (
        <CreateProductModal
          categories={allCategories}
          onClose={() => setShowCreate(false)}
          onCreated={(created) => {
            setShowCreate(false);
            setFilter(created.is_service ? 'services' : created.category_id);
            load();
          }}
        />
      )}
    </div>
  );
}

function CreateProductModal({
  categories, onClose, onCreated,
}: {
  categories: { key: string; name: string; color: string; is_ramen: boolean }[];
  onClose: () => void;
  onCreated: (p: Product) => void;
}) {
  const [name, setName] = useState('');
  const [isService, setIsService] = useState(false);
  // Para un servicio solo deben elegirse categorías que NO sean de ramen, para
  // no otorgar sellos de lealtad por error.
  const selectable = useMemo(
    () => (isService ? categories.filter((c) => !c.is_ramen) : categories),
    [isService, categories],
  );
  const [categoryMode, setCategoryMode] = useState<string>(categories[0]?.key ?? '__new__');
  const [newCategory, setNewCategory] = useState('');
  const [price, setPrice] = useState('');
  const [cost, setCost] = useState('');
  const [stock, setStock] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const usingNew = categoryMode === '__new__';

  // Cambia el tipo. Si al marcar "Servicio" la categoría elegida era de ramen,
  // se reubica a una válida (o a "Nueva categoría") para no dar sellos por error.
  const handleType = (service: boolean) => {
    setIsService(service);
    if (service && categoryMode !== '__new__') {
      const cur = categories.find((c) => c.key === categoryMode);
      if (cur?.is_ramen) {
        const firstOk = categories.find((c) => !c.is_ramen);
        setCategoryMode(firstOk ? firstOk.key : '__new__');
      }
    }
  };

  const submit = async () => {
    setError('');
    if (!name.trim()) { setError('Escribe un nombre'); return; }
    const priceNum = Number(price);
    if (!Number.isFinite(priceNum) || priceNum < 0) { setError('Precio inválido'); return; }
    if (usingNew && !newCategory.trim()) { setError('Escribe el nombre de la categoría nueva'); return; }
    setSaving(true);
    try {
      const r = await adminFetch('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          price: priceNum,
          cost: cost === '' ? 0 : Number(cost),
          is_service: isService,
          stock: isService ? 0 : (stock === '' ? 0 : Math.floor(Number(stock))),
          category_id: usingNew ? undefined : categoryMode,
          new_category: usingNew ? { name: newCategory.trim() } : undefined,
        }),
      });
      const data = await r.json();
      if (!r.ok) { setError(data.error || 'No se pudo crear'); setSaving(false); return; }
      onCreated(data as Product);
    } catch (e) {
      if (e instanceof Error && e.message === 'SESSION_EXPIRED') return;
      setError('Falla de red');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => !saving && onClose()}>
      <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-pink-500 to-rose-500 p-4 text-white flex items-center justify-between sticky top-0">
          <div className="flex items-center gap-2"><Plus size={20} /><div className="font-bold text-lg">Nuevo producto / servicio</div></div>
          <button onClick={onClose} className="hover:bg-white/20 rounded p-1"><X size={20} /></button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Nombre</label>
            <input
              autoFocus type="text" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Preparado extra, Renta Switch 1h"
              className="w-full px-3 py-2.5 border-2 border-pink-100 rounded-xl focus:border-pink-400 focus:outline-none text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Tipo</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleType(false)}
                className={`px-3 py-2.5 rounded-xl text-sm font-bold border-2 transition ${!isService ? 'bg-pink-500 text-white border-pink-500' : 'bg-white text-gray-600 border-pink-100'}`}
              >
                Producto físico
              </button>
              <button
                onClick={() => handleType(true)}
                className={`px-3 py-2.5 rounded-xl text-sm font-bold border-2 transition flex items-center justify-center gap-1.5 ${isService ? 'bg-purple-500 text-white border-purple-500' : 'bg-white text-gray-600 border-pink-100'}`}
              >
                <Sparkles size={14} /> Servicio
              </button>
            </div>
            <p className="text-[11px] text-gray-400 mt-1">{isService ? 'Sin control de stock. No otorga sellos de lealtad.' : 'Con control de stock.'}</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Categoría</label>
            <select
              value={categoryMode} onChange={(e) => setCategoryMode(e.target.value)}
              className="w-full px-3 py-2.5 border-2 border-pink-100 rounded-xl focus:border-pink-400 focus:outline-none text-sm bg-white"
            >
              {selectable.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}
              <option value="__new__">➕ Nueva categoría…</option>
            </select>
            {usingNew && (
              <input
                type="text" value={newCategory} onChange={(e) => setNewCategory(e.target.value)}
                placeholder="Nombre de la categoría (ej. Entretenimiento)"
                className="w-full mt-2 px-3 py-2.5 border-2 border-pink-100 rounded-xl focus:border-pink-400 focus:outline-none text-sm"
              />
            )}
          </div>

          <div className={`grid gap-2 ${isService ? 'grid-cols-2' : 'grid-cols-3'}`}>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Precio</label>
              <input type="number" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0" className="w-full px-3 py-2.5 border-2 border-pink-100 rounded-xl focus:border-pink-400 focus:outline-none text-sm" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Costo</label>
              <input type="number" inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0" className="w-full px-3 py-2.5 border-2 border-pink-100 rounded-xl focus:border-pink-400 focus:outline-none text-sm" />
            </div>
            {!isService && (
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Stock</label>
                <input type="number" inputMode="numeric" value={stock} onChange={(e) => setStock(e.target.value)} placeholder="0" className="w-full px-3 py-2.5 border-2 border-pink-100 rounded-xl focus:border-pink-400 focus:outline-none text-sm" />
              </div>
            )}
          </div>

          {error && <div className="text-sm text-red-600 font-medium bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}

          <div className="flex gap-2 pt-1">
            <button onClick={onClose} disabled={saving} className="flex-1 border-2 border-gray-200 text-gray-600 font-bold py-2.5 rounded-xl disabled:opacity-50">Cancelar</button>
            <button onClick={submit} disabled={saving} className="flex-1 bg-pink-500 hover:bg-pink-600 text-white font-bold py-2.5 rounded-xl disabled:opacity-50">
              {saving ? 'Guardando…' : 'Crear'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PriceEditor({ currentPrice, onSave, onCancel }: { currentPrice: number; onSave: (p: number) => void; onCancel: () => void }) {
  const [val, setVal] = useState(currentPrice);
  return (
    <div className="flex items-center gap-1 justify-end">
      <input type="number" value={val} onChange={(e) => setVal(parseFloat(e.target.value) || 0)} className="w-16 text-right px-2 py-1 border-2 border-pink-300 rounded text-sm font-bold" autoFocus />
      <button onClick={() => onSave(val)} className="text-green-600 hover:bg-green-100 p-1 rounded"><Check size={14} /></button>
      <button onClick={onCancel} className="text-gray-400 hover:bg-gray-100 p-1 rounded"><X size={14} /></button>
    </div>
  );
}

function StockEditor({ currentStock, onSave, onCancel }: { currentStock: number; onSave: (n: number) => void; onCancel: () => void }) {
  const [val, setVal] = useState(currentStock);
  const [mode, setMode] = useState<'set' | 'add'>('set');
  const [addAmt, setAddAmt] = useState(0);
  return (
    <div className="bg-white border-2 border-pink-300 rounded-lg p-2 flex items-center gap-1 flex-wrap">
      <select value={mode} onChange={(e) => setMode(e.target.value as 'set' | 'add')} className="text-xs font-bold border rounded px-1 py-0.5">
        <option value="set">Fijar</option>
        <option value="add">+ Sumar</option>
      </select>
      {mode === 'set' ? (
        <input type="number" value={val} onChange={(e) => setVal(parseInt(e.target.value) || 0)} className="w-14 text-center px-1 py-1 border rounded text-sm font-bold" autoFocus />
      ) : (
        <input type="number" value={addAmt} onChange={(e) => setAddAmt(parseInt(e.target.value) || 0)} className="w-14 text-center px-1 py-1 border rounded text-sm font-bold" placeholder="0" autoFocus />
      )}
      <button onClick={() => onSave(mode === 'set' ? val : currentStock + addAmt)} className="text-green-600 hover:bg-green-100 p-1 rounded"><Check size={14} /></button>
      <button onClick={onCancel} className="text-gray-400 hover:bg-gray-100 p-1 rounded"><X size={14} /></button>
    </div>
  );
}
