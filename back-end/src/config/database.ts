import mongoose from "mongoose";

export async function connectDatabase(uri: string) {
  const connection = await mongoose
    .createConnection(uri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 10000,
      socketTimeoutMS: 15000,
      maxPoolSize: 10,
      bufferCommands: false,
    })
    .asPromise();
  // Authentication writes and password reset revocations must be transactional.
  const topology = await connection.db!.admin().command({ hello: 1 });
  if (!topology.setName && topology.msg !== "isdbgrid") {
    await connection.close();
    throw new Error(
      "Clipvelto requires a MongoDB replica set or sharded cluster. Use npm run dev:database locally.",
    );
  }
  return connection;
}
