import { describe, expect, it } from "vitest";
import { isPrivateAddress } from "./index";

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
