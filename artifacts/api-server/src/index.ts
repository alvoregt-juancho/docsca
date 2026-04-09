import app from "./app";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});

// In Replit's deployed environment, external HTTPS traffic is routed to port
// 8081 (externalPort = 80 in .replit). Listen there too so the deployed API
// is reachable without editing the platform port config.
if (process.env["REPLIT_ENVIRONMENT"] === "production" && port !== 8081) {
  app.listen(8081, (err) => {
    if (err) {
      logger.warn({ err }, "Could not bind secondary port 8081");
      return;
    }
    logger.info({ port: 8081 }, "Server also listening on primary external port");
  });
}
