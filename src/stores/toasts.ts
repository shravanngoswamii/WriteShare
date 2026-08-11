import { reactive } from "vue";

export type ToastTone = "info" | "ok" | "error";

export interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
  /** Optional follow-up the toast offers, e.g. "View pull request". */
  action?: { label: string; run: () => void };
}

const LIFETIME_MS = 5000;

export const toasts = reactive<{ list: Toast[] }>({ list: [] });

let nextId = 1;

export function notify(
  message: string,
  tone: ToastTone = "info",
  action?: Toast["action"],
): number {
  const id = nextId++;
  toasts.list.push({ id, message, tone, action });
  window.setTimeout(() => dismiss(id), LIFETIME_MS);
  return id;
}

export function dismiss(id: number): void {
  const at = toasts.list.findIndex((t) => t.id === id);
  if (at >= 0) toasts.list.splice(at, 1);
}
