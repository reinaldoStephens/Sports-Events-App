import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import tailwindcss from '@tailwindcss/vite';

import react from '@astrojs/react';

export default defineConfig({
  // Forzamos el modo servidor para que genere el output de Vercel
  output: 'server',

  adapter: vercel(),

  vite: {
    plugins: [tailwindcss()],
    build: {
      cssMinify: true
    }
  },

  integrations: [react()]
});