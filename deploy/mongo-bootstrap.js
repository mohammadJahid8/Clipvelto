const username = encodeURIComponent(process.env.MONGO_INITDB_ROOT_USERNAME);
const password = encodeURIComponent(process.env.MONGO_INITDB_ROOT_PASSWORD);
const uri = `mongodb://${username}:${password}@mongo:27017/admin?directConnection=true&serverSelectionTimeoutMS=2000`;
let ready = false;
for (let attempt = 0; attempt < 90; attempt++) {
  try {
    const admin = new Mongo(uri).getDB("admin");
    let status;
    try {
      status = admin.runCommand({ replSetGetStatus: 1 });
    } catch (error) {
      if (error.code !== 94) throw error;
      status = { code: 94 };
    }
    if (status.code === 94) {
      admin.runCommand({
        replSetInitiate: {
          _id: "clipvelto",
          members: [{ _id: 0, host: "mongo:27017" }],
        },
      });
    } else if (status.ok !== 1) {
      throw new Error("Replica set not ready");
    }
    if (admin.runCommand({ hello: 1 }).isWritablePrimary) {
      ready = true;
      break;
    }
  } catch {
    // Authentication/initdb may still be in progress; do not print credentials.
  }
  sleep(1000);
}
if (!ready) throw new Error("Clipvelto MongoDB replica set did not become ready");
print("Clipvelto MongoDB replica set is ready");
