import type { RequestHandler } from "express";
import { fromNodeHeaders } from "better-auth/node";
import type { Auth } from "../modules/auth/auth.js";

export function requireSession(auth: Auth): RequestHandler {
  return async (req, res, next) => {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    if (!session) {
      res.status(401).json({
        error: { code: "UNAUTHORIZED", message: "Sign in to continue." },
      });
      return;
    }
    if (!session.user.emailVerified) {
      res.status(403).json({
        error: {
          code: "EMAIL_NOT_VERIFIED",
          message: "Verify your email to continue.",
        },
      });
      return;
    }
    res.locals.session = session;
    next();
  };
}
