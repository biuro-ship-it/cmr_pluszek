// Backend przycina notatkę interakcji klienta do 2000 znaków (Zod `.max(2000)`
// w backend/src/routes/clients.ts) — dłuższa treść wysłanego maila leci jako 400.
// Zapisujemy więc tyle, ile się zmieści, z wyraźnym znacznikiem ucięcia.
export const clampNotes = (s: string): string =>
  s.length <= 2000 ? s : `${s.slice(0, 1960)}\n… (treść skrócona)`;
