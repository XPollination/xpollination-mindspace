// Main entry point — re-exports server and starts background jobs
export { app } from './server.js';
import { startLeaseExpiryJob } from './services/lease-expiry.js';

// Start lease expiry checker on import
startLeaseExpiryJob();
