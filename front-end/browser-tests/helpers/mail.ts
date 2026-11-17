import { expect } from "@playwright/test";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const mailbox = fileURLToPath(
  new URL("../../../back-end/.local-data/browser-test-mail/", import.meta.url),
);
export async function mailCode(email: string, subject = "verification code") {
  let code = "";
  await expect
    .poll(async () => {
      const files = (await readdir(mailbox)).sort().reverse();
      for (const file of files) {
        const mail = JSON.parse(
          await readFile(join(mailbox, file), "utf8"),
        ) as { to: string; subject: string; text: string };
        if (mail.to === email && mail.subject.includes(subject)) {
          code = mail.text.match(/\b\d{6}\b/u)?.[0] ?? "";
          break;
        }
      }
      return code;
    })
    .not.toBe("");
  return code;
}
