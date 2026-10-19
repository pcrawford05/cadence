import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const key = () => {
  const k = process.env.TOKEN_ENCRYPTION_KEY;
  if (!k) throw new Error("TOKEN_ENCRYPTION_KEY is not set");
  return createHash("sha256").update(k).digest();
};

/** AES-256-GCM; output = iv.tag.ciphertext (base64url). */
export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), ct].map((b) => b.toString("base64url")).join(".");
}

export function decrypt(blob: string): string {
  const [iv, tag, ct] = blob.split(".").map((s) => Buffer.from(s, "base64url"));
  const d = createDecipheriv("aes-256-gcm", key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(ct), d.final()]).toString("utf8");
}

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
export const newToken = () => "cad_" + randomBytes(24).toString("base64url");
