import { describe, expect, it } from "vitest";
import { createUuid, decodeUrl, encodeUrl, fromBase64, inspectJwt, prettyJson, safePublicCollection, toBase64 } from "./utilities";

describe("developer utilities", () => {
  it("formats JSON", () => expect(prettyJson('{"a":1}')).toBe('{\n  "a": 1\n}'));
  it("round-trips unicode base64", () => expect(fromBase64(toBase64("DevLens ✓"))).toBe("DevLens ✓"));
  it("round-trips URL components", () => expect(decodeUrl(encodeUrl("hello world/✓"))).toBe("hello world/✓"));
  it("creates UUIDs", () => expect(createUuid()).toMatch(/^[0-9a-f-]{36}$/i));
  it("decodes JWT payload without claiming to verify it", () => {
    const encode = (v: unknown) => btoa(JSON.stringify(v)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
    const token = [encode({ alg: "HS256" }), encode({ sub: "user-1" }), "signature"].join(".");
    expect(inspectJwt(token).payload).toEqual({ sub: "user-1" });
  });
  it("removes secret-like fields from public collection data", () => {
    expect(safePublicCollection({ name: "Demo", headers: { Authorization: "Bearer x", Accept: "application/json" }, api_key: "secret" })).toEqual({
      name: "Demo", headers: { Accept: "application/json" }
    });
  });
});

describe("public collection sanitization", () => {
  it("removes sensitive header rows from array-based headers", () => {
    expect(safePublicCollection({ headers: [
      { key: "Authorization", value: "Bearer private" },
      { key: "Accept", value: "application/json" }
    ] })).toEqual({ headers: [{ key: "Accept", value: "application/json" }] });
  });
});
