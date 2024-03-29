import merge from "lodash.merge";
import CachePolicy from "http-cache-semantics";
import Keyv from "keyv";
import debugFunction from "debug";
import retry, { Options as AsyncRetryOptions } from "async-retry";

import { URL } from "url";
import { List, Function } from "ts-toolbelt";

const debug = debugFunction("fetch-hero");

export interface CacheStoreOptions {
  shared?: boolean;
  cacheHeuristic?: number;
  immutableMinTimeToLive?: number;
  ignoreCargoCult?: boolean;
}

export type HTTPSemanticBypassingOptions = {
  // Number of seconds to cache the response
  ttl: number;
};

export type HttpCacheOptions = {
  /**
	Enables RFC 7234 and RFC 5861 HTTP caching

	@default false

	@example
	```
import nodeFetch from "node-fetch";
import fetchHero from "fetch-hero";

const fetch = fetchHero(nodeFetch, { httpCache: { enabled: true } });
	```
	*/
  enabled: boolean;
  options?: CachePolicy.Options;
  store?: string | Map<any, any>;
  storeOptions?: Record<string, any>;
  namespace?: string;
  bypass?: HTTPSemanticBypassingOptions;
};

export type RetryingOptions = {
  enabled: boolean;
  options?: AsyncRetryOptions;
  retryOn?: Array<number>;
};

export type FetchHeroOptions = {
  httpCache?: HttpCacheOptions;
  retrying?: RetryingOptions;
};

export type RequestInitFhProperties = {
  httpCache?: Partial<Omit<HttpCacheOptions, "store">>;
  retrying?: Partial<RetryingOptions>;
};

export type FetchHeroRequestInit = RequestInit & {
  fh?: RequestInitFhProperties;
};

export type FetchFunction = (
  input: RequestInfo,
  init?: FetchHeroRequestInit
) => Promise<Response>;

type CachedResponse = {
  url?: string;
  headers: CachePolicy.Headers;
  size?: number;
  status?: number;
  statusText?: string;
  body?: BodyInit;
};

type CacheEntry = {
  policy: CachePolicy.CachePolicyObject;
  response: CachedResponse;
  httpSemanticsBypass?: { ttl: number; timestamp: number };
};

