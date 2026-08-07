import { reactive, watch } from "vue";

const KEY = "writeshare.settings";

interface SettingsState {
  /** Off = edits stay in the browser until an explicit Push. */
  autoSaveToGitHub: boolean;
  /** Global commit message template override ("" = repo or built-in default). */
  commitTemplate: string;
}

function load(): SettingsState {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<SettingsState> | null;
    return {
      autoSaveToGitHub: parsed?.autoSaveToGitHub === true,
      commitTemplate: typeof parsed?.commitTemplate === "string" ? parsed.commitTemplate : "",
    };
  } catch {
    return { autoSaveToGitHub: false, commitTemplate: "" };
  }
}

export const settings = reactive<SettingsState>(load());

watch(settings, () => localStorage.setItem(KEY, JSON.stringify(settings)), { deep: true });
