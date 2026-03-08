import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { getRuntimeSecret } from "@/lib/runtime/secret";

const ALGORITHM = "aes-256-gcm";

const getKey = async (): Promise<Buffer> => {
  const secret = await getRuntimeSecret();
  return createHash("sha256").update(secret).digest();
};

export const encryptText = async (plainText: string): Promise<string> => {
  const key = await getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [iv.toString("base64"), authTag.toString("base64"), encrypted.toString("base64")].join(":");
};

export const decryptText = async (encryptedText: string): Promise<string> => {
  const [ivB64, authTagB64, dataB64] = encryptedText.split(":");
  if (!ivB64 || !authTagB64 || !dataB64) {
    throw new Error("Invalid encrypted payload format");
  }

  const key = await getKey();
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(authTagB64, "base64"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final()
  ]);

  return decrypted.toString("utf8");
};