export default function fetchHero(
  fetch: FetchFunction,
  options?: FetchHeroOptions
): FetchFunction {
  let cache: Keyv<CacheEntry> | undefined;

  if (options && options.httpCache) {
    const cacheStore = options.httpCache?.store ?? new Map<any, any>();

    if (typeof cacheStore === "string") {
      cache = new Keyv<CacheEntry>({
        uri: cacheStore,
        namespace: `fetch-hero.${options.httpCache?.namespace ?? "default"}`,
        ...(options.httpCache?.storeOptions ?? {}),
      });
    } else {
      cache = new Keyv<CacheEntry>({
        store: cacheStore,
        namespace: `fetch-hero.${options.httpCache?.namespace ?? "default"}`,
        ...(options.httpCache?.storeOptions ?? {}),
      });
    }
  }

  async function decoratedFetch(
    input: RequestInfo,
    init?: FetchHeroRequestInit
  ): Promise<Response> {
    const opts = merge({}, options, init?.fh);

    if (cache) {
      const newCachePolicyRequest = buildCachePolicyRequest(input, init);
      const cacheKey = buildCacheKey(newCachePolicyRequest, init?.fh);

      debug(`Checking cache for %s`, cacheKey);

      const existingCacheEntry = await cache.get(cacheKey);

      // If there is an existing cache entry, only revalidate the request if the
      // cache entry is stale (when there is a cacheTtl set and that has expired)

      // If we have a cache entry, we need to check if it's still valid
      if (existingCacheEntry) {
        debug("Found cache entry for %s", cacheKey);

        const cachePolicy = CachePolicy.fromObject(existingCacheEntry.policy);

        if (
          existingCacheEntry.httpSemanticsBypass &&
          isCacheableRequest(newCachePolicyRequest)
        ) {
          const expiresAt =
            existingCacheEntry.httpSemanticsBypass.timestamp +
            existingCacheEntry.httpSemanticsBypass.ttl;

          debug(
            "Cache entry bypasses HTTP semantics, expires at %o, now is %o",
            expiresAt,
            Date.now()
          );

          if (expiresAt > Date.now()) {
            // The cache entry has not expired, so we can return it
            return rehydrateFetchResponseFromCacheEntry(
              existingCacheEntry.response,
              cachePolicy.responseHeaders()
            );
          }
        }

        if (opts && opts.httpCache && opts.httpCache.enabled === false) {
          debug("HTTP caching disabled, skipping cache for %s", cacheKey);

          return addHeroHeadersToResponse(
            await fetchWithRetrying(input, init, opts.retrying, fetch),
            {
              "x-fh-cache-status": "MISS",
            }
          );
        }

        // If the cache entry is still valid, we can return it
        if (cachePolicy.satisfiesWithoutRevalidation(newCachePolicyRequest)) {
          const response = rehydrateFetchResponseFromCacheEntry(
            existingCacheEntry.response,
            cachePolicy.responseHeaders()
          );

          debug(
            "Return cached response because it satisfies without revalidation %s",
            cacheKey
          );

          return response;
        } else {
          debug("Cache entry is stale, revalidating %s", cacheKey);
          // Otherwise, we need to revalidate the request
          const {
            policy: newCachePolicy,
            response: revalidatedResponse,
            modified,
          } = await revalidateRequest(fetch, cachePolicy, input, init);

          // If the body has been modified, then we need to use the modified response
          // If the body has not been modified, then we can use the cached response
          const response = modified
            ? revalidatedResponse
            : existingCacheEntry.response;

          const bypassHTTPCacheTtl = opts?.httpCache?.bypass?.ttl ?? 0;

          // In either case, we need to update the cache entry
          const cacheEntry: CacheEntry = {
            policy: newCachePolicy.toObject(),
            response: response,
            httpSemanticsBypass:
              bypassHTTPCacheTtl === 0
                ? undefined
                : {
                    ttl: bypassHTTPCacheTtl * 1000,
                    timestamp: Date.now(),
                  },
          };

          const ttl = Math.max(
            cachePolicy.timeToLive(),
            bypassHTTPCacheTtl * 1000
          );

          debug("Caching revalidated response %s with ttl %0", cacheKey, ttl);
          // You might be thinking, but the response in the new cache entry does not have the
          // updated headers from the new cache policy. But don't worry, this is by design.
          // If this updated response is used in a new response, the cached policy will be used
          // To set the headers of the response returned.
          await cache.set(cacheKey, cacheEntry, ttl);

          return rehydrateFetchResponseFromCacheEntry(
            response,
            newCachePolicy.responseHeaders()
          );
        }
      } else {
        debug("No cache entry for %s", cacheKey);
        // If we don't have a cache entry, we need to do the real request
        // And then potentially cache it if it is storable
        const response = await fetchWithRetrying(
          input,
          init,
          opts.retrying,
          fetch
        );

        const cachePolicyResponse =
          buildCachePolicyResponseFromFetchResponse(response);

        const cachePolicy = new CachePolicy(
          newCachePolicyRequest,
          cachePolicyResponse,
          options?.httpCache?.options
        );

        const bypassHTTPCacheTtl = opts?.httpCache?.bypass?.ttl ?? 0;

        if (
          !cachePolicy.storable() &&
          (bypassHTTPCacheTtl === 0 ||
            !isCacheableRequest(newCachePolicyRequest))
        ) {
          return addHeroHeadersToResponse(response, {
            "x-fh-cache-status": "MISS",
          });
        }

        const cacheEntry: CacheEntry = {
          policy: cachePolicy.toObject(),
          response: await buildCachedResponse(response),
          httpSemanticsBypass:
            bypassHTTPCacheTtl === 0
              ? undefined
              : {
                  ttl: bypassHTTPCacheTtl * 1000,
                  timestamp: Date.now(),
                },
        };

        const ttl = Math.max(
          cachePolicy.timeToLive(),
          bypassHTTPCacheTtl * 1000
        );

        debug("Caching fresh response %s with ttl %0", cacheKey, ttl);

        await cache.set(cacheKey, cacheEntry, ttl);

        return addHeroHeadersToResponse(response, {
          "x-fh-cache-status": "MISS",
        });
      }
    }

    debug("Caching disabled, making real request");

    return addHeroHeadersToResponse(
      await fetchWithRetrying(input, init, opts.retrying, fetch),
      {
        "x-fh-cache-status": "MISS",
      }
    );
  }

  return decoratedFetch;
}

