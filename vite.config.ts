import { defineConfig } from 'vitest/config';

const html = (name: string): string => new URL(`./${name}`, import.meta.url).pathname;

export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      input: {
        rechner: html('index.html'),
        theorie: html('theorie.html'),
      },
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
