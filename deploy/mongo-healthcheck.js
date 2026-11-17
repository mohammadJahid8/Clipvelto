try {
  const username = encodeURIComponent(process.env.MONGO_INITDB_ROOT_USERNAME);
  const password = encodeURIComponent(process.env.MONGO_INITDB_ROOT_PASSWORD);
  const admin = new Mongo(`mongodb://${username}:${password}@127.0.0.1:27017/admin?directConnection=true&serverSelectionTimeoutMS=2000`).getDB("admin");
  quit(admin.runCommand({ hello: 1 }).isWritablePrimary ? 0 : 1);
} catch {
  quit(1);
}
