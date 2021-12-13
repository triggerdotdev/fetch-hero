import fetchHero, { FetchFunction } from "../src";

import { Headers } from "node-fetch";

import { MockRequest } from "fetch-mock";
import fetchMockJest from "fetch-mock-jest";

import { unlinkSync } from "fs";

const nodeFetch = fetchMockJest.sandbox();

describe("caching requests", () => {
  beforeAll(() => {
    nodeFetch.mock(`path:/public/cacheable`, {
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
});