function addHeroHeadersToResponse(
  response: Response,
  headersToAdd: HeadersInit
): Response {
  const headers = response.headers;

  for (const [name, value] of Object.entries(headersToAdd)) {
    headers.set(name, value);
  }

  return response;
}

async function revalidateRequest(
  fetch: FetchFunction,
  cachePolicy: CachePolicy,
  info: RequestInfo,
  init?: RequestInit
): Promise<{
  policy: CachePolicy;
  response: CachedResponse;
  modified: boolean;
}> {
  const newRequest = buildCachePolicyRequest(info, init);

  newRequest.headers = cachePolicy.revalidationHeaders(newRequest);

  // Send request to the origin server. The server may respond with status 304
  const revalidationResponse = await fetch(newRequest.url!, {
    headers: rehydrateHeaders(newRequest.headers),
    method: newRequest.method,
    body: getBodyFromInput(info, init),
  });

  const revalidationCachePolicyResponse =
    buildCachePolicyResponseFromFetchResponse(revalidationResponse);

  const cacheResponse = await buildCachedResponse(revalidationResponse);

  const revalidationResult = cachePolicy.revalidatedPolicy(
    newRequest,
    revalidationCachePolicyResponse
  );

  // Create updated policy and combined response from the old and new data
  return {
    policy: revalidationResult.policy,
    modified: revalidationResult.modified,
    response: cacheResponse,
  };
}

function rehydrateFetchResponseFromCacheEntry(
  cachedResponse: CachedResponse,
  policyHeaders: CachePolicy.Headers
): Response {
  const response = new Response(cachedResponse.body, {
    status: cachedResponse.status,
    statusText: cachedResponse.statusText,
    headers: rehydrateHeaders(policyHeaders, true),
  });

  return response;
}

function buildCacheKey(
  request: CachePolicy.Request,
  options?: RequestInitFhProperties
): string {
  const requestPart = `${request.method}:${request.url}`;

  if (options?.httpCache?.namespace) {
    return `${options.httpCache.namespace}:${requestPart}`;
  }

  return requestPart;
}

async function buildCachedResponse(
  response: Response
): Promise<CachedResponse> {
  const clonedResponse = response.clone();

  const headers = normalizeHeaders(clonedResponse.headers);
  const body = await clonedResponse.text();

  return {
    url: clonedResponse.url,
    status: clonedResponse.status,
    statusText: clonedResponse.statusText,
    headers,
    body,
  };
}

function buildCachePolicyResponseFromFetchResponse(
  response: Response
): CachePolicy.Response {
  return {
    status: response.status,
    headers: normalizeHeaders(response.headers),
  };
}

function buildCachePolicyRequest(
  input: RequestInfo,
  init?: RequestInit
): CachePolicy.Request {
  return {
    headers: normalizeHeaders(getHeadersFromInput(input, init)),
    url: normalizeUrl(getUrlFromInput(input)),
    method: getMethodFromInput(input, init).toUpperCase(),
  };
}

