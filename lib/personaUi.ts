/** Cómo se ve cada pregunta del perfil anónimo (forma de selector y emojis). Solo presentación: las preguntas viven en personaCatalog. */
export type FieldUi = "circles" | "cards" | "steps" | "bubbles" | "yesno" | "grid";

export const FIELD_UI: Record<string, { ui: FieldUi; emoji: string; hint?: string }> = {
  "demografia.edad": { ui: "circles", emoji: "🎂", hint: "Toca tu burbuja" },
  "demografia.escolaridad": { ui: "cards", emoji: "🎓" },
  "demografia.ocupacion": { ui: "cards", emoji: "💼" },
  "demografia.hogar": { ui: "cards", emoji: "🏠" },
  "estilo_vida.frecuencia": { ui: "steps", emoji: "🍽️", hint: "Desliza con el dedo o toca un punto" },
  "estilo_vida.gasto": { ui: "steps", emoji: "💸" },
  "estilo_vida.dieta": { ui: "cards", emoji: "🥗" },
  "estilo_vida.intereses": { ui: "bubbles", emoji: "✨", hint: "Revienta las burbujas que te representen" },
  "estilo_vida.salidas": { ui: "bubbles", emoji: "🥂" },
  "movilidad.vehiculo": { ui: "cards", emoji: "🚗" },
  "movilidad.auto": { ui: "grid", emoji: "🚙", hint: "¿Cuál es tu nave?" },
  "movilidad.pasaporte": { ui: "yesno", emoji: "🛂" },
  "movilidad.visa": { ui: "yesno", emoji: "🌎" },
  "movilidad.moods": { ui: "bubbles", emoji: "🧳", hint: "Elige todos los que has vivido: juntos arman tu tipo de viajero" },
  "movilidad.viajes": { ui: "steps", emoji: "✈️" },
  "medios.redes": { ui: "bubbles", emoji: "📱" },
  "medios.descubre": { ui: "bubbles", emoji: "🔎" },
  "medios.apps": { ui: "bubbles", emoji: "🛵" },
  "medios.resenas": { ui: "steps", emoji: "⭐" },
  // preguntas de seguimiento (se abren según otra respuesta)
  "demografia.giro": { ui: "cards", emoji: "🧩" },
  "demografia.hijos": { ui: "bubbles", emoji: "🧒" },
  "estilo_vida.dieta_nivel": { ui: "yesno", emoji: "🥦" },
  "estilo_vida.deporte": { ui: "bubbles", emoji: "🏅" },
  "estilo_vida.mascota": { ui: "cards", emoji: "🐾" },
  "estilo_vida.ocasion": { ui: "bubbles", emoji: "🎉" },
  "movilidad.estacionamiento": { ui: "steps", emoji: "🅿️" },
  "movilidad.extranjero": { ui: "yesno", emoji: "🌍" },
  "movilidad.comer_viaje": { ui: "bubbles", emoji: "🍴" },
  "movilidad.playa": { ui: "cards", emoji: "🌊" },
  "movilidad.carreras": { ui: "steps", emoji: "🏅" },
  "medios.contenido": { ui: "bubbles", emoji: "🎬" },
  "medios.pide": { ui: "cards", emoji: "📦" },
  "medios.donde_resenas": { ui: "bubbles", emoji: "📝" },
};

export const BLOCK_EMOJI: Record<string, string> = {
  gustos: "🍜", consumo: "🧾", sector: "📍", demografia: "🎂", estilo_vida: "🍷", movilidad: "🧳", medios: "📱",
};

