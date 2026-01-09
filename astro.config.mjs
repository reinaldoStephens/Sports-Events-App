// @ts-check
import { defineConfig } from 'astro/config';

import vercel from '@astrojs/vercel';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  adapter: vercel({
    // Configuración explícita para Vercel serverless
    webAnalytics: {
      enabled: false
    }
  }),
  output: 'server',

  vite: {
    plugins: [tailwindcss()]
  }
});