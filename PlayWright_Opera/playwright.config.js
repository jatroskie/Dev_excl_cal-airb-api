import { defineConfig } from '@playwright/test';

export default defineConfig({
  use: {
    headless: true,
    trace: 'on-first-retry', // or 'on', or 'retain-on-failure' or 'on'
    // ... other configurations
  },
  // ... other configurations
});