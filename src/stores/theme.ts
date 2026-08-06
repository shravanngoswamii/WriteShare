import { reactive } from "vue";

export type ThemeMode = "system" | "light" | "dark";

const KEY = "writeshare.theme";
const media = window.matchMedia("(prefers-color-scheme: dark)");

const saved = localStorage.getItem(KEY);

export const theme = reactive<{ mode: ThemeMode }>({
  mode: saved === "light" || saved === "dark" ? saved : "system",
});

export function resolvedTheme(): "light" | "dark" {
  return theme.mode === "system" ? (media.matches ? "dark" : "light") : theme.mode;
}

export function setTheme(mode: ThemeMode): void {
  theme.mode = mode;
  localStorage.setItem(KEY, mode);
  applyTheme();
}

export function cycleTheme(): void {
  const order: ThemeMode[] = ["system", "light", "dark"];
  setTheme(order[(order.indexOf(theme.mode) + 1) % order.length]);
}

export function applyTheme(): void {
  document.documentElement.dataset.theme = resolvedTheme();
}

media.addEventListener("change", () => {
  if (theme.mode === "system") applyTheme();
});

applyTheme();
