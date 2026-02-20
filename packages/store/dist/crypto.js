import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
const ALGORITHM = "aes-256-gcm";
const IV_SIZE = 12;
const TAG_SIZE = 16;
export function encryptJson(value, key) {
    const iv = randomBytes(IV_SIZE);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const input = Buffer.from(JSON.stringify(value), "utf8");
    const ciphertext = Buffer.concat([cipher.update(input), cipher.final()]);
    const tag = cipher.getAuthTag();
    return {
        iv: iv.toString("base64"),
        tag: tag.toString("base64"),
        ciphertext: ciphertext.toString("base64")
    };
}
export function decryptJson(blob, key) {
    const iv = Buffer.from(blob.iv, "base64");
    const tag = Buffer.from(blob.tag, "base64");
    const ciphertext = Buffer.from(blob.ciphertext, "base64");
    if (iv.length !== IV_SIZE || tag.length !== TAG_SIZE) {
        throw new Error("Invalid encrypted payload shape");
    }
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return JSON.parse(plaintext.toString("utf8"));
}
//# sourceMappingURL=crypto.js.map