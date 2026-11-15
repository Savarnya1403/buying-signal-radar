import type { SignalType, SourceType } from "@prisma/client";
import type { z } from "zod";

export type ConnectorIcp = {
  productCategory: string;
  targetIndustries: string[];
  buyerRoles: string[];
  geographies: string[];
  selectedSignalTypes: string[];
};

export type RawCompany = {
  name: string;
  confidence: number;
  domain?: string | null;
  website?: string | null;
  industry?: string | null;
  location?: string | null;
  employeeCount?: number | null;
  description?: string | null;
};

export type RawDocument = {
  title: string;
  url: string;
  publishedAt: Date | null;
  summary: string;
  content?: string;
  sourceName: string;
  sourceType: SourceType;
  company: RawCompany;
  signalHints?: SignalType[];
  tags?: string[];
  metadata?: Record<string, unknown>;
};

export type ConnectorContext = {
  icp: ConnectorIcp;
  now: Date;
};

export type ConnectorResult = {
  documents: RawDocument[];
  warnings: string[];
  attribution?: string;
};

export class ConnectorUnavailableError extends Error {
  code = "CONNECTOR_UNAVAILABLE";
  constructor(message: string) {
    super(message);
    this.name = "ConnectorUnavailableError";
  }
}

export interface SourceConnector<T = unknown> {
  kind: SourceType;
  label: string;
  description: string;
  configSchema: z.ZodTypeAny;
  docs: string;
  requiresEnv?: string[];
  isConfigured?: () => boolean;
  fetch(config: T, context: ConnectorContext): Promise<ConnectorResult>;
}

export function isConnectorAvailable(connector: SourceConnector) {
  if (!connector.requiresEnv?.length) return true;
  return connector.requiresEnv.every((key) => Boolean(process.env[key]));
}
