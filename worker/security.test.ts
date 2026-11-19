import { describe, expect, it } from "vitest";
import { isPrivateAddress } from "./index";

describe("SSRF destination checks", () => {
  it.each(["localhost", "127.0.0.1", "10.0.0.8", "172.20.1.1", "192.168.1.4", "169.254.169.254", "100.64.0.1", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1"])("blocks private destination %s", host => {
    expect(isPrivateAddress(host)).toBe(true);
  });

  it.each(["1.1.1.1", "8.8.8.8", "2606:4700:4700::1111"])("allows public address %s", host => {
    expect(isPrivateAddress(host)).toBe(false);
  });
});