import { beforeEach, describe, expect, it, vi } from "vitest";
import { Readable } from "node:stream";
import { NextRequest } from "next/server";

const verifySignedImageParams = vi.fn();
const lookupMock = vi.fn();
const httpRequestMock = vi.fn();
const httpsRequestMock = vi.fn();
const getRuntimeConfigMock = vi.fn();

vi.mock("node:dns/promises", () => ({
  lookup: lookupMock
}));

vi.mock("node:http", () => ({
  request: httpRequestMock
}));

vi.mock("node:https", () => ({
  request: httpsRequestMock
}));

vi.mock("@/lib/images", () => ({
  verifySignedImageParams
}));

vi.mock("@/lib/settings/store", () => ({
  getRuntimeConfig: getRuntimeConfigMock
}));

const createUpstreamResponse = (
  body: string,
  init: { headers: Record<string, string>; status: number }
) => {
  const response = Readable.from([Buffer.from(body)]) as Readable & {
    headers: Record<string, string>;
    statusCode: number;
  };
  response.headers = init.headers;
  response.statusCode = init.status;
  return response;
};

type MockUpstreamResponse = Readable & {
  headers: Record<string, string>;
  statusCode: number;
};

type LookupAssertion = {
  address: string;
  family: number;
  hostname: string;
};

type LookupCallback = (error: Error | null, address: string, family: number) => void;
type RequestLookup = (hostname: string, options: object, callback: LookupCallback) => void;
type RequestOptions = { lookup?: RequestLookup };
type ResponseHandler = (response: MockUpstreamResponse) => void;
type RequestEventHandler = (...args: unknown[]) => void;

const createRequestMock = (options: {
  assertLookup?: LookupAssertion;
  error?: Error;
  response?: MockUpstreamResponse;
}) => {
  return vi.fn((requestOptions: RequestOptions, onResponse: ResponseHandler) => {
    const handlers = new Map<string, RequestEventHandler[]>();

    const emit = (event: string, ...args: unknown[]) => {
      for (const handler of handlers.get(event) ?? []) {
        handler(...args);
      }
    };

    const request = {
      destroy(error?: Error) {
        if (error) {
          emit("error", error);
        }
        emit("close");
      },
      end() {
        if (options.error) {
          emit("error", options.error);
          emit("close");
          return;
        }

        if (options.assertLookup) {
          requestOptions.lookup?.(
            options.assertLookup.hostname,
            {},
            (error: Error | null, address: string, family: number) => {
              expect(error).toBeNull();
              expect(address).toBe(options.assertLookup?.address);
              expect(family).toBe(options.assertLookup?.family);
            }
          );
        }

        if (options.response) {
          onResponse(options.response);
        }

        emit("close");
      },
      on(event: string, handler: RequestEventHandler) {
        const currentHandlers = handlers.get(event) ?? [];
        currentHandlers.push(handler);
        handlers.set(event, currentHandlers);
        return request;
      }
    };

    return request;
  });
};

