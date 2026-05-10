import { describe, expect, it, vi } from "vitest";

import { validateMutationRequest } from "../lib/http/mutation-guard";

vi.mock("@/lib/runtime/app-config", () => ({
  getEffectiveAppUrl: vi.fn(async () => "https://melodarr.example.com")
}));

const request = (input: { method: string; headers?: Record<string, string> }) => ({
  method: input.method,
  headers: new Headers(input.headers)
});

describe("validateMutationRequest", () => {
  it("allows safe methods", async () => {
    await expect(validateMutationRequest(request({ method: "GET" }))).resolves.toBeNull();
  });

  it("allows same-origin browser mutations", async () => {
    await expect(
      validateMutationRequest(request({
        method: "POST",
        headers: {
          origin: "https://melodarr.example.com",
          "sec-fetch-site": "same-origin"
        }
      }))
    ).resolves.toBeNull();
  });

  it("allows non-browser clients that omit origin and fetch metadata", async () => {
    await expect(validateMutationRequest(request({ method: "PATCH" }))).resolves.toBeNull();
  });

  it("rejects explicit cross-site browser mutations", async () => {
    const response = await validateMutationRequest(request({
      method: "DELETE",
      headers: { "sec-fetch-site": "cross-site" }
    }));

    expect(response?.status).toBe(403);
  });

  it("rejects mismatched origins", async () => {
    const response = await validateMutationRequest(request({
      method: "PUT",
      headers: { origin: "https://evil.example.com" }
    }));

    expect(response?.status).toBe(403);
  });
});
