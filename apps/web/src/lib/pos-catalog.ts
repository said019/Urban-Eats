// Catálogo base de productos Bunsik Ramen.
// Stock y precios se ajustan en localStorage; este módulo solo provee estructura.

export type CatalogItem = {
  id: string;
  name: string;
  cost: number;
  price: number;
  stock: number;
  isService?: boolean;
};

export type Category = {
  name: string;
  color: string;
  isRamen?: boolean;
  items: CatalogItem[];
};

export const CATALOG: Record<string, Category> = {
  ramen_coreano: {
    name: 'Ramen Coreano',
    color: '#EC4899',
    isRamen: true,
    items: [
      { id: 'buldak_carbonara', name: 'Buldak Carbonara', cost: 30, price: 45, stock: 160 },
      { id: 'buldak_taco', name: 'Buldak Taco', cost: 34, price: 50, stock: 20 },
      { id: 'tangle_bulgogi', name: 'Tangle Bulgogi Alfredo', cost: 30.5, price: 45, stock: 16 },
      { id: 'tangle_mushroom', name: 'Tangle Creamy Mushroom', cost: 30.5, price: 45, stock: 16 },
      { id: 'jin_azul', name: 'Jin Ramen Azul', cost: 29.5, price: 40, stock: 7 },
      { id: 'volcano', name: 'Volcano Ramen', cost: 34, price: 50, stock: 1 },
    ],
  },
  chefsito: {
    name: 'Ramen Chefsito',
    color: '#F472B6',
    isRamen: true,
    items: [
      { id: 'chef_pollo', name: 'Pollo Champiñón Verde', cost: 27.5, price: 40, stock: 3 },
      { id: 'chef_pimienta', name: 'Pimienta Rattan Turquesa', cost: 27.5, price: 40, stock: 3 },
      { id: 'chef_chiles', name: 'Chiles Rojos y Res', cost: 27.5, price: 40, stock: 3 },
      { id: 'chef_col', name: 'Col Fermentada Morado', cost: 27.5, price: 40, stock: 2 },
      { id: 'chef_original', name: 'Original Rojo', cost: 27.5, price: 40, stock: 4 },
      { id: 'chef_res', name: 'Res Picosa Naranja', cost: 27.5, price: 40, stock: 2 },
      { id: 'chef_bowl_mariscos', name: 'Bowl Mariscos y Camarón', cost: 38, price: 55, stock: 3 },
    ],
  },
  ramen_mexicano: {
    name: 'Ramen Mexicano',
    color: '#DB2777',
    isRamen: true,
    items: [
      { id: 'mep_res', name: 'MEP Carne de Res', cost: 32, price: 45, stock: 8 },
      { id: 'mep_pollo', name: 'MEP Pollo', cost: 32, price: 45, stock: 8 },
      { id: 'tapatio_birria', name: 'Tapatío Birria', cost: 29.5, price: 42, stock: 9 },
      { id: 'tapatio_asada', name: 'Tapatío Carne Asada con Limón', cost: 29.5, price: 42, stock: 6 },
    ],
  },
  bebidas_meco: {
    name: 'Bebidas MECO',
    color: '#BE185D',
    items: [
      { id: 'meco_frutos', name: 'MECO Frutos Rojos', cost: 42, price: 60, stock: 12 },
      { id: 'meco_granada', name: 'MECO Granada', cost: 42, price: 60, stock: 5 },
      { id: 'meco_limon', name: 'MECO Limón', cost: 42, price: 60, stock: 5 },
      { id: 'meco_naranja', name: 'MECO Naranja', cost: 42, price: 60, stock: 12 },
      { id: 'meco_lychee', name: 'MECO Lychee', cost: 42, price: 60, stock: 4 },
      { id: 'meco_toronja', name: 'MECO Toronja', cost: 42, price: 60, stock: 7 },
    ],
  },
  bebidas_okf: {
    name: 'Bebidas OKF',
    color: '#9D174D',
    items: [
      { id: 'okf_cerezo', name: 'OKF Flor de Cerezo', cost: 28.5, price: 45, stock: 3 },
      { id: 'okf_kiwi', name: 'OKF Kiwi', cost: 28.5, price: 45, stock: 6 },
      { id: 'okf_mora', name: 'OKF Mora Azul', cost: 28.5, price: 45, stock: 5 },
      { id: 'okf_maracuya', name: 'OKF Maracuyá', cost: 28.5, price: 45, stock: 6 },
      { id: 'okf_melon', name: 'OKF Melón', cost: 28.5, price: 40, stock: 3 },
      { id: 'okf_lim_azul', name: 'OKF Limonada Azul', cost: 28.5, price: 40, stock: 5 },
      { id: 'okf_lim_rosa', name: 'OKF Limonada Rosa', cost: 28.5, price: 40, stock: 5 },
      { id: 'okf_uva', name: 'OKF Uva', cost: 28.5, price: 40, stock: 4 },
      { id: 'okf_fresa', name: 'OKF Fresa', cost: 28.5, price: 40, stock: 1 },
      { id: 'okf_sandia', name: 'OKF Sandía', cost: 28.5, price: 40, stock: 1 },
      { id: 'okf_gran_color', name: 'OKF Granada Color', cost: 28.5, price: 40, stock: 2 },
      { id: 'okf_granada', name: 'OKF Granada', cost: 28.5, price: 40, stock: 6 },
    ],
  },
  snacks: {
    name: 'Snacks y Dulces',
    color: '#831843',
    items: [
      { id: 'amos_durazno', name: 'Amos Peelerz Durazno', cost: 34.5, price: 55, stock: 8 },
      { id: 'amos_kiwi', name: 'Amos Peelerz Kiwi', cost: 34.5, price: 55, stock: 8 },
      { id: 'amos_maracuya', name: 'Amos Peelerz Maracuyá', cost: 34.5, price: 55, stock: 8 },
      { id: 'amos_naranja', name: 'Amos Peelerz Naranja', cost: 34.5, price: 55, stock: 8 },
      { id: 'amos_manzana', name: 'Amos Peelerz Manzana Verde', cost: 34.5, price: 55, stock: 8 },
      { id: 'amos_platano', name: 'Amos Peelerz Plátano', cost: 34.5, price: 55, stock: 8 },
      { id: 'mochi_choco', name: 'Mochi Chocomenta 180g', cost: 70.5, price: 115, stock: 6 },
      { id: 'mochi_maple', name: 'Mochi Maple 180g', cost: 70.5, price: 115, stock: 6 },
      { id: 'pretz_cheese', name: 'Pretz Cheesecake Mora Azul', cost: 55, price: 90, stock: 4 },
      { id: 'pretz_matcha', name: 'Pretz Pastel Matcha', cost: 55, price: 90, stock: 8 },
      { id: 'oreo_choc', name: 'Oreo Chocolate', cost: 52, price: 90, stock: 3 },
      { id: 'oreo_matcha', name: 'Oreo Matcha Chinese', cost: 52, price: 95, stock: 4 },
    ],
  },
  servicios: {
    name: 'Servicio de Preparación',
    color: '#E11D48',
    items: [
      { id: 'serv_basico', name: 'Básico — Agua + Vaso + Palillos', cost: 5, price: 25, stock: 999, isService: true },
      { id: 'serv_clasico', name: 'Clásico — + Huevo, Cebollín, Nori', cost: 12, price: 45, stock: 999, isService: true },
      { id: 'serv_premium', name: 'Premium — + Queso, Kimchi, Salchicha', cost: 22, price: 65, stock: 999, isService: true },
    ],
  },
};

export const STORAGE_KEYS = {
  STOCK: 'bunsik:stock',
  PRICES: 'bunsik:prices',
  SALES: 'bunsik:sales',
};

export const RAMEN_FOR_REWARD = 6;

export function isRamenProduct(id: string): boolean {
  for (const cat of Object.values(CATALOG)) {
    if (cat.items.some((i) => i.id === id)) return cat.isRamen ?? false;
  }
  return false;
}

export function getCategoryOf(id: string): { key: string } & Category | null {
  for (const [key, cat] of Object.entries(CATALOG)) {
    if (cat.items.some((i) => i.id === id)) return { key, ...cat };
  }
  return null;
}

export function getProduct(id: string): CatalogItem | null {
  for (const cat of Object.values(CATALOG)) {
    const item = cat.items.find((i) => i.id === id);
    if (item) return item;
  }
  return null;
}

export function getAllItems(): (CatalogItem & { _cat: Category })[] {
  return Object.values(CATALOG).flatMap((c) => c.items.map((i) => ({ ...i, _cat: c })));
}
