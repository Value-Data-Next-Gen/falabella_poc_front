import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Vitest config separado del vite.config.ts del app para no contaminar el
// build. Comparte el plugin de React para que JSX/TSX se procese igual.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./__tests__/setup.ts'],
    include: ['__tests__/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/types/api.ts', 'src/**/*.d.ts'],
    },
  },
});
