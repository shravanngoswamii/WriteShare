import { createRouter, createWebHashHistory } from "vue-router";
import { auth } from "./stores/auth";
import EditorView from "./views/EditorView.vue";
import LoginView from "./views/LoginView.vue";
import PostsView from "./views/PostsView.vue";

export const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes: [
    { path: "/", redirect: "/posts" },
    { path: "/login", component: LoginView },
    { path: "/posts", component: PostsView },
    { path: "/edit", component: EditorView },
  ],
});

router.beforeEach((to) => {
  if (!auth.token && to.path !== "/login") return "/login";
  return true;
});
