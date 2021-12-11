import fetchHero, { FetchFunction } from "../src";

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

  afterEach(() => {
    nodeFetch.mockClear();
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