describe("GET /api/image", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    getRuntimeConfigMock.mockResolvedValue({
      lidarrUrl: null,
      jellyfinUrl: null
    });
    lookupMock.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
    httpRequestMock.mockImplementation(
      createRequestMock({
        response: createUpstreamResponse("image-bytes", {
          status: 200,
          headers: { "content-type": "image/jpeg" }
        })
      })
    );
    httpsRequestMock.mockImplementation(
      createRequestMock({
        assertLookup: {
          hostname: "images.example",
          address: "93.184.216.34",
          family: 4
        },
        response: createUpstreamResponse("image-bytes", {
          status: 200,
          headers: { "content-type": "image/jpeg" }
        })
      })
    );
  });

  it("proxies a valid signed image through a pinned upstream address", async () => {
    verifySignedImageParams.mockResolvedValue("https://images.example/stromae.jpg");

    const { GET } = await import("../app/api/image/route");
    const request = new NextRequest("http://localhost:3000/api/image?src=ok&exp=1&sig=ok");
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(httpsRequestMock).toHaveBeenCalledWith(
      expect.objectContaining({
        agent: false,
        hostname: "images.example",
        method: "GET",
        path: "/stromae.jpg",
      }),
      expect.any(Function)
    );
    expect(await response.text()).toBe("image-bytes");
  });

  it("rejects unsafe private image sources", async () => {
    verifySignedImageParams.mockResolvedValue("http://127.0.0.1:8080/private.jpg");

    const { GET } = await import("../app/api/image/route");
    const request = new NextRequest("http://localhost:3000/api/image?src=ok&exp=1&sig=ok");
    const response = await GET(request);

    expect(response.status).toBe(400);
    expect(httpRequestMock).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({ error: "Invalid image source" });
  });

  it("rejects image sources that resolve to a private IP", async () => {
    verifySignedImageParams.mockResolvedValue("https://images.example/private-by-dns.jpg");
    lookupMock.mockResolvedValue([{ address: "127.0.0.1", family: 4 }]);

    const { GET } = await import("../app/api/image/route");
    const request = new NextRequest("http://localhost:3000/api/image?src=ok&exp=1&sig=ok");
    const response = await GET(request);

    expect(response.status).toBe(400);
    expect(httpsRequestMock).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({ error: "Invalid image source" });
  });

  it("allows private image sources from the configured Lidarr origin", async () => {
    getRuntimeConfigMock.mockResolvedValue({
      lidarrUrl: "http://lidarr:8686",
      jellyfinUrl: null
    });
    verifySignedImageParams.mockResolvedValue("http://lidarr:8686/MediaCover/1/poster.jpg");
    lookupMock.mockResolvedValue([{ address: "172.18.0.2", family: 4 }]);
    httpRequestMock.mockImplementation(
      createRequestMock({
        assertLookup: {
          hostname: "lidarr",
          address: "172.18.0.2",
          family: 4
        },
        response: createUpstreamResponse("image-bytes", {
          status: 200,
          headers: { "content-type": "image/jpeg" }
        })
      })
    );

    const { GET } = await import("../app/api/image/route");
    const request = new NextRequest("http://localhost:3000/api/image?src=ok&exp=1&sig=ok");
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(httpRequestMock).toHaveBeenCalledWith(
      expect.objectContaining({
        hostname: "lidarr",
        method: "GET",
        path: "/MediaCover/1/poster.jpg",
        port: 8686,
      }),
      expect.any(Function)
    );
    expect(await response.text()).toBe("image-bytes");
  });

  it("rejects direct IPv4-mapped IPv6 loopback image sources", async () => {
    verifySignedImageParams.mockResolvedValue("http://[::ffff:7f00:1]/private.jpg");

    const { GET } = await import("../app/api/image/route");
    const request = new NextRequest("http://localhost:3000/api/image?src=ok&exp=1&sig=ok");
    const response = await GET(request);

    expect(response.status).toBe(400);
    expect(httpRequestMock).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({ error: "Invalid image source" });
  });

  it("rejects fully expanded IPv6 loopback image sources", async () => {
    verifySignedImageParams.mockResolvedValue("http://[0:0:0:0:0:0:0:1]/private.jpg");

    const { GET } = await import("../app/api/image/route");
    const request = new NextRequest("http://localhost:3000/api/image?src=ok&exp=1&sig=ok");
    const response = await GET(request);

    expect(response.status).toBe(400);
    expect(httpRequestMock).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({ error: "Invalid image source" });
  });

  it("rejects image sources that resolve to an unsafe IPv6 address", async () => {
    verifySignedImageParams.mockResolvedValue("https://images.example/private-by-ipv6.jpg");
    lookupMock.mockResolvedValue([{ address: "::ffff:7f00:1", family: 6 }]);

    const { GET } = await import("../app/api/image/route");
    const request = new NextRequest("http://localhost:3000/api/image?src=ok&exp=1&sig=ok");
    const response = await GET(request);

    expect(response.status).toBe(400);
    expect(httpsRequestMock).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({ error: "Invalid image source" });
  });

  it("times out stalled DNS resolution within the image request deadline", async () => {
    vi.useFakeTimers();
    verifySignedImageParams.mockResolvedValue("https://images.example/stalled-dns.jpg");
    lookupMock.mockImplementation(
      () => new Promise(() => undefined)
    );

    const timeoutSpy = vi.spyOn(AbortSignal, "timeout").mockImplementation((delay) => {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), delay);
      return controller.signal;
    });

    const { GET } = await import("../app/api/image/route");
    const request = new NextRequest("http://localhost:3000/api/image?src=ok&exp=1&sig=ok");
    const responsePromise = GET(request);

    await vi.advanceTimersByTimeAsync(5_000);

    const response = await responsePromise;

    expect(response.status).toBe(504);
    expect(httpsRequestMock).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({ error: "Failed to load image" });

    timeoutSpy.mockRestore();
  });

  it("rejects non-image upstream responses", async () => {
    verifySignedImageParams.mockResolvedValue("https://images.example/not-an-image");
    httpsRequestMock.mockImplementation(
      createRequestMock({
        response: createUpstreamResponse("html", {
          status: 200,
          headers: { "content-type": "text/html; charset=utf-8" }
        })
      })
    );

    const { GET } = await import("../app/api/image/route");
    const request = new NextRequest("http://localhost:3000/api/image?src=ok&exp=1&sig=ok");
    const response = await GET(request);

    expect(response.status).toBe(415);
    await expect(response.json()).resolves.toEqual({ error: "Invalid upstream image response" });
  });

  it("hides upstream fetch errors from clients", async () => {
    verifySignedImageParams.mockResolvedValue("https://images.example/failure.jpg");
    httpsRequestMock.mockImplementation(
      createRequestMock({ error: new Error("socket hang up") })
    );

    const { GET } = await import("../app/api/image/route");
    const request = new NextRequest("http://localhost:3000/api/image?src=ok&exp=1&sig=ok");
    const response = await GET(request);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Failed to load image" });
  });
});
