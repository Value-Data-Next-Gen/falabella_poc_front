import { defineConfig } from '@hey-api/openapi-ts'

export default defineConfig({
  input: '../backend/openapi.json',
  output: {
    path: 'src/api',
  },
  plugins: [
    '@hey-api/typescript',
    {
      name: '@hey-api/client-fetch',
      bundle: true,
    },
    '@hey-api/sdk',
  ],
})
