import { defineConfig } from '@prisma/client';

export default defineConfig({
  datasources: {
    db: {
      url: 'file:./vat_management.db',
    },
  },
});
