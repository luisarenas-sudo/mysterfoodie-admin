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
  /** Nombre del grupo al que pertenece (ej. "Limpieza", "Mesero"). Si varios
   * items comparten group, la UI los junta bajo un solo encabezado y el
   * label de cada item ya no repite el nombre del grupo. */
  group?: string;
  /** Subdivisión dentro de un group (ej. "Baños" dentro de "Limpieza"). */
  subgroup?: string;
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
 *
 * Dentro de cada categoria, los items que comparten `group` (ej. varios
 * indicadores de "Limpieza" o de "Mesero") se muestran juntos en la UI
 * bajo un solo encabezado, en vez de repetir el nombre del grupo antes
 * de cada valor a calificar.
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
      { key: "ambiente_limpieza_salon", label: "Salón", type: "star", group: "Limpieza" },
      { key: "ambiente_limpieza_barra", label: "Barra", type: "star", group: "Limpieza" },
      { key: "ambiente_limpieza_terraza", label: "Terraza", type: "star", group: "Limpieza" },
      { key: "ambiente_banos_olor", label: "Olor", type: "star", group: "Limpieza", subgroup: "Baños" },
      {
        key: "ambiente_banos_iluminacion",
        label: "Iluminación",
        type: "star",
        group: "Limpieza",
        subgroup: "Baños",
      },
      {
        key: "ambiente_banos_amenidades",
        label: "Amenidades",
        type: "star",
        group: "Limpieza",
        subgroup: "Baños",
      },
      { key: "ambiente_mobiliario_comodidad", label: "Comodidad", type: "star", group: "Mobiliario" },
      { key: "ambiente_mobiliario_limpieza", label: "Limpieza", type: "star", group: "Mobiliario" },
      {
        key: "ambiente_mobiliario_mantenimiento",
        label: "Mantenimiento",
        type: "star",
        group: "Mobiliario",
      },
      { key: "ambiente_orden", label: "Orden", type: "star" },
      { key: "ambiente_ventilacion", label: "Ventilación", type: "star" },
      { key: "ambiente_musica_volumen", label: "Volumen", type: "star", group: "Música" },
      { key: "ambiente_musica_tematica", label: "Temática", type: "star", group: "Música" },
    ],
  },
  {
    key: "atencion",
    label: "Atención",
    items: [
      { key: "atencion_mesero_se_presenta", label: "Se presenta", type: "star", group: "Mesero" },
      { key: "atencion_mesero_conoce_menu", label: "Conoce el menú", type: "star", group: "Mesero" },
      {
        key: "atencion_mesero_ofrece_promociones",
        label: "Ofrece promociones",
        type: "star",
        group: "Mesero",
      },
      {
        key: "atencion_mesero_mantiene_recogida",
        label: "Mantiene recogida la mesa",
        type: "star",
        group: "Mesero",
      },
      { key: "atencion_mesero_atento", label: "Atento a la mesa", type: "star", group: "Mesero" },
      {
        key: "atencion_mesero_acompanamiento",
        label: "Acompañamiento a la mesa",
        type: "star",
        group: "Mesero",
      },
      { key: "atencion_presentacion_mesero", label: "Presentación del mesero", type: "star" },
      { key: "atencion_uniformes_bonitos", label: "Bonitos", type: "star", group: "Uniformes" },
      { key: "atencion_uniformes_limpios", label: "Limpios", type: "star", group: "Uniformes" },
      { key: "atencion_uniformes_sin_arrugas", label: "Sin arrugas", type: "star", group: "Uniformes" },
      { key: "atencion_gerente_visito_mesa", label: "Gerente: visitó la mesa", type: "star" },
      { key: "atencion_pago_rapidez", label: "Rapidez de cuenta", type: "star", group: "Pago" },
      { key: "atencion_pago_cuenta_clara", label: "Cuenta clara", type: "star", group: "Pago" },
      { key: "atencion_pago_tarjetas", label: "Tarjetas de crédito", type: "star", group: "Pago" },
    ],
  },
  {
    key: "alimentos",
    label: "Alimentos",
    items: [
      { key: "alimentos_comida_tiempo", label: "Tiempo", type: "star", group: "Comida" },
      { key: "alimentos_comida_temperatura", label: "Temperatura", type: "star", group: "Comida" },
      {
        key: "alimentos_comida_apetitosa",
        label: "Visualmente apetitosa",
        type: "star",
        group: "Comida",
      },
      { key: "alimentos_comida_sabor", label: "Sabor", type: "star", group: "Comida" },
      { key: "alimentos_comida_textura", label: "Textura", type: "star", group: "Comida" },
      { key: "alimentos_comida_propuesta", label: "Propuesta", type: "star", group: "Comida" },
      { key: "alimentos_comida_tamano", label: "Tamaño", type: "star", group: "Comida" },
      { key: "alimentos_comida_precio", label: "Precio", type: "star", group: "Comida" },
      { key: "alimentos_bebidas_tiempo", label: "Tiempo", type: "star", group: "Bebidas" },
      { key: "alimentos_bebidas_temperatura", label: "Temperatura", type: "star", group: "Bebidas" },
      { key: "alimentos_bebidas_sabor", label: "Sabor", type: "star", group: "Bebidas" },
      { key: "alimentos_bebidas_propuesta", label: "Propuesta", type: "star", group: "Bebidas" },
      { key: "alimentos_bebidas_tamano", label: "Tamaño", type: "star", group: "Bebidas" },
      { key: "alimentos_bebidas_precio", label: "Precio", type: "star", group: "Bebidas" },
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
      { key: "accesibilidad_sillas_altas", label: "Sillas altas para niños", type: "boolean" },
      { key: "accesibilidad_rampas", label: "Rampas para sillas de ruedas", type: "boolean" },
      { key: "accesibilidad_bano_ruedas", label: "Baño para sillas de ruedas", type: "boolean" },
      { key: "accesibilidad_menu_braille", label: "Menú en braile", type: "boolean" },
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

/**
 * Bloque de items para renderizar un paso del formulario. Los items que
 * comparten `group` (ej. varios indicadores de "Limpieza") se juntan en un
 * solo bloque con un encabezado; dentro de un bloque, los que además
 * comparten `subgroup` (ej. "Baños" dentro de "Limpieza") se separan con
 * un sub-encabezado, sin repetir el nombre del grupo en cada item.
 */
export type ItemSubBlock = {
  subgroup?: string;
  items: CategoryItem[];
};

export type ItemBlock =
  | { kind: "standalone"; items: CategoryItem[] }
  | { kind: "group"; group: string; subBlocks: ItemSubBlock[] };

export function groupCategoryItems(items: CategoryItem[]): ItemBlock[] {
  const blocks: ItemBlock[] = [];
  let i = 0;
  while (i < items.length) {
    if (!items[i].group) {
      const standalone: CategoryItem[] = [];
      while (i < items.length && !items[i].group) {
        standalone.push(items[i]);
        i++;
      }
      blocks.push({ kind: "standalone", items: standalone });
      continue;
    }

    const groupName = items[i].group as string;
    const groupItems: CategoryItem[] = [];
    while (i < items.length && items[i].group === groupName) {
      groupItems.push(items[i]);
      i++;
    }

    const subBlocks: ItemSubBlock[] = [];
    let j = 0;
    while (j < groupItems.length) {
      const subgroup = groupItems[j].subgroup;
      const chunk: CategoryItem[] = [];
      while (j < groupItems.length && groupItems[j].subgroup === subgroup) {
        chunk.push(groupItems[j]);
        j++;
      }
      subBlocks.push({ subgroup, items: chunk });
    }

    blocks.push({ kind: "group", group: groupName, subBlocks });
  }
  return blocks;
}

/**
 * Label completo y auto-descriptivo para guardar en base de datos o
 * exportar (ej. "Limpieza: Baños: Olor"), reconstruido a partir de
 * group/subgroup ya que el label usado en la UI del wizard ya no repite
 * el prefijo antes de cada valor a calificar.
 */
export function fullItemLabel(item: CategoryItem): string {
  return [item.group, item.subgroup, item.label].filter(Boolean).join(": ");
}

/**
 * Frase en lenguaje natural para el tipo de negocio (ej. "cafetería"),
 * usada en el correo al cliente: "...visita a tu {businessTypePhrase}".
 * "otro" no tiene una palabra natural corta, así que cae a "negocio".
 */
export function businessTypePhrase(type: string | undefined | null): string {
  const found = BUSINESS_TYPES.find((t) => t.value === type);
  if (!found || found.value === "otro") return "negocio";
  return found.label.toLowerCase();
}
