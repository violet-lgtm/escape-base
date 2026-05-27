import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Project Pages serve under /<repo>/; set PAGES_BASE in the deploy workflow.
  base: process.env.PAGES_BASE ?? '/',
  plugins: [react()],
});
