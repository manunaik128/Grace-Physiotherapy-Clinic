import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { getDb } from './db.ts';

const IN_MEMORY_SESSION_SECRET = crypto.randomBytes(32).toString('hex');

function getSessionSecret(): string {
  const envSecret = process.env.SESSION_SECRET?.trim();
  return envSecret && envSecret.length >= 16 ? envSecret : IN_MEMORY_SESSION_SECRET;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  if (!salt || !keyHex) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const keyBuf = Buffer.from(keyHex, 'hex');
  if (derived.length !== keyBuf.length) return false;
  return crypto.timingSafeEqual(derived, keyBuf);
}

export interface AdminSessionPayload {
  kind?: 'admin';
  id: number;
  email: string;
  name: string;
  role: 'super_admin' | 'staff';
  exp: number;
}

export function signAdminToken(payload: Omit<AdminSessionPayload, 'exp' | 'kind'>): string {
  const fullPayload: AdminSessionPayload = {
    kind: 'admin',
    ...payload,
    exp: Date.now() + 12 * 60 * 60 * 1000,
  };
  const encoded = Buffer.from(JSON.stringify(fullPayload), 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifyAdminToken(token: string): AdminSessionPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  if (!encoded || !sig) return null;
  const expectedSig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(encoded)
    .digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;

  try {
    const parsed = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf8')
    ) as AdminSessionPayload & { kind?: string };
    if (
      !parsed ||
      parsed.kind !== 'admin' ||
      typeof parsed.exp !== 'number' ||
      parsed.exp < Date.now()
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export interface PatientSessionPayload {
  kind: 'patient';
  accountId: number;
  patientId: number;
  name: string;
  phone: string;
  phoneLast10: string;
  email: string;
  exp: number;
}

export function signPatientToken(payload: Omit<PatientSessionPayload, 'exp' | 'kind'>): string {
  const fullPayload: PatientSessionPayload = {
    kind: 'patient',
    ...payload,
    exp: Date.now() + 24 * 60 * 60 * 1000,
  };
  const encoded = Buffer.from(JSON.stringify(fullPayload), 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifyPatientToken(token: string): PatientSessionPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  if (!encoded || !sig) return null;
  const expectedSig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(encoded)
    .digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;

  try {
    const parsed = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf8')
    ) as PatientSessionPayload;
    if (
      !parsed ||
      parsed.kind !== 'patient' ||
      typeof parsed.exp !== 'number' ||
      parsed.exp < Date.now()
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function isEnvPasscodeConfigured(): boolean {
  const p = process.env.ADMIN_PASSCODE?.trim();
  return Boolean(p && p.length > 0);
}

export function verifyEnvPasscode(candidate: string): boolean {
  const configured = process.env.ADMIN_PASSCODE?.trim();
  if (!configured) return false;
  const a = Buffer.from(candidate);
  const b = Buffer.from(configured);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function hasClaimedAdminAccount(): boolean {
  const db = getDb();
  const row = db.prepare('SELECT COUNT(*) as count FROM admins').get() as { count: number };
  return row.count > 0;
}

export interface AuthenticatedAdminRequest extends Request {
  admin?: AdminSessionPayload;
}

export interface AuthenticatedPatientRequest extends Request {
  patient?: PatientSessionPayload;
}

export function requireAdmin(
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  const token = authHeader.slice('Bearer '.length).trim();
  const payload = verifyAdminToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Session expired or invalid. Please sign in again.' });
    return;
  }
  req.admin = payload;
  next();
}

export function requirePatient(
  req: AuthenticatedPatientRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Patient authentication required.' });
    return;
  }
  const token = authHeader.slice('Bearer '.length).trim();
  const payload = verifyPatientToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Session expired or invalid. Please sign in again.' });
    return;
  }
  req.patient = payload;
  next();
}

export function requireSuperAdmin(
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.admin || req.admin.role !== 'super_admin') {
    res.status(403).json({ error: 'Super administrator privileges required.' });
    return;
  }
  next();
}
