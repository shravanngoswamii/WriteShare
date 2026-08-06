<script setup lang="ts">
import { onBeforeUnmount, onMounted } from "vue";
import { useRouter } from "vue-router";
import { logout } from "@/stores/auth";

const router = useRouter();

function onUnauthorized(): void {
  logout();
  void router.push("/login");
}

onMounted(() => window.addEventListener("writeshare:unauthorized", onUnauthorized));
onBeforeUnmount(() => window.removeEventListener("writeshare:unauthorized", onUnauthorized));
</script>

<template>
  <router-view />
</template>
