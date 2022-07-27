import fetchHero, { FetchFunction } from "../src";

import { MockRequest } from "fetch-mock";
import fetchMockJest from "fetch-mock-jest";

const nodeFetch = fetchMockJest.sandbox();
nodeFetch.config.overwriteRoutes = false;

jest.setTimeout(30000);

describe("retrying requests", () => {
  beforeAll(() => {
    nodeFetch
      .mock(
        "path:/responses/500",
        {
          body: "500 response",
          status: 500,
          headers: {
            "Content-Type": "text",
          },
        },
        { repeat: 3 }
      )
      .mock("path:/responses/500", 200);

    nodeFetch
      .mock(
        "path:/responses/403",
        {
          body: "403 response",
          status: 403,
          headers: {
            "Content-Type": "text",
          },
        },
        { repeat: 3 }
      )
      .mock("path:/responses/403", 200);
  });

  afterAll(() => {
    nodeFetch.mockReset();
  });

  afterEach(() => {
    nodeFetch.mockClear();
  });

  test("Should not retry if retrying is disabled", async () => {
    const fetch = fetchHero(nodeFetch);

    const response1 = await fetch(`http://mock.foo/responses/500`);
    expect(response1.status).toBe(500);

    expect(nodeFetch).toHaveFetchedTimes(1, `path:/responses/500`);
  });

  test("Should retry on 500 status if retrying is enabled", async () => {
    const fetch = fetchHero(nodeFetch, { retrying: { enabled: true } });

    const response1 = await fetch(`http://mock.foo/responses/500`);
    expect(response1.status).toBe(200);

    expect(nodeFetch).toHaveFetchedTimes(4, `path:/responses/500`);
  });

  test("Should allow changing the async-retry options", async () => {
    const fetch = fetchHero(nodeFetch, {
      retrying: { enabled: true, options: { retries: 2 } },
    });

    const response1 = await fetch(`http://mock.foo/responses/500`);
    expect(response1.status).toBe(500);

    expect(nodeFetch).toHaveFetchedTimes(3, `path:/responses/500`);
  });

  test("Should allow changing the retry settings on a per-request basis", async () => {
    const fetch = fetchHero(nodeFetch, {
      retrying: { enabled: false },
    });

    const response1 = await fetch(`http://mock.foo/responses/500`, {
      fh: { retrying: { enabled: true, options: { retries: 3 } } },
    });

    expect(response1.status).toBe(200);

    expect(nodeFetch).toHaveFetchedTimes(4, `path:/responses/500`);
  });

  test("Should not retry 403 responses", async () => {
    const fetch = fetchHero(nodeFetch, {
      retrying: { enabled: true },
    });

    const response1 = await fetch(`http://mock.foo/responses/403`);
    expect(response1.status).toBe(403);

    expect(nodeFetch).toHaveFetchedTimes(1, `path:/responses/403`);
  });

  test("Should enable retying on a per response status basis", async () => {
    const fetch = fetchHero(nodeFetch, {
      retrying: { enabled: true, retryOn: [403] },
    });

    const response1 = await fetch(`http://mock.foo/responses/403`);
    expect(response1.status).toBe(200);

    expect(nodeFetch).toHaveFetchedTimes(4, `path:/responses/403`);
  });
});
