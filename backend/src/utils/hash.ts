import { createHash } from "crypto";

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function computeQueryHash(query: string, source: string): string {
  return sha256(`${source}::${query.toLowerCase().trim()}`);
}
