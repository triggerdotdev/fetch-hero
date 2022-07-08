import fetchHero, { FetchFunction } from "../src";

import { MockRequest } from "fetch-mock";
import fetchMockJest from "fetch-mock-jest";

import { unlinkSync } from "fs";

const nodeFetch = fetchMockJest.sandbox();

describe("caching requests", () => {
  beforeAll(() => {
    nodeFetch.mock("path:/public/cacheable", {
      body: "public cacheable",
      status: 200,
      headers: {
        "Content-Type": "text",
        "Cache-Control": "public, max-age=60",
        "Last-Modified": new Date(Date.now() - 20000).toUTCString(),
      },
    });

    nodeFetch.mock(
      {
        url: "path:/post-request",
        method: "POST",
      },
      {
        body: "public post-request",
        status: 200,
        headers: {
          "Content-Type": "text",
        },
      }
    );

    nodeFetch.mock(/public\/cacheableurl/, {
      body: "public cacheableurl",
      status: 200,
      headers: {
        "Content-Type": "text",
        "Cache-Control": "public, max-age=60",
        "Last-Modified": new Date(Date.now() - 20000).toUTCString(),
      },
    });

    nodeFetch.mock(
      {
        name: "normal cacheable-while-revalidate request",
        url: "path:/public/cacheable-while-revalidate",
        functionMatcher: (url: string, opts: MockRequest): boolean => {
          let ifModifiedSinceHeaderExists = false;

          if (Array.isArray(opts.headers)) {
            ifModifiedSinceHeaderExists = opts.headers.some(
              (header: string[]) => header[0] === "if-modified-since"
            );
          }

          if (opts.headers instanceof Headers) {
            ifModifiedSinceHeaderExists = opts.headers.has("if-modified-since");
          }

          return (
            url.includes("public/cacheable-while-revalidate") &&
            !ifModifiedSinceHeaderExists
          );
        },
      },
      {
        body: "public cacheable-while-revalidate",
        status: 200,
        headers: {
          "Content-Type": "text",
          "Cache-Control": "public, max-age=60, stale-while-revalidate=60",
          "Last-Modified": new Date(Date.now() - 20000).toUTCString(),
        },
      }
    );

    nodeFetch.mock(
      {
        name: "revalidation (non-modified) cacheable-while-revalidate request",
        url: "path:/public/cacheable-while-revalidate",
        functionMatcher: (url: string, opts: MockRequest): boolean => {
          let ifModifiedSinceHeaderExists = false;

          if (Array.isArray(opts.headers)) {
            ifModifiedSinceHeaderExists = opts.headers.some(
              (header: string[]) => header[0] === "if-modified-since"
            );
          }

          if (opts.headers instanceof Headers) {
            ifModifiedSinceHeaderExists = opts.headers.has("if-modified-since");
          }

          return (
            url.includes("public/cacheable-while-revalidate") &&
            ifModifiedSinceHeaderExists
          );
        },
      },
      {
        status: 304,
        headers: {
          "Content-Type": "text",
          "Cache-Control": "public, max-age=60, stale-while-revalidate=60",
          "Last-Modified": new Date(Date.now() - 20000).toUTCString(),
        },
      }
    );

    nodeFetch.mock(
      {
        name: "normal modified-cacheable-while-revalidate request",
        url: "path:/public/modified-cacheable-while-revalidate",
        functionMatcher: (url: string, opts: MockRequest): boolean => {
          let ifModifiedSinceHeaderExists = false;

          if (Array.isArray(opts.headers)) {
            ifModifiedSinceHeaderExists = opts.headers.some(
              (header: string[]) => header[0] === "if-modified-since"
            );
          }

          if (opts.headers instanceof Headers) {
            ifModifiedSinceHeaderExists = opts.headers.has("if-modified-since");
          }

          return (
            url.includes("public/modified-cacheable-while-revalidate") &&
            !ifModifiedSinceHeaderExists
          );
        },
      },
      {
        body: "public modified-cacheable-while-revalidate",
        status: 200,
        headers: {
          "Content-Type": "text",
          "Cache-Control": "public, max-age=60, stale-while-revalidate=60",
          "Last-Modified": new Date(Date.now() - 20000).toUTCString(),
        },
      }
    );

    nodeFetch.mock(
      {
        name: "revalidation (modified) modified-cacheable-while-revalidate request",
        url: "path:/public/modified-cacheable-while-revalidate",
        functionMatcher: (url: string, opts: MockRequest): boolean => {
          let ifModifiedSinceHeaderExists = false;

          if (Array.isArray(opts.headers)) {
            ifModifiedSinceHeaderExists = opts.headers.some(
              (header: string[]) => header[0] === "if-modified-since"
            );
          }

          if (opts.headers instanceof Headers) {
            ifModifiedSinceHeaderExists = opts.headers.has("if-modified-since");
          }

          return (
            url.includes("public/modified-cacheable-while-revalidate") &&
            ifModifiedSinceHeaderExists
          );
        },
      },
      {
        body: "public modified-cacheable-while-revalidate",
        status: 200,
        headers: {
          "Content-Type": "text",
          "Cache-Control": "public, max-age=60, stale-while-revalidate=60",
          "Last-Modified": new Date(Date.now() - 20000).toUTCString(),
        },
      }
    );

    nodeFetch.mock(`path:/no-store`, {
      body: "no-store",
      status: 200,
      headers: {
        "Content-Type": "text",
        "Cache-Control": "no-store",
      },
    });

    nodeFetch.mock(`path:/private/cacheable`, {
      body: "private cacheable",
      status: 200,
      headers: {
        "Content-Type": "text",
        "Cache-Control": "private, s-maxage=60",
        "Last-Modified": new Date(Date.now() - 20000).toUTCString(),
      },
    });

    nodeFetch.mock(
      {
        name: "public json api",
        url: "path:/public/json-api",
        functionMatcher: (url: string, opts: MockRequest): boolean => {
          let accepts = "text/plain";

          if (Array.isArray(opts.headers)) {
            const acceptHeader = opts.headers.find(
              (header: string[]) => header[0] === "accept"
            );

            accepts = acceptHeader ? acceptHeader[1] : "text/plain";
          } else if (opts.headers instanceof Headers) {
            accepts = opts.headers.get("accept") || "text/plain";
          } else if (opts.headers) {
            accepts = opts.headers["accept"] || "text/plain";
          }

          return (
            url.includes("public/json-api") &&
            accepts.includes("application/json")
          );
        },
      },
      {
        body: JSON.stringify({ foo: "bar" }),
        status: 200,
        headers: {
          "Content-Length": JSON.stringify({ foo: "bar" }).length,
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=60",
          "Last-Modified": new Date(Date.now() - 20000).toUTCString(),
        },
      }
    );
  });

  afterAll(() => {
    nodeFetch.mockReset();
  });

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    nodeFetch.mockClear();
    jest.useRealTimers();
  });

  test("Should not cache if caching is disabled", async () => {
    const fetch = fetchHero(nodeFetch as unknown as FetchFunction);

    const response1 = await fetch(`http://mock.foo/public/cacheable`);
    expect(response1.status).toBe(200);
    expect(await response1.text()).toBe("public cacheable");

    const response2 = await fetch(`http://mock.foo/public/cacheable`);
    expect(response2.status).toBe(200);
    expect(await response2.text()).toBe("public cacheable");

    expect(nodeFetch).toHaveFetchedTimes(2, `path:/public/cacheable`);
  });

  test("Should not cache if response does not allow it", async () => {
    const fetch = fetchHero(nodeFetch as unknown as FetchFunction);

    const response1 = await fetch(`http://mock.foo/no-store`);
    expect(response1.status).toBe(200);
    expect(await response1.text()).toBe("no-store");

    const response2 = await fetch(`http://mock.foo/no-store`);
    expect(response2.status).toBe(200);
    expect(await response2.text()).toBe("no-store");

    expect(nodeFetch).toHaveFetchedTimes(2, `path:/no-store`);
  });

  test("Should cache if ttl is set, even if cache does not allow it", async () => {
    const fetch = fetchHero(nodeFetch as unknown as FetchFunction, {
      httpCache: { enabled: true, bypass: { ttl: 30 } },
    });

    const response1 = await fetch(`http://mock.foo/no-store`);
    expect(response1.status).toBe(200);
    expect(await response1.text()).toBe("no-store");

    const response2 = await fetch(`http://mock.foo/no-store`);
    expect(response2.status).toBe(200);
    expect(await response2.text()).toBe("no-store");

    expect(nodeFetch).toHaveFetchedTimes(1, `path:/no-store`);
  });

  test("Should respond with a cached response if caching is enabled, cache-control=public, max-age=60", async () => {
    const fetch = fetchHero(nodeFetch as unknown as FetchFunction, {
      httpCache: { enabled: true },
    });

    const response1 = await fetch(`http://mock.foo/public/cacheable`);
    expect(response1.status).toBe(200);
    expect(await response1.text()).toBe("public cacheable");

    const response2 = await fetch(`http://mock.foo/public/cacheable`);
    expect(response2.status).toBe(200);
    expect(await response2.text()).toBe("public cacheable");

    expect(nodeFetch).toHaveFetchedTimes(1, `path:/public/cacheable`);
  });

  test("Should respond with a cached response if cache.ttl is longer than max-age", async () => {
    const fetch = fetchHero(nodeFetch as unknown as FetchFunction, {
      httpCache: { enabled: true, bypass: { ttl: 120 } },
    });

    const response1 = await fetch(`http://mock.foo/public/cacheable`);
    expect(response1.status).toBe(200);
    expect(await response1.text()).toBe("public cacheable");

    jest.setSystemTime(Date.now() + 61000);

    const response2 = await fetch(`http://mock.foo/public/cacheable`);
    expect(response2.status).toBe(200);
    expect(await response2.text()).toBe("public cacheable");

    expect(nodeFetch).toHaveFetchedTimes(1, `path:/public/cacheable`);
  });

  test("Should make a fresh request if cache.ttl has expired", async () => {
    const fetch = fetchHero(nodeFetch as unknown as FetchFunction, {
      httpCache: { enabled: true, bypass: { ttl: 120 } },
    });

    const response1 = await fetch(`http://mock.foo/public/cacheable`);
    expect(response1.status).toBe(200);
    expect(await response1.text()).toBe("public cacheable");

    jest.setSystemTime(Date.now() + 121000);

    const response2 = await fetch(`http://mock.foo/public/cacheable`);
    expect(response2.status).toBe(200);
    expect(await response2.text()).toBe("public cacheable");

    expect(nodeFetch).toHaveFetchedTimes(2, `path:/public/cacheable`);
  });

  test("Should allow disabling the cache per request", async () => {
    const fetch = fetchHero(nodeFetch as unknown as FetchFunction, {
      httpCache: { enabled: true },
    });

    const response1 = await fetch(`http://mock.foo/public/cacheable`);
    expect(response1.status).toBe(200);
    expect(await response1.text()).toBe("public cacheable");

    const response2 = await fetch(`http://mock.foo/public/cacheable`, {
      fh: { httpCache: { enabled: false } },
    });
    expect(response2.status).toBe(200);
    expect(await response2.text()).toBe("public cacheable");

    expect(nodeFetch).toHaveFetchedTimes(2, `path:/public/cacheable`);
  });

  test("Should allow setting the namespace per request", async () => {
    const fetch = fetchHero(nodeFetch as unknown as FetchFunction, {
      httpCache: { enabled: true },
    });

    const response1 = await fetch(`http://mock.foo/public/cacheable`);
    expect(response1.status).toBe(200);
    expect(await response1.text()).toBe("public cacheable");

    const response2 = await fetch(`http://mock.foo/public/cacheable`, {
      fh: { httpCache: { namespace: "request" } },
    });

    expect(response2.status).toBe(200);
    expect(await response2.text()).toBe("public cacheable");

    expect(nodeFetch).toHaveFetchedTimes(2, `path:/public/cacheable`);
  });

  test("Should respond with a cached response by normalizing the url", async () => {
    const fetch = fetchHero(nodeFetch as unknown as FetchFunction, {
      httpCache: { enabled: true },
    });

    const response1 = await fetch(`http://mock.foo/public/cacheableurl`);
    expect(response1.status).toBe(200);
    expect(await response1.text()).toBe("public cacheableurl");

    const response2 = await fetch(`http://mock.foo/public/cacheableurl/`);
    expect(response2.status).toBe(200);
    expect(await response2.text()).toBe("public cacheableurl");

    expect(nodeFetch).toHaveFetchedTimes(1, /public\/cacheableurl/);
  });

  test("Should work with passing a Request to the fetch function", async () => {
    const fetch = fetchHero(nodeFetch as unknown as FetchFunction, {
      httpCache: { enabled: true },
    });

    const request = new Request("http://mock.foo/public/cacheable");

    const response1 = await fetch(request);
    expect(response1.status).toBe(200);
    expect(await response1.text()).toBe("public cacheable");

    const response2 = await fetch(request);
    expect(response2.status).toBe(200);
    expect(await response2.text()).toBe("public cacheable");

    expect(nodeFetch).toHaveFetchedTimes(1, `path:/public/cacheable`);
  });

  test("Should get the method from the RequestInit argument passed to the fetch function", async () => {
    const fetch = fetchHero(nodeFetch as unknown as FetchFunction, {
      httpCache: { enabled: true },
    });

    const response1 = await fetch("http://mock.foo/public/cacheable", {
      method: "get",
    });
    expect(response1.status).toBe(200);
    expect(await response1.text()).toBe("public cacheable");

    const response2 = await fetch("http://mock.foo/public/cacheable", {
      method: "GET",
    });
    expect(response2.status).toBe(200);
    expect(await response2.text()).toBe("public cacheable");

    expect(nodeFetch).toHaveFetchedTimes(1, `path:/public/cacheable`);
  });

  test("Should get the url from the URL argument passed to the fetch function", async () => {
    const fetch = fetchHero(nodeFetch as unknown as FetchFunction, {
      httpCache: { enabled: true },
    });

    const response1 = await fetch("http://mock.foo/public/cacheable");
    expect(response1.status).toBe(200);
    expect(await response1.text()).toBe("public cacheable");

    const response2 = await fetch("http://mock.foo/public/cacheable");
    expect(response2.status).toBe(200);
    expect(await response2.text()).toBe("public cacheable");

    expect(nodeFetch).toHaveFetchedTimes(1, `path:/public/cacheable`);
  });

  test("Should allow configuring the cache store with a Map", async () => {
    const customMap = new Map<any, any>();

    const fetch = fetchHero(nodeFetch as unknown as FetchFunction, {
      httpCache: { enabled: true, store: customMap },
    });

    const response1 = await fetch(`http://mock.foo/public/cacheable`);
    expect(response1.status).toBe(200);
    expect(await response1.text()).toBe("public cacheable");

    const response2 = await fetch(`http://mock.foo/public/cacheable`);
    expect(response2.status).toBe(200);
    expect(await response2.text()).toBe("public cacheable");

    expect(nodeFetch).toHaveFetchedTimes(1, `path:/public/cacheable`);

    expect(customMap.size).toBe(1);
  });

  test("Can pass in a custom namespace", async () => {
    const customMap = new Map<any, any>();

    const fetch = fetchHero(nodeFetch as unknown as FetchFunction, {
      httpCache: {
        enabled: true,
        store: customMap,
        namespace: "caching.test.ts",
      },
    });

    await fetch(`http://mock.foo/public/cacheable`);

    expect(
      customMap.get(
        "fetch-hero.caching.test.ts:GET:http://mock.foo/public/cacheable"
      )
    ).toBeDefined();
  });

  test("Should by default cache the response only when it will be considered fresh", async () => {
    const customMap = new Map<any, any>();

    const fetch = fetchHero(nodeFetch as unknown as FetchFunction, {
      httpCache: {
        enabled: true,
        store: customMap,
      },
    });

    await fetch(`http://mock.foo/public/cacheable`);

    const cacheValue = JSON.parse(
      customMap.get("fetch-hero.default:GET:http://mock.foo/public/cacheable")
    );

    expect(cacheValue).toBeDefined();

    const ttl = cacheValue.expires - Date.now();

    expect(ttl).toBeGreaterThan(59000);
    expect(ttl).toBeLessThan(61000);
  });

  test("Should cache passed freshness if cache.ttl is set", async () => {
    const customMap = new Map<any, any>();

    const fetch = fetchHero(nodeFetch as unknown as FetchFunction, {
      httpCache: {
        enabled: true,
        store: customMap,
        bypass: { ttl: 120 },
      },
    });

    await fetch(`http://mock.foo/public/cacheable`);

    const cacheValue = JSON.parse(
      customMap.get("fetch-hero.default:GET:http://mock.foo/public/cacheable")
    );

    expect(cacheValue).toBeDefined();

    const ttl = cacheValue.expires - Date.now();

    expect(ttl).toBeGreaterThan(119000);
    expect(ttl).toBeLessThan(121000);
  });

  test("Should respect state-while-revalidate extension for setting TTL", async () => {
    const customMap = new Map<any, any>();

    const fetch = fetchHero(nodeFetch as unknown as FetchFunction, {
      httpCache: {
        enabled: true,
        store: customMap,
      },
    });

    await fetch(`http://mock.foo/public/cacheable-while-revalidate`);

    const cacheValue = JSON.parse(
      customMap.get(
        "fetch-hero.default:GET:http://mock.foo/public/cacheable-while-revalidate"
      )
    );

    expect(cacheValue).toBeDefined();

    const ttl = cacheValue.expires - Date.now();

    expect(ttl).toBeGreaterThan(119000);
    expect(ttl).toBeLessThan(121000);
  });

  test("Should send a revalidation request to the origin on stale requests, and respond with the cached response if the resource has not been modified", async () => {
    const fetch = fetchHero(nodeFetch as unknown as FetchFunction, {
      httpCache: {
        enabled: true,
      },
    });

    const response1 = await fetch(
      `http://mock.foo/public/cacheable-while-revalidate`
    );

    expect(response1.status).toBe(200);
    expect(await response1.text()).toBe("public cacheable-while-revalidate");

    jest.setSystemTime(Date.now() + 61000);

    const response2 = await fetch(
      `http://mock.foo/public/cacheable-while-revalidate`
    );
    expect(response2.status).toBe(200);
    expect(await response2.text()).toBe("public cacheable-while-revalidate");

    // We can't use nice matchers here because fetch-mock-jest doesn't work with route identifiers
    const revalidationCalls = nodeFetch
      .calls("http://mock.foo/public/cacheable-while-revalidate")
      .filter(
        (call) =>
          call.identifier ===
          "revalidation (non-modified) cacheable-while-revalidate request"
      );

    expect(revalidationCalls).toHaveLength(1);

    const normalCalls = nodeFetch
      .calls("http://mock.foo/public/cacheable-while-revalidate")
      .filter(
        (call) =>
          call.identifier === "normal cacheable-while-revalidate request"
      );

    expect(normalCalls).toHaveLength(1);
  });

  test("Should send a revalidation request to the origin on stale requests, and respond with the revalidation response if the resource has been modified", async () => {
    const fetch = fetchHero(nodeFetch as unknown as FetchFunction, {
      httpCache: {
        enabled: true,
      },
    });

    const response1 = await fetch(
      `http://mock.foo/public/modified-cacheable-while-revalidate`
    );

    expect(response1.status).toBe(200);
    expect(await response1.text()).toBe(
      "public modified-cacheable-while-revalidate"
    );

    jest.setSystemTime(Date.now() + 61000);

    const response2 = await fetch(
      `http://mock.foo/public/modified-cacheable-while-revalidate`
    );
    expect(response2.status).toBe(200);
    expect(await response2.text()).toBe(
      "public modified-cacheable-while-revalidate"
    );

    // We can't use nice matchers here because fetch-mock-jest doesn't work with route identifiers
    const revalidationCalls = nodeFetch
      .calls("http://mock.foo/public/modified-cacheable-while-revalidate")
      .filter(
        (call) =>
          call.identifier ===
          "revalidation (modified) modified-cacheable-while-revalidate request"
      );

    expect(revalidationCalls).toHaveLength(1);

    const normalCalls = nodeFetch
      .calls("http://mock.foo/public/modified-cacheable-while-revalidate")
      .filter(
        (call) =>
          call.identifier ===
          "normal modified-cacheable-while-revalidate request"
      );

    expect(normalCalls).toHaveLength(1);
  });

  test("Should allow configuring the cache store with a connection string", async () => {
    const fetch = fetchHero(nodeFetch as unknown as FetchFunction, {
      httpCache: { enabled: true, store: "sqlite://tests/test.sqlite" },
    });

    const response1 = await fetch(`http://mock.foo/public/cacheable`);
    expect(response1.status).toBe(200);
    expect(await response1.text()).toBe("public cacheable");

    const response2 = await fetch(`http://mock.foo/public/cacheable`);
    expect(response2.status).toBe(200);
    expect(await response2.text()).toBe("public cacheable");

    expect(nodeFetch).toHaveFetchedTimes(1, `path:/public/cacheable`);

    unlinkSync("tests/test.sqlite");
  });

  test("Should NOT respond with a cached response if shared caching is enabled, cache-control=private", async () => {
    const fetch = fetchHero(nodeFetch as unknown as FetchFunction, {
      httpCache: { enabled: true, options: { shared: true } },
    });

    const response1 = await fetch(`http://mock.foo/private/cacheable`);
    expect(response1.status).toBe(200);
    expect(await response1.text()).toBe("private cacheable");

    const response2 = await fetch(`http://mock.foo/private/cacheable`);
    expect(response2.status).toBe(200);
    expect(await response2.text()).toBe("private cacheable");

    expect(nodeFetch).toHaveFetchedTimes(2, `path:/private/cacheable`);
  });

  test("Should respond with a cached response if private caching is enabled, cache-control=private", async () => {
    const fetch = fetchHero(nodeFetch as unknown as FetchFunction, {
      httpCache: { enabled: true, options: { shared: false } },
    });

    const response1 = await fetch(`http://mock.foo/private/cacheable`);
    expect(response1.status).toBe(200);
    expect(await response1.text()).toBe("private cacheable");

    const response2 = await fetch(`http://mock.foo/private/cacheable`);
    expect(response2.status).toBe(200);
    expect(await response2.text()).toBe("private cacheable");

    expect(nodeFetch).toHaveFetchedTimes(1, `path:/private/cacheable`);
  });

  test("Should pass through headers record to the server", async () => {
    const fetch = fetchHero(nodeFetch as unknown as FetchFunction, {
      httpCache: { enabled: true },
    });

    const response1 = await fetch(`http://mock.foo/public/json-api`, {
      headers: { accept: "application/json" },
    });

    expect(response1.status).toBe(200);
    expect(await response1.json()).toStrictEqual({ foo: "bar" });

    const response2 = await fetch(`http://mock.foo/public/json-api`, {
      headers: { accept: "application/json" },
    });

    expect(response2.status).toBe(200);
    expect(await response2.json()).toStrictEqual({ foo: "bar" });

    expect(nodeFetch).toHaveFetchedTimes(1, `path:/public/json-api`);
  });

  test("Should pass through headers from the Request to the origin server", async () => {
    const fetch = fetchHero(nodeFetch as unknown as FetchFunction, {
      httpCache: { enabled: true },
    });

    const request = new Request(`http://mock.foo/public/json-api`, {
      headers: { accept: "application/json" },
    });

    const response1 = await fetch(request);

    expect(response1.status).toBe(200);
    expect(await response1.json()).toStrictEqual({ foo: "bar" });

    const response2 = await fetch(request);

    expect(response2.status).toBe(200);
    expect(await response2.json()).toStrictEqual({ foo: "bar" });

    expect(nodeFetch).toHaveFetchedTimes(1, `path:/public/json-api`);
  });

  test("Should pass through headers array", async () => {
    const fetch = fetchHero(nodeFetch as unknown as FetchFunction, {
      httpCache: { enabled: true },
    });

    const response1 = await fetch("http://mock.foo/public/json-api", {
      headers: [["accept", "application/json"]],
    });

    expect(response1.status).toBe(200);
    expect(await response1.json()).toStrictEqual({ foo: "bar" });

    const response2 = await fetch("http://mock.foo/public/json-api", {
      headers: [["accept", "application/json"]],
    });

    expect(response2.status).toBe(200);
    expect(await response2.json()).toStrictEqual({ foo: "bar" });

    expect(nodeFetch).toHaveFetchedTimes(1, `path:/public/json-api`);
  });

  test("Should work with multiple values for a header", async () => {
    const fetch = fetchHero(nodeFetch as unknown as FetchFunction, {
      httpCache: { enabled: true },
    });

    const response1 = await fetch("http://mock.foo/public/json-api", {
      headers: [
        ["accept", "application/json"],
        ["accept", "text/json"],
        ["accept", "json"],
      ],
    });

    expect(response1.status).toBe(200);
    expect(await response1.json()).toStrictEqual({ foo: "bar" });

    const response2 = await fetch("http://mock.foo/public/json-api", {
      headers: [
        ["accept", "application/json"],
        ["accept", "text/json"],
        ["accept", "json"],
      ],
    });

    expect(response2.status).toBe(200);
    expect(await response2.json()).toStrictEqual({ foo: "bar" });

    expect(nodeFetch).toHaveFetchedTimes(1, `path:/public/json-api`);
  });

  test("Should not cache POST requests", async () => {
    const fetch = fetchHero(nodeFetch as unknown as FetchFunction, {
      httpCache: { enabled: true },
    });

    const response1 = await fetch("http://mock.foo/post-request", {
      method: "POST",
      body: JSON.stringify({ foo: "bar" }),
    });

    expect(response1.status).toBe(200);
    expect(await response1.text()).toEqual("public post-request");

    const response2 = await fetch("http://mock.foo/post-request", {
      method: "POST",
      body: JSON.stringify({ foo: "bar" }),
    });

    expect(response2.status).toBe(200);
    expect(await response2.text()).toEqual("public post-request");

    expect(nodeFetch).toHaveFetchedTimes(2, `path:/post-request`);
  });

  test("Should not cache POST requests with bypass set", async () => {
    const fetch = fetchHero(nodeFetch as unknown as FetchFunction, {
      httpCache: { enabled: true, bypass: { ttl: 60 } },
    });

    const response1 = await fetch("http://mock.foo/post-request", {
      method: "POST",
      body: JSON.stringify({ foo: "bar" }),
    });

    expect(response1.status).toBe(200);
    expect(await response1.text()).toEqual("public post-request");

    const response2 = await fetch("http://mock.foo/post-request", {
      method: "POST",
      body: JSON.stringify({ foo: "bar" }),
    });

    expect(response2.status).toBe(200);
    expect(await response2.text()).toEqual("public post-request");

    expect(nodeFetch).toHaveFetchedTimes(2, `path:/post-request`);
  });
});
