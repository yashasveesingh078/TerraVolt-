import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [
    react(),        // lets Vite understand React (JSX)
    tailwindcss(),  // turns Tailwind classes into real CSS
  ],
  server: {
    proxy: {
      // Any request starting with /api is forwarded to the backend
      '/api': 'http://localhost:4000',
      // Uploaded photos are also served by the backend
      '/uploads': 'http://localhost:4000',
    },
  },
});