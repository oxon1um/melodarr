import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scrypt = promisify(scryptCb);

const KEYLEN = 64;

export const hashPassword = async (password: string): Promise<string> => {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, KEYLEN)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
};

export const verifyPassword = async (password: string, stored: string): Promise<boolean> => {
  const [salt, hashHex] = stored.split(":");
  if (!salt || !hashHex) {
    return false;
  }

  const derived = (await scrypt(password, salt, KEYLEN)) as Buffer;
  const storedHash = Buffer.from(hashHex, "hex");

  if (storedHash.length !== derived.length) {
    return false;
  }

  return timingSafeEqual(storedHash, derived);
};
