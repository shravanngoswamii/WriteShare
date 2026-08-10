import { reactive } from "vue";

export type ThemeMode = "system" | "light" | "dark";
export type Palette = "washi" | "hinoki" | "ash";

const PALETTES: readonly Palette[] = ["washi", "hinoki", "ash"];

const THEME_KEY = "writeshare.theme";
const PALETTE_KEY = "writeshare.palette";
const media = window.matchMedia("(prefers-color-scheme: dark)");

const saved = localStorage.getItem(THEME_KEY);
const savedPalette = localStorage.getItem(PALETTE_KEY);

export const theme = reactive<{ mode: ThemeMode; palette: Palette }>({
  mode: saved === "light" || saved === "dark" ? saved : "system",
  palette: PALETTES.find((p) => p === savedPalette) ?? "washi",
});

export function resolvedTheme(): "light" | "dark" {
  return theme.mode === "system" ? (media.matches ? "dark" : "light") : theme.mode;
}

export function setTheme(mode: ThemeMode): void {
  theme.mode = mode;
  localStorage.setItem(THEME_KEY, mode);
  applyTheme();
}

export function setPalette(palette: Palette): void {
  theme.palette = palette;
  localStorage.setItem(PALETTE_KEY, palette);
  applyTheme();
}

export function cycleTheme(): void {
  const order: ThemeMode[] = ["system", "light", "dark"];
  setTheme(order[(order.indexOf(theme.mode) + 1) % order.length]);
}

export function applyTheme(): void {
  document.documentElement.dataset.theme = resolvedTheme();
  document.documentElement.dataset.palette = theme.palette;
}

media.addEventListener("change", () => {
  if (theme.mode === "system") applyTheme();
});

applyTheme();
