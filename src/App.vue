<script setup lang="ts">
import { onBeforeUnmount, onMounted } from "vue";
import { useRouter } from "vue-router";
import ToastStack from "@/components/ToastStack.vue";
import { logout } from "@/stores/auth";
import { notify } from "@/stores/toasts";

const router = useRouter();

function onUnauthorized(): void {
  logout();
  notify("GitHub rejected your token. Sign in again to keep writing.", "error");
  void router.push("/login");
}

onMounted(() => window.addEventListener("writeshare:unauthorized", onUnauthorized));
onBeforeUnmount(() => window.removeEventListener("writeshare:unauthorized", onUnauthorized));
</script>

<template>
  <router-view />
  <ToastStack />
</template>
