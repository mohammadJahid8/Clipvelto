import { MongoMemoryReplSet } from "mongodb-memory-server";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const directory = fileURLToPath(
  new URL("../.local-data/mongo/", import.meta.url),
);
await mkdir(directory, { recursive: true, mode: 0o700 });
const database = await MongoMemoryReplSet.create({
  binary: { version: "8.2.2" },
  instanceOpts: [{ port: 27017, dbPath: directory }],
  replSet: {
    name: "clipvelto",
    count: 1,
    storageEngine: "wiredTiger",
    ip: "127.0.0.1",
  },
});
console.log(
  "Local MongoDB replica set ready on 127.0.0.1:27017. Data persists in back-end/.local-data/mongo. Keep this terminal open. This helper is for local development only.",
);
let stopping = false;
const shutdown = async () => {
  if (stopping) return;
  stopping = true;
  await database.stop({ doCleanup: false });
  process.exit(0);
};
process.on("SIGINT", () => {
  void shutdown();
});
process.on("SIGTERM", () => {
  void shutdown();
});