export const OPTION_EMOJI: Record<string, string> = {
  // escolaridad
  "Preparatoria o menos": "📘", "Técnica": "🛠️", "Licenciatura": "🎓", "Posgrado": "🧠",
  // ocupación
  "Estudiante": "📚", "Empleado/a": "🏢", "Profesional independiente": "💻", "Emprendedor/a": "🚀",
  "Servicio público, salud o educación": "🩺", "Hogar": "🏡", "Jubilado/a": "🌴",
  // hogar
  "Solo/a": "🧍", "En pareja": "💑", "Familia con hijos": "👨‍👩‍👧", "Con familia o roomies": "🛋️",
  // dieta
  "Come de todo": "🍔", "Vegetariana": "🥕", "Vegana": "🌱", "Sin gluten": "🌾", "Baja en carbohidratos": "🥑", "Otra": "🍴",
  // intereses
  "Fitness y deporte": "💪", "Viajes": "✈️", "Música y conciertos": "🎶", "Cine y series": "🎬", "Cocinar en casa": "👩‍🍳",
  "Mascotas": "🐶", "Vida nocturna": "🪩", "Café de especialidad": "☕", "Arte y cultura": "🎨", "Videojuegos": "🎮", "Playa y aire libre": "🏖️",
  // salidas
  "Pareja": "💕", "Amigos": "🍻", "Familia": "👪", "Compañeros de trabajo": "🧑‍💼",
  // auto
  "No maneja o no tiene": "🚶", "Moto": "🏍️", "Auto": "🚗", "Sedán o compacto": "🚗", "Crossover": "🚙", "SUV mediana": "🚙", "SUV grande": "🚐",
  "Pickup o utilitario": "🛻", "Auto de confort": "🛋️", "Híbrido o eléctrico": "⚡", "Auto de lujo": "💎", "Deportivo": "🏎️", "Exótico": "🦄",
  // moods viajeros
  "Pueblos Mágicos": "🪅", "EuroTrip": "🏰", "AsiaFan": "🏯", "Mochilero Mood": "🎒", "TEX MEX": "🌶️", "Foodie Goodie": "🍜",
  "Tacos & Garnachas": "🌮", "Beach Babe": "🏝️", "Casino Player": "🎰", "Shopping Susan": "🛍️", "Cruise Lover": "🛳️",
  "Marathon Bunny": "🏃", "Road Trip": "🛣️",
  // redes
  "Instagram": "📸", "TikTok": "🎵", "Facebook": "👍", "YouTube": "▶️", "X": "✖️", "LinkedIn": "💼", "WhatsApp (canales)": "💬", "Pinterest": "📌",
  // descubre
  "Instagram o TikTok": "📲", "Google Maps": "🗺️", "Recomendación de amigos": "🗣️", "Apps de entrega": "🛵", "Reseñas en línea": "⭐",
  "Medios locales": "📰", "Pasa por ahí": "👀",
  // apps
  "Uber Eats": "🟢", "Rappi": "🧡", "DiDi Food": "🟠", "Ninguna": "🚫",
  // seguimientos
  "Gastronomía": "🍳", "Comercio": "🏪", "Servicios profesionales": "📑", "Salud y bienestar": "🩺", "Tecnología": "💻", "Creativo o marketing": "🎨", "Otro": "✨",
  "0 a 5 años": "🍼", "6 a 12 años": "🧒", "13 a 17 años": "🧑‍🎤", "18 o más": "🎓",
  "Flexible": "🌤️", "Bastante estricta": "🎯",
  "Gimnasio": "🏋️", "Running": "🏃", "Ciclismo": "🚴", "Yoga o pilates": "🧘", "Natación": "🏊", "Fútbol": "⚽", "Pádel o tenis": "🎾",
  "Siempre busco lugares pet friendly": "🐕", "A veces": "🤷",
  "Antojo del momento": "🤤", "Comida casual": "🍕", "Celebraciones": "🎂", "Cena romántica": "🕯️", "Reunión de trabajo": "📊",
  "Indispensable": "🅿️", "Me ayuda": "👍", "Me da igual": "😎",
  "Comida local": "🫕", "Street food": "🌭", "Restaurantes de autor": "👨‍🍳", "Mariscos": "🦐", "Cafés y postres": "🍰", "Mercados": "🧺",
  "Tranquila y vacía": "🌅", "Con ambiente y beach club": "🍹", "De pueblito": "🐚", "Todo incluido": "🧴",
  "Reels de restaurantes": "🎞️", "Recetas": "📖", "Foodies locales": "🧑‍🍳", "Ofertas y promociones": "🏷️", "Viajes y gastronomía": "🗺️",
  "Comida completa": "🍽️", "Antojos y snacks": "🍟", "Comida rápida": "🍔", "Café y postres": "☕", "Súper": "🛒",
  "TripAdvisor": "🦉",
  // sí / no
  "Sí": "✅", "No": "🙅",
};
