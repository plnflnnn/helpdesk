// Vercel serverless function serving the API and webhooks (see vercel.json). The server is
// compiled by the build command first, which also rewrites its `@/` imports.
export { default } from '../server/dist/src/vercel.js';
