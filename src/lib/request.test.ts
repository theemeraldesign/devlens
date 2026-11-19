import { afterEach, describe, expect, it, vi } from "vitest";
import { sendRequest } from "./request";

const disabledProxy = () => new Response(JSON.stringify({
  error: "The API request proxy is temporarily disabled while secure outbound networking is configured."
}), { status: 503, headers: { "content-type": "application/json" } });

afterEach(() => vi.unstubAllGlobals());

describe("browser request fallback", () => {
  it("uses direct browser fetch only when the Worker explicitly reports its proxy is disabled", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(disabledProxy())
      .mockResolvedValueOnce(new Response('{"ok":true}', {
        status: 200,
        headers: { "content-type": "application/json", "x-request-id": "demo-1" }
      }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendRequest({
      method: "GET",
      url: "https://api.example.com/items",
      headers: [{ id: "h1", key: "Accept", value: "application/json", enabled: true }],
      body: ""
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe("https://api.example.com/items");
    expect(fetchMock.mock.calls[1][1]).toMatchObject({
      method: "GET",
      mode: "cors",
      credentials: "omit",
      referrerPolicy: "no-referrer"
    });
    expect(result.status).toBe(200);
    expect(result.body).toBe('{"ok":true}');
    expect(result.headers["x-request-id"]).toBe("demo-1");
  });

  it("does not fall back for unrelated proxy errors", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({
      error: "Rate limit exceeded."
    }), { status: 429, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(sendRequest({
      method: "GET", url: "https://api.example.com",
      headers: [], body: ""
    })).rejects.toThrow("Rate limit exceeded.");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("reports a useful CORS/network message when direct browser fetch is blocked", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(disabledProxy())
      .mockRejectedValueOnce(new TypeError("Failed to fetch"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(sendRequest({
      method: "GET", url: "https://api.example.com",
      headers: [], body: ""
    })).rejects.toThrow(/must allow CORS/);
  });

  it("builds multipart form data without setting a manual content type", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(disabledProxy())
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await sendRequest({
      method: "POST",
      url: "https://api.example.com/upload",
      headers: [{ id: "h1", key: "Content-Type", value: "application/json", enabled: true }],
      body: JSON.stringify([{ key: "title", value: "DevLens" }]),
      bodyType: "formdata"
    });

    const init = fetchMock.mock.calls[1][1] as RequestInit;
    expect(init.body).toBeInstanceOf(FormData);
    expect(new Headers(init.headers).has("content-type")).toBe(false);
  });
  it("sends selected files as multipart fields without setting a manual content type", async () => {
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
