import { afterEach, describe, expect, it, vi } from "vitest";
import { sendRequest } from "./request";

afterEach(() => vi.unstubAllGlobals());

describe("authenticated API proxy requests", () => {
  it("sends the Supabase access token to the Worker and does not fall back when the proxy is disabled", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({
      error: "The secure request gateway is not available."
    }), { status: 503, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(sendRequest({
      method: "GET",
      url: "https://api.example.com/items",
      headers: [{ id: "h1", key: "Accept", value: "application/json", enabled: true }],
      body: ""
    }, undefined, [], "test-access-token")).rejects.toThrow("The secure request gateway is not available.");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/proxy");
    expect(fetchMock.mock.calls[0][1].headers).toMatchObject({
      authorization: "Bearer test-access-token",
      "content-type": "application/json"
    });
  });

  it("rejects missing access tokens before making a proxy request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(sendRequest({
      method: "GET", url: "https://api.example.com",
      headers: [], body: ""
    })).rejects.toThrow(/Sign in/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("surfaces rate-limit errors without retrying a direct browser request", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({
      error: "Rate limit exceeded."
    }), { status: 429, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(sendRequest({
      method: "GET", url: "https://api.example.com",
      headers: [], body: ""
    }, undefined, [], "test-access-token")).rejects.toThrow("Rate limit exceeded.");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("sends text form-data fields through the authenticated gateway as JSON", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({
      status: 200, statusText: "OK", duration: 0, size: 2, headers: {}, body: "ok"
    }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    await sendRequest({
      method: "POST",
      url: "https://api.example.com/upload",
      headers: [{ id: "h1", key: "Content-Type", value: "application/json", enabled: true }],
      body: JSON.stringify([{ key: "title", value: "DevLens" }]),
      bodyType: "formdata"
    }, undefined, [], "test-access-token");

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(init.body))).toMatchObject({
      bodyType: "formdata",
      body: JSON.stringify([{ key: "title", value: "DevLens" }])
    });
    expect(init.headers).toMatchObject({ authorization: "Bearer test-access-token" });
  });

  it("sends selected files directly from the browser as multipart fields", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("uploaded", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const file = new File(["hello"], "hello.txt", { type: "text/plain" });
    await sendRequest({
      method: "POST", url: "https://api.example.com/upload", headers: [],
      body: JSON.stringify([{ key: "title", value: "DevLens" }]), bodyType: "formdata"
    }, undefined, [{ key: "attachment", file }]);
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.body as FormData).get("title")).toBe("DevLens");
    expect((init.body as FormData).get("attachment")).toBeInstanceOf(File);
    expect(new Headers(init.headers).has("content-type")).toBe(false);
  });

  it("rejects multipart uploads larger than the browser-mode limit", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const file = new File([new Uint8Array(10 * 1024 * 1024 + 1)], "large.bin");
    await expect(sendRequest({
      method: "POST", url: "https://api.example.com/upload", headers: [],
      body: "[]", bodyType: "formdata"
    }, undefined, [{ key: "file", file }])).rejects.toThrow(/10 MB/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
