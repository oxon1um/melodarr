import { request as httpRequest, type RequestOptions } from "node:http";
import { request as httpsRequest } from "node:https";
import { Readable } from "node:stream";

export type ResolvedAddress = {
  address: string;
  family: 4 | 6;
};

type LookupCallback = (error: NodeJS.ErrnoException | null, address: string, family: number) => void;

type UpstreamResponse = {
  body: ReadableStream<Uint8Array> | null;
  headers: Headers;
  status: number;
};

const createTimeoutError = (): Error & { status: number } =>
  Object.assign(new Error("Image request timed out"), { status: 504 });

const createPinnedLookup = (resolvedAddress: ResolvedAddress) =>
  (_hostname: string, _options: object, callback: LookupCallback) => {
    callback(null, resolvedAddress.address, resolvedAddress.family);
  };

const createRequestOptions = (
  url: URL,
  resolvedAddress: ResolvedAddress,
): RequestOptions => ({
  agent: false,
  hostname: url.hostname,
  lookup: createPinnedLookup(resolvedAddress),
  method: "GET",
  path: `${url.pathname}${url.search}`,
  port: url.port ? Number.parseInt(url.port, 10) : undefined,
  protocol: url.protocol,
});

const isRedirectStatus = (status: number): boolean => status >= 300 && status < 400;

const toHeaders = (source: Record<string, string | string[] | undefined>): Headers => {
  const headers = new Headers();

  for (const [name, value] of Object.entries(source)) {
    if (typeof value === "string") {
      headers.set(name, value);
      continue;
    }

    if (Array.isArray(value) && value.length > 0) {
      headers.set(name, value.join(", "));
    }
  }

  return headers;
};

export const requestPinnedUrl = async (
  url: URL,
  resolvedAddress: ResolvedAddress,
  signal?: AbortSignal,
): Promise<UpstreamResponse> => {
  const requestImpl = url.protocol === "https:" ? httpsRequest : httpRequest;

  return new Promise<UpstreamResponse>((resolve, reject) => {
    const request = requestImpl(createRequestOptions(url, resolvedAddress), (response) => {
      const status = response.statusCode ?? 502;
      const headers = toHeaders(response.headers);

      if (isRedirectStatus(status)) {
        response.resume();
        resolve({ body: null, headers, status });
        return;
      }

      resolve({
        body: Readable.toWeb(response) as ReadableStream<Uint8Array>,
        headers,
        status,
      });
    });

    const abortRequest = () => request.destroy(createTimeoutError());

    request.on("error", (error) => {
      signal?.removeEventListener("abort", abortRequest);
      reject(error);
    });
    request.on("close", () => {
      signal?.removeEventListener("abort", abortRequest);
    });

    signal?.addEventListener("abort", abortRequest, { once: true });

    if (signal?.aborted) {
      abortRequest();
      return;
    }

    request.end();
  });
};
