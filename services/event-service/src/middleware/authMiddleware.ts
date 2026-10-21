
import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";

type AuthenticatedUser = {
  id: string;
  role: "USER" | "ADMIN";
};

export type AuthenticatedRequest = Request & {
  authUser?: {
    id: string;
    role: "USER" | "ADMIN";
  };
};

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error(
      "JWT_SECRET must be configured with at least 32 characters"
    );
  }

  return secret;
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  let userId: string;

  const authorization = req.headers.authorization;
  const [scheme, token, ...extra] = authorization?.split(" ") ?? [];

  if (
    scheme?.toLowerCase() !== "bearer" ||
    !token ||
    extra.length > 0
  ) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }

  try {
    const payload = jwt.verify(token, getJwtSecret(), {
      issuer: "ticketflow",
    });

    if (typeof payload === "string" || typeof payload.sub !== "string") {
      res.status(401).json({ message: "Invalid authentication token" });
      return;
    }

    userId = payload.sub;
  } catch {
    res.status(401).json({
      message: "Invalid or expired authentication token",
    });
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });

    if (!user) {
      res.status(401).json({ message: "User account not found" });
      return;
    }

    (req as AuthenticatedRequest).authUser = {
      id: user.id,
      role: user.role,
    };

    next();
  } catch (error) {
    console.error("Authentication middleware error:", error);
    res.status(500).json({ message: "Authentication check failed" });
  }
}

export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const user = (req as AuthenticatedRequest).authUser;

  if (!user) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }

  if (user.role !== "ADMIN") {
    res.status(403).json({ message: "Administrator access required" });
    return;
  }

  next();
}
