import { describe, expect, it } from "vitest";
import { createUuid, decodeUrl, encodeUrl, fromBase64, inspectJwt, prettyJson, redactUrl, safePublicCollection, safeSavedHeaders, toBase64 } from "./utilities";

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


describe("sensitive request data handling", () => {
  it("redacts secret query parameters before adding a URL to history", () => {
    expect(redactUrl("https://api.example.com/items?api_key=private&page=2")).toBe("https://api.example.com/items?api_key=%5BREDACTED%5D&page=2");
  });
  it("does not persist credential headers in saved request definitions", () => {
    expect(safeSavedHeaders([
      { key: "Authorization", value: "Bearer private", enabled: true },
      { key: "Accept", value: "application/json", enabled: true }
    ])).toEqual([{ key: "Accept", value: "application/json", enabled: true }]);
  });
});

describe("public snapshot data minimization", () => {
  it("omits environments, history and personal account fields", () => {
    expect(safePublicCollection({
      title: "Example",
      environments: [{ name: "production", variables: { API_URL: "https://private.example" } }],
      request_history: [{ url: "https://private.example" }],
      owner_id: "internal-user-id",
      email: "private@example.com"
    })).toEqual({ title: "Example" });
  });
  it("redacts sensitive query values and sanitizes JSON request bodies before public sharing", () => {
    expect(safePublicCollection({
      requests: [{
        url: "https://api.example.com/items?api_key=private&page=2",
        body: JSON.stringify({ name: "Public example", password: "private", nested: { access_token: "secret", ok: true } })
      }]
    })).toEqual({
      requests: [{
        url: "https://api.example.com/items?api_key=%5BREDACTED%5D&page=2",
        body: JSON.stringify({ name: "Public example", nested: { ok: true } })
      }]
    });
  });

  it("omits non-JSON request bodies from public snapshots", () => {
    expect(safePublicCollection({ requests: [{ body: "password=hunter2&token=private" }] }))
      .toEqual({ requests: [{ body: "" }] });
  });

});
