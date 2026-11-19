import { describe, expect, it } from "vitest";
import { resolveEnvironmentVariables, type LocalEnvironment } from "./environments";

const environment: LocalEnvironment = {
  id: "env-1",
  name: "Development",
  updatedAt: "2026-11-19T00:00:00.000Z",
  variables: [
    { id: "var-1", key: "BASE_URL", value: "https://api.example.test", enabled: true },
    { id: "var-2", key: "DISABLED", value: "hidden", enabled: false }
  ]
};

describe("environment variable interpolation", () => {
  it("replaces enabled placeholders in URLs and text", () => {
    expect(resolveEnvironmentVariables("{{BASE_URL}}/users", environment)).toBe("https://api.example.test/users");
  });
  it("keeps unknown and disabled placeholders intact", () => {
    expect(resolveEnvironmentVariables("{{MISSING}}/{{DISABLED}}", environment)).toBe("{{MISSING}}/{{DISABLED}}");
  });
});