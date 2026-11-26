import { app } from '@/app.js';
import prisma from '@/db.js';
import { startQueue, stopQueue } from '@/lib/queue.js';
import Sentry from '@/lib/sentry.js';

const port = Number(process.env.PORT) || 4000;

async function boot() {
  await startQueue();

  const server = app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });

  const shutdown = () => {
    console.log('Shutting down...');
    server.close(() => {
      void Promise.allSettled([stopQueue(), prisma.$disconnect()]).finally(() => process.exit(0));
    });
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

boot().catch((error) => {
  Sentry.captureException(error);
  console.error('Failed to start server:', error);
  process.exit(1);
});
