export type RatingCategory = {
  key: string;
  label: string;
  helpText: string;
};

export const RATING_CATEGORIES: RatingCategory[] = [
  {
    key: "bienvenida",
    label: "Bienvenida y tiempo de espera inicial",
    helpText: "Que tan rapido y bien fue recibido el comensal al llegar",
  },
  {
    key: "amabilidad",
    label: "Amabilidad y atencion del personal",
    helpText: "Trato, disposicion y cordialidad del equipo",
  },
  {
    key: "conocimiento_menu",
    label: "Conocimiento del menu y recomendaciones del staff",
    helpText: "El personal explica el menu y sugiere platillos o bebidas",
  },
  {
    key: "tiempo_entrega",
    label: "Tiempo de entrega de alimentos y bebidas",
    helpText: "Rapidez desde la orden hasta que llega la mesa",
  },
  {
    key: "calidad_sabor",
    label: "Calidad y sabor de alimentos y bebidas",
    helpText: "Sabor, temperatura y consistencia de lo servido",
  },
  {
    key: "presentacion",
    label: "Presentacion de los platillos",
    helpText: "Como se ve lo que llega a la mesa",
  },
  {
    key: "limpieza_area",
    label: "Limpieza del area de comensales",
    helpText: "Mesas, piso, cristaleria y entorno general",
  },
  {
    key: "limpieza_banos",
    label: "Limpieza de banos",
    helpText: "Estado e higiene de los sanitarios",
  },
  {
    key: "ambiente",
    label: "Ambiente (musica, temperatura, decoracion)",
    helpText: "Comodidad general del espacio",
  },
  {
    key: "precio_valor",
    label: "Relacion calidad-precio",
    helpText: "Lo que se recibio contra lo que se pago",
  },
  {
    key: "recomendaria",
    label: "Probabilidad de recomendar el lugar",
    helpText: "Que tan probable es recomendar este negocio a alguien mas",
  },
];

export type FlagQuestion = {
  key: string;
  label: string;
};

export const FLAG_QUESTIONS: FlagQuestion[] = [
  {
    key: "menu_actualizado",
    label: "El menu esta actualizado, tiene variedad y precios claros",
  },
  {
    key: "redes_sociales",
    label: "El negocio tiene presencia activa en redes sociales",
  },
  {
    key: "programa_fidelidad",
    label: "Cuenta con programa de lealtad o promociones visibles",
  },
  {
    key: "senaletica_precios",
    label: "Los precios son visibles y faciles de consultar",
  },
];

export const BUSINESS_TYPES = [
  { value: "restaurante", label: "Restaurante" },
  { value: "bar", label: "Bar" },
  { value: "cafeteria", label: "Cafeteria" },
  { value: "otro", label: "Otro" },
];
