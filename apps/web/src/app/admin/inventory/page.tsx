"use client";

import { useEffect, useState } from "react";
import {
  Package, Edit2, AlertCircle, TrendingUp, DollarSign, Check, X,
} from "lucide-react";
import { CATALOG, STORAGE_KEYS, getAllItems, getCategoryOf } from "@/lib/pos-catalog";

function loadJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
function saveJson(key: string, value: unknown) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

export default function InventoryPage() {
  const [stock, setStock] = useState<Record<string, number>>({});
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [filter, setFilter] = useState<string>('all');
  const [editingPrice, setEditingPrice] = useState<string | null>(null);
  const [adjustingStock, setAdjustingStock] = useState<string | null>(null);

  useEffect(() => {
    const initialStock: Record<string, number> = {};
    Object.values(CATALOG).forEach((cat) => cat.items.forEach((i) => { initialStock[i.id] = i.stock; }));
    setStock({ ...initialStock, ...loadJson(STORAGE_KEYS.STOCK, {}) });
    setPrices(loadJson(STORAGE_KEYS.PRICES, {}));
  }, []);

  const allItems = getAllItems().filter((i) => !i.isService);
  const getDisplayPrice = (id: string, defaultPrice: number) => prices[id] ?? defaultPrice;

  const valueAtCost = allItems.reduce((s, i) => s + i.cost * (stock[i.id] ?? 0), 0);
  const valueAtPrice = allItems.reduce((s, i) => s + getDisplayPrice(i.id, i.price) * (stock[i.id] ?? 0), 0);
  const lowStock = allItems.filter((i) => (stock[i.id] ?? 0) <= 3);

  const filtered = allItems.filter((i) => {
    if (filter === 'all') return true;
    if (filter === 'low') return (stock[i.id] ?? 0) <= 3;
    return getCategoryOf(i.id)?.key === filter;
  });

  const savePrice = (id: string, newPrice: number) => {
    const next = { ...prices, [id]: newPrice };
    setPrices(next); saveJson(STORAGE_KEYS.PRICES, next);
    setEditingPrice(null);
  };

  const saveStock = (id: string, newStock: number) => {
    const next = { ...stock, [id]: newStock };
    setStock(next); saveJson(STORAGE_KEYS.STOCK, next);
    setAdjustingStock(null);
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
          {Object.entries(CATALOG).filter(([k]) => k !== 'servicios').map(([key, cat]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`whitespace-nowrap px-4 py-2 rounded-xl font-bold text-sm ${filter === key ? 'text-white' : 'bg-white text-gray-600 border-2 border-pink-100'}`}
              style={filter === key ? { backgroundColor: cat.color } : {}}
            >
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
            {filtered.map((item) => {
              const itemStock = stock[item.id] ?? 0;
              const cat = item._cat;
              const currentPrice = getDisplayPrice(item.id, item.price);
              const margin = ((currentPrice - item.cost) / item.cost * 100).toFixed(0);
              return (
                <div key={item.id} className="grid grid-cols-12 gap-2 px-4 py-3 items-center hover:bg-pink-50/50">
                  <div className="col-span-12 md:col-span-4 flex items-center gap-2">
                    <div className="w-8 h-8 rounded flex items-center justify-center text-white font-bold text-sm flex-shrink-0" style={{ backgroundColor: cat.color }}>
                      {item.name.charAt(0)}
                    </div>
                    <div className="font-semibold text-sm text-gray-800 truncate">{item.name}</div>
                  </div>
                  <div className="col-span-6 md:col-span-2"><span className="text-xs text-gray-500">{cat.name}</span></div>
                  <div className="col-span-6 md:col-span-2 flex items-center justify-end md:justify-center gap-1">
                    {adjustingStock === item.id ? (
                      <StockEditor currentStock={itemStock} onSave={(n) => saveStock(item.id, n)} onCancel={() => setAdjustingStock(null)} />
                    ) : (
                      <button
                        onClick={() => setAdjustingStock(item.id)}
                        className={`text-sm font-bold px-3 py-1 rounded-lg transition ${itemStock <= 3 ? 'bg-red-100 text-red-700 hover:bg-red-200' : itemStock <= 8 ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}
                      >
                        {itemStock} <Edit2 size={10} className="inline ml-1" />
                      </button>
                    )}
                  </div>
                  <div className="col-span-3 md:col-span-1 text-right text-xs text-gray-500">${item.cost}</div>
                  <div className="col-span-6 md:col-span-2 text-right">
                    {editingPrice === item.id ? (
                      <PriceEditor currentPrice={currentPrice} onSave={(p) => savePrice(item.id, p)} onCancel={() => setEditingPrice(null)} />
                    ) : (
                      <button onClick={() => setEditingPrice(item.id)} className="font-bold text-pink-600 hover:bg-pink-100 px-2 py-1 rounded inline-flex items-center gap-1">
                        ${currentPrice} <Edit2 size={10} />
                      </button>
                    )}
                  </div>
                  <div className="col-span-3 md:col-span-1 text-right">
                    <span className="text-xs font-bold text-green-600">{margin}%</span>
                  </div>
                </div>
              );
            })}
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
      <input
        type="number"
        value={val}
        onChange={(e) => setVal(parseFloat(e.target.value) || 0)}
        className="w-16 text-right px-2 py-1 border-2 border-pink-300 rounded text-sm font-bold"
        autoFocus
      />
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
