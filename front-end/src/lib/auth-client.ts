"use client";

import { createAuthClient } from "better-auth/react";
import { emailOTPClient } from "better-auth/client/plugins";

// Same-origin requests are forwarded to Express by Next.js. Tokens stay in HttpOnly cookies.
export const authClient = createAuthClient({ basePath: "/api/auth", plugins: [emailOTPClient()] });
