<script setup lang="ts">
import type { CollectionField } from "@/config";

const props = defineProps<{
  fields: CollectionField[];
  modelValue: Record<string, unknown>;
}>();

const emit = defineEmits<(e: "update:modelValue", value: Record<string, unknown>) => void>();

function set(key: string, value: unknown): void {
  emit("update:modelValue", { ...props.modelValue, [key]: value });
}

function asString(v: unknown): string {
  if (v == null) return "";
  return typeof v === "string" ? v : String(v);
}

function asBool(v: unknown): boolean {
  return v === true || v === "true";
}

function asStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String).filter(Boolean);
  const s = asString(v).trim();
  return s ? s.split(",").map((x) => x.trim()) : [];
}

const pad = (n: number) => String(n).padStart(2, "0");

function isoToLocalInput(v: unknown): string {
  const s = asString(v);
  if (!s) return "";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function localInputToIso(v: string): string {
  return v ? new Date(v).toISOString() : "";
}

function setTags(key: string, raw: string): void {
  set(
    key,
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

function toggleEnum(key: string, option: string): void {
  const current = asStringArray(props.modelValue[key]);
  const next = current.includes(option)
    ? current.filter((o) => o !== option)
    : [...current, option];
  set(key, next);
}

function onInput(e: Event): string {
  return (e.target as HTMLInputElement).value;
}

function onCheck(e: Event): boolean {
  return (e.target as HTMLInputElement).checked;
}
</script>

<template>
  <div class="form">
    <div v-for="field in fields" :key="field.name" class="field">
      <label :for="`fm-${field.name}`" :title="field.name">
        {{ field.label }}<span v-if="field.required" class="req" aria-hidden="true">*</span>
      </label>

      <input
        v-if="field.type === 'string'"
        :id="`fm-${field.name}`"
        type="text"
        :value="asString(modelValue[field.name])"
        @input="set(field.name, onInput($event))"
      />

      <textarea
        v-else-if="field.type === 'text'"
        :id="`fm-${field.name}`"
        rows="3"
        :value="asString(modelValue[field.name])"
        @input="set(field.name, onInput($event))"
      />

      <input
        v-else-if="field.type === 'date'"
        :id="`fm-${field.name}`"
        type="datetime-local"
        :value="isoToLocalInput(modelValue[field.name])"
        @input="set(field.name, localInputToIso(onInput($event)))"
      />

      <label v-else-if="field.type === 'boolean'" class="switch-row" :for="`fm-${field.name}`">
        <span class="switch" :class="{ on: asBool(modelValue[field.name]) }">
          <input
            :id="`fm-${field.name}`"
            class="switch-input"
            type="checkbox"
            :checked="asBool(modelValue[field.name])"
            @change="set(field.name, onCheck($event))"
          />
          <span class="knob" />
        </span>
        <span class="switch-value">{{ asBool(modelValue[field.name]) ? "Yes" : "No" }}</span>
      </label>

      <input
        v-else-if="field.type === 'string[]'"
        :id="`fm-${field.name}`"
        type="text"
        placeholder="comma, separated"
        :value="asStringArray(modelValue[field.name]).join(', ')"
        @input="setTags(field.name, onInput($event))"
      />

      <div v-else-if="field.type === 'enum[]'" class="chip-group" role="group" :aria-label="field.label">
        <button
          v-for="opt in field.options ?? []"
          :key="opt"
          type="button"
          class="toggle-chip"
          :class="{ active: asStringArray(modelValue[field.name]).includes(opt) }"
          :aria-pressed="asStringArray(modelValue[field.name]).includes(opt)"
          @click="toggleEnum(field.name, opt)"
        >
          {{ opt }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.form {
  display: grid;
  gap: 1.1rem;
}

.req {
  color: var(--danger);
  margin-left: 0.15rem;
}

.switch-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  cursor: pointer;
  padding: 0.1rem 0;
}

.switch {
  position: relative;
  display: inline-block;
  width: 38px;
  height: 22px;
  border-radius: 999px;
  background: var(--fill-strong);
  transition: background-color var(--slow) var(--ease);
}

.switch.on {
  background: var(--accent);
}

.switch-input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  opacity: 0;
  cursor: pointer;
}

.knob {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--raised);
  box-shadow: var(--shadow-low);
  transition: transform var(--slow) var(--ease);
  pointer-events: none;
}

.switch.on .knob {
  transform: translateX(16px);
}

.switch-value {
  font-size: 0.875rem;
  color: var(--ink-muted);
}

.chip-group {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.toggle-chip {
  padding: 0.28rem 0.75rem;
  border-radius: 999px;
  border-color: var(--separator);
  background: transparent;
  box-shadow: none;
  font-size: 0.8125rem;
  font-weight: 400;
  color: var(--ink-soft);
}

.toggle-chip:hover:not(:disabled) {
  box-shadow: none;
}

.toggle-chip.active {
  background: var(--accent-soft);
  border-color: transparent;
  color: var(--accent);
  font-weight: 500;
}
</style>
