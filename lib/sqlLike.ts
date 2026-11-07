/** Escapa % _ \ para usar un texto literal (p. ej. un correo con guion bajo) dentro de ilike sin que actúe como comodín. */
export const escapeLike = (v: string) => v.replace(/[\\%_]/g, (c) => `\\${c}`);
