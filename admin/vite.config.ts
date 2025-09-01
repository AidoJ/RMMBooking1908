import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  base: '/admin/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
  define: {
    // Make environment variables available to the client (using existing Netlify env vars)
    'import.meta.env.STRIPE_PUBLISHABLE_KEY': JSON.stringify(process.env.STRIPE_PUBLISHABLE_KEY),
  },
});
