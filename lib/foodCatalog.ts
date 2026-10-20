/**
 * Catálogo de gustos de comida del formulario de ingreso de Shoppers. Sale de lo que Uber Eats muestra en Veracruz –
 * Boca del Río (categorías del carrusel y los platillos más típicos de los restaurantes más pedidos de la zona).
 * Revisado en octubre de 2026.
 */
export type FoodOption = { key: string; label: string; emoji: string };

export const CUISINES: FoodOption[] = [
  { key: "mexicana", label: "Mexicana", emoji: "🌮" },
  { key: "comida-callejera", label: "Comida callejera", emoji: "🌯" },
  { key: "pescados-mariscos", label: "Pescados y mariscos", emoji: "🦐" },
  { key: "desayuno", label: "Desayuno", emoji: "🍳" },
  { key: "cafe", label: "Café", emoji: "☕" },
  { key: "panaderia", label: "Panadería", emoji: "🥐" },
  { key: "postres", label: "Postres", emoji: "🍰" },
  { key: "helado", label: "Helado", emoji: "🍨" },
  { key: "hamburguesas", label: "Hamburguesas", emoji: "🍔" },
  { key: "pizza", label: "Pizza", emoji: "🍕" },
  { key: "italiana", label: "Italiana", emoji: "🍝" },
  { key: "alitas", label: "Alitas", emoji: "🍗" },
  { key: "americana", label: "Americana", emoji: "🥓" },
  { key: "bbq", label: "BBQ", emoji: "🍖" },
  { key: "asadero-parrilla", label: "Asadero y parrilla", emoji: "🔥" },
  { key: "sushi", label: "Sushi", emoji: "🍣" },
  { key: "japonesa", label: "Japonesa", emoji: "🍱" },
  { key: "china", label: "China", emoji: "🥡" },
  { key: "coreana", label: "Coreana", emoji: "🥘" },
  { key: "asiatica", label: "Asiática", emoji: "🍜" },
  { key: "india", label: "India", emoji: "🍛" },
  { key: "poke", label: "Poke", emoji: "🥗" },
  { key: "hawaiana", label: "Hawaiana", emoji: "🍍" },
  { key: "saludable", label: "Saludable", emoji: "🥑" },
  { key: "vegana", label: "Vegana", emoji: "🌱" },
  { key: "ensaladas", label: "Ensaladas", emoji: "🥬" },
  { key: "sandwiches", label: "Sándwiches", emoji: "🥪" },
  { key: "sopas", label: "Sopas", emoji: "🍲" },
  { key: "comida-reconfortante", label: "Comida reconfortante", emoji: "🍽️" },
  { key: "comida-rapida", label: "Comida rápida", emoji: "🍟" },
  { key: "smoothies", label: "Smoothies", emoji: "🥤" },
  { key: "te-tapioca", label: "Té de tapioca", emoji: "🧋" },
];

export const DISHES: FoodOption[] = [
  { key: "tacos-pastor", label: "Tacos al pastor", emoji: "🌮" },
  { key: "tacos-arabes", label: "Tacos árabes", emoji: "🌯" },
  { key: "tacos-carnitas", label: "Tacos de carnitas", emoji: "🐖" },
  { key: "gorditas", label: "Gorditas", emoji: "🥙" },
  { key: "tortas", label: "Tortas", emoji: "🥖" },
  { key: "tamales", label: "Tamales", emoji: "🫔" },
  { key: "machetes-antojitos", label: "Machetes y antojitos", emoji: "🍢" },
  { key: "quesadillas", label: "Quesadillas", emoji: "🧀" },
  { key: "empanadas", label: "Empanadas", emoji: "🥟" },
  { key: "chilaquiles", label: "Chilaquiles", emoji: "🌶️" },
  { key: "desayuno-completo", label: "Desayuno completo", emoji: "🥞" },
  { key: "bisquets-pan-dulce", label: "Bisquets y pan dulce", emoji: "🥐" },
  { key: "cafe-lechero", label: "Café lechero con pan", emoji: "🥛" },
  { key: "jochos", label: "Jochos y hot dogs", emoji: "🌭" },
  { key: "pollo-asado", label: "Pollo asado", emoji: "🐔" },
  { key: "arrachera", label: "Carne asada y arrachera", emoji: "🥩" },
  { key: "pescado-veracruzana", label: "Pescado a la veracruzana", emoji: "🐟" },
  { key: "arroz-tumbada", label: "Arroz a la tumbada", emoji: "🍚" },
  { key: "ceviche-coctel", label: "Ceviche y coctel de camarón", emoji: "🦐" },
  { key: "hamburguesa", label: "Hamburguesa", emoji: "🍔" },
  { key: "pizza", label: "Pizza", emoji: "🍕" },
  { key: "pasta", label: "Pasta", emoji: "🍝" },
  { key: "alitas", label: "Alitas", emoji: "🍗" },
  { key: "pollo-frito", label: "Pollo frito y nuggets", emoji: "🍟" },
  { key: "sushi-rolls", label: "Sushi y rolls", emoji: "🍣" },
  { key: "poke-bowl", label: "Poke bowl", emoji: "🥗" },
  { key: "ensalada", label: "Ensaladas", emoji: "🥬" },
  { key: "sandwich-wrap", label: "Sándwiches y wraps", emoji: "🥪" },
  { key: "sopas-caldos", label: "Sopas y caldos", emoji: "🍲" },
  { key: "postres-pasteles", label: "Pasteles y postres", emoji: "🍰" },
  { key: "helado", label: "Helado", emoji: "🍨" },
  { key: "cinnamon-rolls", label: "Cinnamon rolls", emoji: "🍥" },
  { key: "boba-tea", label: "Té de tapioca (boba)", emoji: "🧋" },
  { key: "smoothies-jugos", label: "Smoothies y jugos", emoji: "🥤" },
  { key: "cafe-especialidad", label: "Café de especialidad", emoji: "☕" },
];

export const WEEK_DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"] as const;
export const TIME_SLOTS = ["Mañana (8 a 12)", "Comida (12 a 16)", "Tarde (16 a 20)", "Noche (20 a 24)"] as const;
export const EXPERIENCE_LEVELS = ["Sin experiencia en restaurantes", "Menos de 1 año", "De 1 a 3 años", "Más de 3 años"] as const;

export const MIN_DISHES = 3;
export const MIN_CUISINES = 1;
