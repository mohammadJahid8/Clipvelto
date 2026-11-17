// Used by the official image only when the database volume is empty.
db.getSiblingDB("clipvelto").createUser({
  user: process.env.MONGO_APP_USERNAME,
  pwd: process.env.MONGO_APP_PASSWORD,
  roles: [{ role: "readWrite", db: "clipvelto" }],
});
