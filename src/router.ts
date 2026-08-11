import { createRouter, createWebHashHistory } from "vue-router";
import AppShell from "./components/AppShell.vue";
import { auth } from "./stores/auth";
import EditorView from "./views/EditorView.vue";
import LoginView from "./views/LoginView.vue";
import PostsView from "./views/PostsView.vue";
import ReposView from "./views/ReposView.vue";
import ReviewView from "./views/ReviewView.vue";
import SettingsView from "./views/SettingsView.vue";

export const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes: [
    { path: "/login", component: LoginView },
    {
      path: "/",
      component: AppShell,
      children: [
        { path: "", redirect: "/posts" },
        { path: "posts", component: PostsView },
        { path: "edit", component: EditorView },
        { path: "review", component: ReviewView },
        { path: "settings", component: SettingsView },
        { path: "repos", component: ReposView },
        // Pre-shell link, kept so old bookmarks still land somewhere sensible.
        { path: "repo", redirect: "/settings" },
      ],
    },
  ],
});

router.beforeEach((to) => {
  if (!auth.token && to.path !== "/login") return "/login";
  return true;
});
