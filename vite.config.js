var _a;
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// GitHub Pages project site is served under /<repo>/.
// Override with VITE_BASE at build time if the repo name differs.
var base = (_a = process.env.VITE_BASE) !== null && _a !== void 0 ? _a : '/yield/';
export default defineConfig({
    base: base,
    plugins: [react()],
});
