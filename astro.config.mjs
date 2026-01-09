
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // Cambiamos a 'server' para asegurar que se genere el servidor
  output: 'server',
  adapter: vercel({
    // Desactivamos funciones experimentales que podrían mover el entry.mjs de lugar
    webAnalytics: { enabled: false },
    isr: false 
  }),
  vite: {
    plugins: [tailwindcss()],
  }
});