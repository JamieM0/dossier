export type PairingSession = {
  code: string;
  createdAt: number;
  expiresAt: number;
};

export type LocalServerConfig = {
  host: string;
  port: number;
  allowedOrigins: string[];
  requiredHeaderName: string;
  requiredHeaderValue: string;
};
