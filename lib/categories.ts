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
 * Se agrupa en 6 categorias; el promedio general de una visita es el
 * promedio de los 6 promedios de categoria (no un promedio plano de
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
      // Limpieza de lo que llega a la mesa y seguridad visible (indicadores de nivel Distintivo H / Protección Civil).
      { key: "atencion_vajilla_platos", label: "Platos", type: "star", group: "Limpieza del servicio" },
      { key: "atencion_vajilla_cubiertos", label: "Cubiertos", type: "star", group: "Limpieza del servicio" },
      { key: "atencion_vajilla_vasos", label: "Vasos", type: "star", group: "Limpieza del servicio" },
      { key: "atencion_seguridad_senaletica", label: "Señalética visible", type: "boolean", group: "Seguridad" },
      { key: "atencion_seguridad_extintor", label: "Extintor a la vista", type: "boolean", group: "Seguridad" },
      { key: "atencion_seguridad_salida", label: "Salida de emergencia señalizada", type: "boolean", group: "Seguridad" },
      { key: "atencion_gerente_visito_mesa", label: "Gerente: visitó la mesa", type: "star" },
      { key: "atencion_pago_rapidez", label: "Rapidez de cuenta", type: "star", group: "Pago" },
      { key: "atencion_pago_cuenta_clara", label: "Cuenta clara", type: "star", group: "Pago" },
      { key: "atencion_pago_tarjetas", label: "Tarjetas de crédito", type: "star", group: "Pago" },
      {
        key: "atencion_pago_venta_sugerida",
        label: "El mesero sugirió postre, especialidades de la casa o recomendados",
        type: "boolean",
        group: "Pago",
      },
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
  {
    // Lo que un cliente puede observar sentado en el comedor de los criterios de higiene del
    // Distintivo H (Sectur). No es una auditoría ni otorga ni sustituye el distintivo.
    key: "higiene",
    label: "Higiene",
    items: [
      { key: "higiene_personal_cabello", label: "Cabello recogido o cubierto", type: "boolean", group: "Personal" },
      { key: "higiene_personal_unas", label: "Uñas cortas y limpias", type: "boolean", group: "Personal" },
      { key: "higiene_personal_joyeria", label: "Sin anillos, pulseras ni reloj al servir", type: "boolean", group: "Personal" },
      {
        key: "higiene_personal_conducta",
        label: "Sin comer, fumar ni masticar chicle frente al cliente",
        type: "boolean",
        group: "Personal",
      },
      {
        key: "higiene_manejo_vajilla",
        label: "Vajilla y cubiertos tomados sin tocar donde se come o bebe",
        type: "boolean",
        group: "Manejo de alimentos y bebidas",
      },
      { key: "higiene_manejo_hielo", label: "Hielo servido con pinzas o cucharón", type: "boolean", group: "Manejo de alimentos y bebidas" },
      {
        key: "higiene_manejo_pinzas",
        label: "Alimentos listos para comer, con pinzas o guantes",
        type: "boolean",
        group: "Manejo de alimentos y bebidas",
      },
      {
        key: "higiene_manejo_quimicos",
        label: "Sin químicos de limpieza junto a alimentos o bebidas",
        type: "boolean",
        group: "Manejo de alimentos y bebidas",
      },
      { key: "higiene_banos_lavabo", label: "Agua, jabón y toallas o secador", type: "boolean", group: "Sanitarios del cliente" },
      { key: "higiene_banos_cartel", label: "Cartel de lavado de manos", type: "boolean", group: "Sanitarios del cliente" },
      { key: "higiene_banos_bote", label: "Bote de basura con tapa", type: "boolean", group: "Sanitarios del cliente" },
      { key: "higiene_plagas", label: "Sin plagas a la vista (moscas, cucarachas, roedores)", type: "boolean", group: "Plagas y basura" },
      { key: "higiene_basura", label: "Botes de basura tapados y sin desbordar", type: "boolean", group: "Plagas y basura" },
      { key: "higiene_distintivo_h", label: "Distintivo H vigente a la vista", type: "boolean", group: "Distintivo" },
    ],
  },
];

/**
 * Indicadores que se registran y se muestran pero NO entran al promedio de su categoría:
 * el Distintivo H es voluntario y de pago, y no por no tenerlo un lugar es menos higiénico;
 * lo que puntúa son las conductas observables.
 */
export const UNSCORED_KEYS: ReadonlySet<string> = new Set(["higiene_distintivo_h"]);

/**
 * Datos de contexto de la visita que también cuentan como indicadores (se capturan en
 * todas las visitas con el mismo protocolo, fuera de las categorías):
 *  - ocupación del lugar: primer paso de la visita (sirve para interpretar la calificación);
 *  - facturación: junto a la carga del ticket de consumo;
 *  - «¿volverías?» de 1 a 10: último paso (no entra al promedio de categorías).
 */
export const CONTEXT_SELECT_ITEMS: CategoryItem[] = [
  {
    key: "contexto_ocupacion",
    label: "¿Qué tan lleno estaba el lugar?",
    type: "select",
    options: [
      { value: "vacio", label: "Casi vacío" },
      { value: "poca", label: "Poca gente" },
      { value: "media", label: "Medio lleno" },
      { value: "llena", label: "Lleno" },
      { value: "espera", label: "Lleno y con espera" },
    ],
  },
];
export const OCCUPANCY_LABEL: Record<string, string> = Object.fromEntries(
  (CONTEXT_SELECT_ITEMS[0].options ?? []).map((o) => [o.value, o.label])
);

/** ¿Facturan? Se contesta junto a la foto del ticket de consumo. */
export const INVOICE_OPTIONS: SelectOption[] = [
  { value: "si", label: "Sí facturan" },
  { value: "no", label: "No facturan" },
  { value: "no_ofrecio", label: "No me lo ofrecieron" },
];
export const INVOICE_LABEL: Record<string, string> = Object.fromEntries(INVOICE_OPTIONS.map((o) => [o.value, o.label]));

/** Hitos de servicio con sello de hora (se marcan con un toque durante la visita). */
export const SERVICE_STAMPS = [
  { key: "atendido", label: "Me atendieron", short: "Atención", emoji: "👋" },
  { key: "bebida", label: "Llegó la bebida", short: "Bebida", emoji: "🥤" },
  { key: "platillo", label: "Llegó el platillo", short: "Platillo", emoji: "🍽️" },
  { key: "cuenta", label: "Llegó la cuenta", short: "Cuenta", emoji: "🧾" },
] as const;
export type ServiceStampKey = (typeof SERVICE_STAMPS)[number]["key"];

/** Indicadores fuera de las categorías: ocupación, facturación y «¿volverías?». */
export const EXTRA_INDICATOR_COUNT = CONTEXT_SELECT_ITEMS.length + 2;

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
  STAR_ITEMS.length + BOOLEAN_ITEMS.length + SELECT_ITEMS.length + EXTRA_INDICATOR_COUNT;

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
