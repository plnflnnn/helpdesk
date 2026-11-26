import { config } from 'dotenv';

// Loads server/.env. Imported first by every module that reads process.env at load time.
config({ quiet: true });
