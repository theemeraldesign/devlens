import { describe, expect, it } from "vitest";
import { buildOutboundBody, isPrivateAddress, isProxyEgressEnabled } from "./index";

describe("SSRF destination checks", () => {
  it.each([
    "localhost", "api.localhost", "service.internal", "router.lan",
    "127.0.0.1", "10.0.0.8", "172.16.2.4", "172.31.255.255",
    "192.168.1.4", "169.254.169.254", "100.64.0.1", "0.0.0.0",
    "224.0.0.1", "::", "::1", "fc00::1", "fd00::1", "fe80::1",
    "ff02::1", "::ffff:127.0.0.1", "192.0.2.1", "198.51.100.10",
    "203.0.113.7"
  ])("blocks private or reserved destination %s", host => {
    expect(isPrivateAddress(host)).toBe(true);
  });

  it.each([
    "1.1.1.1", "8.8.8.8", "93.184.216.34",
    "2606:4700:4700::1111", "2001:4860:4860::8888"
  ])("allows public address %s", host => {
    expect(isPrivateAddress(host)).toBe(false);
  });
});

describe("additional IPv6 special-purpose ranges", () => {
  it.each(["2001:1::1", "2001:db8::1", "2002:0808:0808::1", "3fff::1", "::ffff:127.0.0.1", "64:ff9b::7f00:1"])(
    "blocks special-purpose or translated IPv6 address %s", host => {
      expect(isPrivateAddress(host)).toBe(true);
    }
  );
  it("allows a public IPv6 address outside special-purpose ranges", () => {
    expect(isPrivateAddress("2606:4700:4700::1111")).toBe(false);
  });
});

describe("multipart form-data request bodies", () => {
  it("builds multipart fields and lets Fetch generate the boundary", async () => {
    const headers = new Headers({ "content-type": "application/json" });
    const body = buildOutboundBody("POST", "formdata", JSON.stringify([
      { key: "name", value: "DevLens" },
      { key: "tags", value: "api" },
      { key: "tags", value: "testing" }
    ]), headers);
    expect(body).toBeInstanceOf(FormData);
    expect(headers.has("content-type")).toBe(false);
    const form = body as FormData;
    expect(form.get("name")).toBe("DevLens");
    expect(form.getAll("tags")).toEqual(["api", "testing"]);
  });

  it("rejects malformed form-data input", () => {
    expect(() => buildOutboundBody("POST", "formdata", "{bad json", new Headers())).toThrow(/JSON array/);
    expect(() => buildOutboundBody("POST", "formdata", JSON.stringify([{ key: "", value: "x" }]), new Headers())).toThrow(/Each form-data field/);
  });
});

describe("proxy release gate", () => {
  it("keeps outbound proxy disabled unless explicitly enabled", () => {
    expect(isProxyEgressEnabled(undefined)).toBe(false);
    expect(isProxyEgressEnabled("false")).toBe(false);
    expect(isProxyEgressEnabled("TRUE")).toBe(false);
    expect(isProxyEgressEnabled("true")).toBe(true);
  });
});
