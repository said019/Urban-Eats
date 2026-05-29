"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Package, Edit2, AlertCircle, TrendingUp, DollarSign, Check, X,
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
  const valueAtCost = tangible.reduce((s, i) => s + i.cost * i.stock, 0);
  const valueAtPrice = tangible.reduce((s, i) => s + i.price * i.stock, 0);
  const lowStock = tangible.filter((i) => i.stock <= 3);

  const categories = useMemo(() => {
    const map = new Map<string, { key: string; name: string; color: string }>();
    tangible.forEach((p) => { if (!map.has(p.category_id)) map.set(p.category_id, { key: p.category_id, name: p.category_name, color: p.category_color }); });
    return Array.from(map.values());
  }, [tangible]);

  const filtered = tangible.filter((i) => {
    if (filter === 'all') return true;
    if (filter === 'low') return i.stock <= 3;
    return i.category_id === filter;
  });

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
        <div className="flex items-center gap-3 mb-4">
          <Package className="w-8 h-8 text-pink-500" />
          <h1 className="text-3xl font-black text-pink-600">Inventario</h1>
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
                const margin = ((item.price - item.cost) / item.cost * 100).toFixed(0);
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
                      {adjustingStock === item.id ? (
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
                      <span className="text-xs font-bold text-green-600">{margin}%</span>
                    </div>
                  </div>
                );
              })
            )}
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
