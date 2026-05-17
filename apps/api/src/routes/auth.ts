import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import {
  getAuthUserById,
  loginUser,
  registerUser,
  requestPasswordReset,
  resetPassword,
  verifyEmailToken,
} from "../modules/auth/authModule";
import { getAuthenticatedUserId, requireAuth } from "../modules/auth/authMiddleware";

type AuthRouteDeps = {
  registerFn: typeof registerUser;
  loginFn: typeof loginUser;
  verifyEmailFn: typeof verifyEmailToken;
  forgotPasswordFn: typeof requestPasswordReset;
  resetPasswordFn: typeof resetPassword;
  getUserByIdFn: typeof getAuthUserById;
};

export function createAuthRouter(depsInput?: Partial<AuthRouteDeps>): Router {
  const deps: AuthRouteDeps = {
    registerFn: depsInput?.registerFn ?? registerUser,
    loginFn: depsInput?.loginFn ?? loginUser,
    verifyEmailFn: depsInput?.verifyEmailFn ?? verifyEmailToken,
    forgotPasswordFn: depsInput?.forgotPasswordFn ?? requestPasswordReset,
    resetPasswordFn: depsInput?.resetPasswordFn ?? resetPassword,
    getUserByIdFn: depsInput?.getUserByIdFn ?? getAuthUserById,
  };

  const router = Router();

  router.post("/api/auth/register", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as Record<string, unknown>;
      const payload = await deps.registerFn({
        email: String(body.email ?? ""),
        password: String(body.password ?? ""),
        name: body.name != null ? String(body.name) : undefined,
      });
      res.status(201).json(payload);
    } catch (error) {
      if (error instanceof Error && (error.message === "Invalid email" || error.message === "Password must be at least 8 characters")) {
        res.status(400).json({ error: error.message });
        return;
      }
      if (error instanceof Error && error.message === "Email already in use") {
        res.status(409).json({ error: error.message });
        return;
      }
      next(error);
    }
  });

  router.post("/api/auth/login", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as Record<string, unknown>;
      const payload = await deps.loginFn({
        email: String(body.email ?? ""),
        password: String(body.password ?? ""),
      });
      res.json(payload);
    } catch (error) {
      if (error instanceof Error && (error.message === "Invalid email" || error.message === "Password must be at least 8 characters")) {
        res.status(400).json({ error: error.message });
        return;
      }
      if (error instanceof Error && error.message === "Invalid credentials") {
        res.status(401).json({ error: error.message });
        return;
      }
      if (error instanceof Error && error.message === "Please verify your email first") {
        res.status(403).json({ error: error.message });
        return;
      }
      next(error);
    }
  });

  router.get("/api/auth/verify", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = String(req.query.token ?? "");
      await deps.verifyEmailFn(token);
      if (req.accepts("json")) {
        res.json({ verified: true });
        return;
      }
      res.redirect("/login?verified=true");
    } catch (error) {
      if (error instanceof Error && error.message === "Verification token expired or invalid") {
        if (req.accepts("json")) {
          res.status(400).json({ error: error.message });
          return;
        }
        res.redirect("/login?verified=false");
        return;
      }
      if (error instanceof Error && error.message === "Invalid verification token") {
        if (req.accepts("json")) {
          res.status(400).json({ error: error.message });
          return;
        }
        res.redirect("/login?verified=false");
        return;
      }
      next(error);
    }
  });

  router.post("/api/auth/forgot-password", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as Record<string, unknown>;
      await deps.forgotPasswordFn({ email: String(body.email ?? "") });
      res.json({ ok: true });
    } catch (error) {
      if (error instanceof Error && error.message === "Invalid email") {
        res.status(400).json({ error: error.message });
        return;
      }
      next(error);
    }
  });

  router.post("/api/auth/reset-password", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as Record<string, unknown>;
      await deps.resetPasswordFn({
        token: String(body.token ?? ""),
        newPassword: String(body.newPassword ?? ""),
      });
      res.json({ ok: true });
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message === "Invalid reset token" ||
          error.message === "Reset token expired or invalid" ||
          error.message === "Password must be at least 8 characters")
      ) {
        res.status(400).json({ error: error.message });
        return;
      }
      next(error);
    }
  });

  router.get("/api/auth/me", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await deps.getUserByIdFn(getAuthenticatedUserId(req));
      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }
      res.json({ user });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
