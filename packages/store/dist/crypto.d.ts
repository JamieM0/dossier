export type EncryptedBlob = {
    iv: string;
    tag: string;
    ciphertext: string;
};
export declare function encryptJson<T>(value: T, key: Buffer): EncryptedBlob;
export declare function decryptJson<T>(blob: EncryptedBlob, key: Buffer): T;
//# sourceMappingURL=crypto.d.ts.map