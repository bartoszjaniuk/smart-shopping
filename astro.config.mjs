// @ts-check
import { defineConfig } from "astro/config";

import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import node from "@astrojs/node";
import AstroPWA from "@vite-pwa/astro";

// https://astro.build/config
export default defineConfig({
  output: "server",
  integrations: [
    react(),
    sitemap(),
    AstroPWA({
      mode: "development",
      base: "/",
      scope: "/",
      includeAssets: [],
      registerType: "autoUpdate",
      strategies: "generateSW",
      devOptions: {
        type: "module",
        enabled: true,
        suppressWarnings: true,
        navigateFallbackAllowlist: [/^\/$/],
      },
      manifest: {
        id: "/",
        name: "SmartShopping",
        short_name: "SmartShopping",
        description: "SmartShopping to PWA do tworzenia i współdzielenia list zakupów z offline i AI kategoryzacją.",
        start_url: "/",
        scope: "/",
        display: "standalone",
        display_override: ["standalone", "browser"],
        orientation: "portrait",
        background_color: "#020817",
        theme_color: "#22c55e",
        categories: ["shopping", "productivity"],
        icons: [
          {
            src: "/pwa/icon-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/pwa/icon-256x256.png",
            sizes: "256x256",
            type: "image/png",
          },
          {
            src: "/pwa/icon-384x384.png",
            sizes: "384x384",
            type: "image/png",
          },
          {
            src: "/pwa/icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/pwa/maskable-icon-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "maskable",
          },
          {
            src: "/pwa/maskable-icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
          {
            src: "/pwa/monochrome-icon-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "monochrome",
          },
        ],
        screenshots: [
          {
            src: "/pwa/screenshot-mobile.png",
            sizes: "1080x1920",
            type: "image/png",
            form_factor: "narrow",
          },
          {
            src: "/pwa/screenshot-desktop.png",
            sizes: "1920x1080",
            type: "image/png",
            form_factor: "wide",
          },
        ],
      },
    }),
  ],
  server: { port: 3000 },
  vite: {
    plugins: [tailwindcss()],
  },
  adapter: node({
    mode: "standalone",
  }),
});
