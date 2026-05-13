import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import { getAuthUserById, loginUser, registerUser } from "../modules/auth/authModule";
import { getAuthenticatedUserId, requireAuth } from "../modules/auth/authMiddleware";

type AuthRouteDeps = {
  registerFn: typeof registerUser;
  loginFn: typeof loginUser;
  getUserByIdFn: typeof getAuthUserById;
};

export function createAuthRouter(depsInput?: Partial<AuthRouteDeps>): Router {
  const deps: AuthRouteDeps = {
    registerFn: depsInput?.registerFn ?? registerUser,
    loginFn: depsInput?.loginFn ?? loginUser,
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
