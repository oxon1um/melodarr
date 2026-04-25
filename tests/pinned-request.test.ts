import { describe, expect, it, vi } from "vitest";

const httpRequestMock = vi.fn();
const httpsRequestMock = vi.fn();

vi.mock("node:http", () => ({
  request: httpRequestMock,
}));

vi.mock("node:https", () => ({
  request: httpsRequestMock,
}));

describe("requestPinnedUrl", () => {
  it("rejects cleanly when called with an already aborted signal", async () => {
    const errorHandlers: Array<(error: Error) => void> = [];
    const closeHandlers: Array<() => void> = [];
    const destroyMock = vi.fn((error?: Error) => {
      if (error) {
        for (const handler of errorHandlers) {
          handler(error);
        }
      }

      for (const handler of closeHandlers) {
        handler();
      }
    });

    httpsRequestMock.mockImplementation(() => ({
      destroy: destroyMock,
      end: vi.fn(),
      on(event: string, handler: (error?: Error) => void) {
        if (event === "error") {
          errorHandlers.push(handler as (error: Error) => void);
        }

        if (event === "close") {
          closeHandlers.push(handler as () => void);
        }

        return this;
      },
    }));

    const { requestPinnedUrl } = await import("../lib/http/pinned-request");
    const controller = new AbortController();
    controller.abort();

    await expect(
      requestPinnedUrl(
        new URL("https://images.example/cover.jpg"),
        { address: "93.184.216.34", family: 4 },
        { signal: controller.signal },
      ),
    ).rejects.toMatchObject({ message: "Image request timed out", status: 504 });

    expect(destroyMock).toHaveBeenCalledTimes(1);
  });
});
