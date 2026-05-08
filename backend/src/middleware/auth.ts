import { NextFunction, Request, Response } from "express";
import { auth } from "../firebase.js";

export interface AuthedRequest extends Request {
  userId?: string;
}

export async function requireAuth(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing bearer token." });
  }

  const token = header.replace("Bearer ", "");

  try {
    const decoded = await auth.verifyIdToken(token);
    req.userId = decoded.uid;
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid token." });
  }
}
