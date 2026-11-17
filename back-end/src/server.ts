import { loadEnv } from "./config/env.js";
import { logger } from "./config/logger.js";
import { connectDatabase } from "./config/database.js";
import { createApp } from "./app.js";

try {
  const env = loadEnv();
  const connection = await connectDatabase(env.MONGODB_URI);
  const { app, mailer, uploads, billing } = await createApp(connection, env);
  billing.paddle?.start();
  const server = app.listen(env.PORT, env.HOST, () =>
    logger.info({ port: env.PORT }, "Clipvelto API is ready"),
  );
  server.on("error", () => {
    logger.error("API could not listen on the configured port");
    void connection.close().finally(() => process.exit(1));
  });
  let stopping = false;
  const shutdown = () => {
    if (stopping) return;
    stopping = true;
    const deadline = setTimeout(() => process.exit(1), 20000).unref();
    server.close(() => {
      void mailer
        .drain()
        .then(() => billing.paddle?.close())
        .then(() => uploads?.close())
        .then(() => connection.close())
        .finally(() => {
          clearTimeout(deadline);
          process.exit(0);
        });
    });
    server.closeIdleConnections();
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
} catch (error) {
  logger.error(
    { errorType: error instanceof Error ? error.name : "UnknownError" },
    "API startup failed. Check MongoDB and backend configuration; see README.md.",
  );
  process.exitCode = 1;
}
