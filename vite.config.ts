import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages project site is served under /<repo>/.
// Override with VITE_BASE at build time if the repo name differs.
const base = process.env.VITE_BASE ?? '/cadence/';

export default defineConfig({
  base,
  plugins: [react()],
});
