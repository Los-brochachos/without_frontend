import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      // Conserva evidencia real incluso si alguna prueba falla.
      reportOnFailure: true,
    },
  },
});