function rehydrateHeaders(
  headers: CachePolicy.Headers,
  fromCache = false
): Headers {
  const result = new Headers();

  Object.keys(headers).forEach((headerName) => {
    const headerValue = headers[headerName];

    if (Array.isArray(headerValue)) {
      headerValue.forEach((value) => result.append(headerName, value));
    } else if (headerValue) {
      result.append(headerName, headerValue);
    }
  });

  if (fromCache) {
    result.append("x-fh-cache-status", "HIT");
  }

  return result;
}

function isFetchHeaders(headers: HeadersInit): headers is Headers {
  return typeof (headers as Headers).has === "function";
}

function normalizeHeaders(headers?: HeadersInit): CachePolicy.Headers {
  if (!headers) {
    return {};
  }

  if (isFetchHeaders(headers)) {
    const results: Record<string, string> = {};

    for (const [name, value] of headers) {
      results[name] = value;
    }

    return results;
  }

  if (Array.isArray(headers)) {
    return headers.reduce((acc, header) => {
      const headerName = header[0];
      const headerValue = header[1];

      const existingHeaderValue = acc[headerName];

      if (existingHeaderValue) {
        if (Array.isArray(existingHeaderValue)) {
          acc[headerName] = existingHeaderValue.concat(headerValue);
        } else {
          acc[headerName] = [existingHeaderValue, headerValue];
        }
      } else {
        acc[headerName] = headerValue;
      }

      return acc;
    }, {} as CachePolicy.Headers);
  }

  return headers;
}

function getBodyFromInput(
  input: RequestInfo,
  init?: RequestInit
): BodyInit | undefined {
  if (init?.body) {
    return init.body;
  }

  if (input instanceof Request) {
    return input.body;
  }
}

function getHeadersFromInput(
  input: RequestInfo,
  init?: RequestInit
): HeadersInit | undefined {
  if (init?.headers) {
    return init.headers;
  }

  if (input instanceof Request) {
    return input.headers;
  }
}

function getMethodFromInput(input: RequestInfo, init?: RequestInit): string {
  if (typeof input === "string") {
    return init?.method ?? "GET";
  } else if ("method" in input) {
    return input.method;
  }

  return "GET";
}

function getUrlFromInput(input: RequestInfo): URL {
  if (typeof input === "string") {
    return new URL(input);
  } else if ("url" in input) {
    return new URL(input.url);
  } else {
    throw new Error("Invalid input, could not create url");
  }
}

function normalizeUrl(url: URL): string {
  const normalized = new URL(url.toString());

  normalized.hash = "";
  normalized.searchParams.sort();
  normalized.pathname = normalized.pathname.replace(/\/$/, "");

  return normalized.toString();
}

function isCacheableRequest(request: CachePolicy.Request): boolean {
  return request.method === "GET" || request.method === "HEAD";
}

type FetchFunctionWithRetrying = Function.Function<
  List.Append<
    List.Append<
      Function.Parameters<FetchFunction>,
      FetchHeroOptions["retrying"]
    >,
    FetchFunction
  >,
  Function.Return<FetchFunction>
>;

const fetchWithRetrying: FetchFunctionWithRetrying = async (
  info,
  init,
  retryingOptions,
  fetchFunction
) => {
  if (!retryingOptions || !retryingOptions.enabled) {
    return fetchFunction(info, init);
  }

  const retryOn = retryingOptions.retryOn ?? [500, 502, 503, 504];

  const retryOptions: AsyncRetryOptions = merge(
    { retries: 4 },
    retryingOptions.options
  );

  const response = await retry(async (bail, attempt) => {
    debug(`Fetching %o, attempt #%o`, info, attempt);
    // if anything throws, we retry
    const res = await fetchFunction(info, init);

    if (res.ok || attempt >= retryOptions.retries + 1) {
      return res;
    }

    if (retryOn.includes(res.status)) {
      debug(
        `Retry %o, %o response was not ok (%o: %s)`,
        attempt,
        info,
        res.status,
        res.statusText
      );

      throw new Error(`Fetch failed with status ${res.status}`);
    }

    return res;
  }, retryOptions);

  return response;
};
