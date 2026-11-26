// Vercel serverless function serving the API and webhooks (see vercel.json).
// The server is compiled first by the build command.
export { app as default } from '../server/dist/src/app.js';
