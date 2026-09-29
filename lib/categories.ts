export type ItemType = "star" | "boolean" | "select";

export type SelectOption = {
  value: string;
  label: string;
};

export type CategoryItem = {
  key: string;
  label: string;
  type: ItemType;
  options?: SelectOption[];
};

export type Category = {
  key: string;
  label: string;
  items: CategoryItem[];
};

/**
 * Estructura real de indicadores usada por MysterFoodie, tomada del
 * cuestionario que ya se usa en produccion (mysterfoodie.com/admin).
 * Se agrupa en 5 categorias; el promedio general de una visita es el
 * promedio de los 5 promedios de categoria (no un promedio plano de
 * todos los indicadores).
 */
export const CATEGORIES: Category[] = [
  {
    key: "fachada",
    label: "Fachada",
    items: [
      { key: "fachada_anuncio_visible", label: "Anuncio visible", type: "star" },
      { key: "fachada_puerta", label: "Puerta", type: "star" },
      { key: "fachada_pintura", label: "Pintura", type: "star" },
      { key: "fachada_ventanas", label: "Ventanas", type: "star" },
      { key: "fachada_estacionamiento", label: "Estacionamiento", type: "boolean" },
    ],
  },
  {
    key: "ambiente",
    label: "Ambiente",
    items: [
      { key: "ambiente_limpieza_salon", label: "Limpieza: Salón", type: "star" },
      { key: "ambiente_limpieza_barra", label: "Limpieza: Barra", type: "star" },
      { key: "ambiente_limpieza_terraza", label: "Limpieza: Terraza", type: "star" },
      { key: "ambiente_banos_olor", label: "Limpieza en baños: Olor", type: "star" },
      { key: "ambiente_banos_iluminacion", label: "Limpieza en baños: Iluminación", type: "star" },
      { key: "ambiente_banos_amenidades", label: "Limpieza en baños: Amenidades", type: "star" },
      { key: "ambiente_mobiliario_comodidad", label: "Mobiliario: Comodidad", type: "star" },
      { key: "ambiente_mobiliario_limpieza", label: "Mobiliario: Limpieza", type: "star" },
      { key: "ambiente_mobiliario_mantenimiento", label: "Mobiliario: Mantenimiento", type: "star" },
      { key: "ambiente_orden", label: "Orden", type: "star" },
      { key: "ambiente_ventilacion", label: "Ventilación", type: "star" },
      { key: "ambiente_musica_volumen", label: "Música: Volumen", type: "star" },
      { key: "ambiente_musica_tematica", label: "Música: Temática", type: "star" },
    ],
  },
  {
    key: "atencion",
    label: "Atención",
    items: [
      { key: "atencion_mesero_se_presenta", label: "Mesero: Se presenta", type: "star" },
      { key: "atencion_mesero_conoce_menu", label: "Mesero: Conoce el menú", type: "star" },
      { key: "atencion_mesero_ofrece_promociones", label: "Mesero: Ofrece promociones", type: "star" },
      { key: "atencion_mesero_mantiene_recogida", label: "Mesero: Mantiene recogida la mesa", type: "star" },
      { key: "atencion_mesero_atento", label: "Mesero: Atento a la mesa", type: "star" },
      { key: "atencion_mesero_acompanamiento", label: "Mesero: Acompañamiento a la mesa", type: "star" },
      { key: "atencion_presentacion_mesero", label: "Presentación del mesero", type: "star" },
      { key: "atencion_uniformes_bonitos", label: "Uniformes: Bonitos", type: "star" },
      { key: "atencion_uniformes_limpios", label: "Uniformes: Limpios", type: "star" },
      { key: "atencion_uniformes_sin_arrugas", label: "Uniformes: Sin arrugas", type: "star" },
      { key: "atencion_gerente_visito_mesa", label: "Gerente: visitó la mesa", type: "star" },
      { key: "atencion_pago_rapidez", label: "Pago: Rapidez de cuenta", type: "star" },
      { key: "atencion_pago_cuenta_clara", label: "Pago: Cuenta clara", type: "star" },
      { key: "atencion_pago_tarjetas", label: "Pago: Tarjetas de crédito", type: "star" },
    ],
  },
  {
    key: "alimentos",
    label: "Alimentos",
    items: [
      { key: "alimentos_comida_tiempo", label: "Comida: Tiempo", type: "star" },
      { key: "alimentos_comida_temperatura", label: "Comida: Temperatura", type: "star" },
      { key: "alimentos_comida_apetitosa", label: "Comida: Visualmente apetitosa", type: "star" },
      { key: "alimentos_comida_sabor", label: "Comida: Sabor", type: "star" },
      { key: "alimentos_comida_textura", label: "Comida: Textura", type: "star" },
      { key: "alimentos_comida_propuesta", label: "Comida: Propuesta", type: "star" },
      { key: "alimentos_comida_tamano", label: "Comida: Tamaño", type: "star" },
      { key: "alimentos_comida_precio", label: "Comida: Precio", type: "star" },
      { key: "alimentos_bebidas_tiempo", label: "Bebidas: Tiempo", type: "star" },
      { key: "alimentos_bebidas_temperatura", label: "Bebidas: Temperatura", type: "star" },
      { key: "alimentos_bebidas_sabor", label: "Bebidas: Sabor", type: "star" },
      { key: "alimentos_bebidas_propuesta", label: "Bebidas: Propuesta", type: "star" },
      { key: "alimentos_bebidas_tamano", label: "Bebidas: Tamaño", type: "star" },
      { key: "alimentos_bebidas_precio", label: "Bebidas: Precio", type: "star" },
      { key: "alimentos_ordenes_correctas", label: "Las órdenes fueron correctas", type: "star" },
      {
        key: "alimentos_menu_tipo",
        label: "Menú: tipo",
        type: "select",
        options: [
          { value: "fisico", label: "Físico" },
          { value: "fisico_qr", label: "Físico + QR" },
          { value: "qr", label: "QR" },
        ],
      },
    ],
  },
  {
    key: "accesibilidad",
    label: "Accesibilidad",
    items: [
      { key: "accesibilidad_sillas_altas", label: "Sillas altas para niños", type: "star" },
      { key: "accesibilidad_rampas", label: "Rampas para sillas de ruedas", type: "star" },
      { key: "accesibilidad_bano_ruedas", label: "Baño para sillas de ruedas", type: "star" },
      { key: "accesibilidad_menu_braille", label: "Menú en braile", type: "star" },
    ],
  },
];

export const STAR_ITEMS = CATEGORIES.flatMap((c) =>
  c.items
    .filter((i) => i.type === "star")
    .map((i) => ({ ...i, categoryKey: c.key, categoryLabel: c.label }))
);

export const BOOLEAN_ITEMS = CATEGORIES.flatMap((c) =>
  c.items
    .filter((i) => i.type === "boolean")
    .map((i) => ({ ...i, categoryKey: c.key, categoryLabel: c.label }))
);

export const SELECT_ITEMS = CATEGORIES.flatMap((c) =>
  c.items
    .filter((i) => i.type === "select")
    .map((i) => ({ ...i, categoryKey: c.key, categoryLabel: c.label }))
);

export const TOTAL_ITEM_COUNT =
  STAR_ITEMS.length + BOOLEAN_ITEMS.length + SELECT_ITEMS.length;

export const BUSINESS_TYPES = [
  { value: "restaurante", label: "Restaurante" },
  { value: "bar", label: "Bar" },
  { value: "cafeteria", label: "Cafetería" },
  { value: "otro", label: "Otro" },
];
