import { loadEnv } from "../src/config/env.js";
import { connectDatabase } from "../src/config/database.js";
import { createCreditService } from "../src/modules/credits/credit-service.js";
const email = process.argv[2]?.trim().toLowerCase();
if (!email || !email.includes("@"))
  throw new Error(
    "Usage: npm run admin:grant --workspace @clipvelto/api -- account@example.com",
  );
const connection = await connectDatabase(loadEnv().MONGODB_URI);
try {
  const user = await connection
    .collection("user")
    .findOne({ email, emailVerified: true });
  if (!user) throw new Error("No verified account matches that email.");
  const id = String(user._id),
    credits = createCreditService(connection);
  await credits.init();
  await credits.account(id);
  await credits.Account.updateOne({ _id: id }, { $set: { role: "admin" } });
  await connection
    .collection("admin_audit")
    .insertOne({
      userId: id,
      action: "grant_admin",
      actor: "local-console",
      createdAt: new Date(),
    });
  console.log(
    "Administrator access granted to the verified account. Free-credit restrictions do not apply.",
  );
} finally {
  await connection.close();
}
