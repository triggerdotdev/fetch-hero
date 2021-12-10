import * as http from "http";
import fetchHero from "../src";
import nodeFetch from "node-fetch";
import { APIServer, createApiServer } from "./helpers/createAPIServer";

describe("caching requests", () => {
  let apiServer: APIServer;

  const posts = [
    {
      userId: 1,
      id: 1,
      title: "This is a post by eric",
      body: "quia et suscipit\nsuscipit recusandae consequuntur expedita et cum\nreprehenderit molestiae ut ut quas totam\nnostrum rerum est autem sunt rem eveniet architecto",
    },
    {
      userId: 2,
      id: 2,
      title: "This is a post by matt",
      body: "quia et suscipit\nsuscipit recusandae consequuntur expedita et cum\nreprehenderit molestiae ut ut quas totam\nnostrum rerum est autem sunt rem eveniet architecto",
    },
  ];

  const users = [
    {
      id: 1,
      name: "Eric",
      email: "eric@foo.bar",
      avatar: {
        url: "http://gravatar.img/eric.png",
      },
    },
    {
      id: 2,
      name: "Matt",
      email: "matt@foo.bar",
      avatar: {
        url: "http://gravatar.img/matt.png",
      },
    },
  ];

  beforeAll(async () => {
    const routes = {
      "/posts": posts,
      "/posts/:id": (params: any) => {
        return posts.find((p) => p.id === parseInt(params.id));
      },
      "/users/:id": (params: any, res: http.ServerResponse) => {
        res.setHeader("cache-control", "private, s-maxage=60");
        res.setHeader(
          "last-modified",
          new Date(Date.now() - 20000).toUTCString()
        );

        return users.find((u) => u.id === parseInt(params.id));
      },
    };

    apiServer = await createApiServer({
      routes,
      headers: {
        "cache-control": "public, max-age=60",
      },
    });
  });

  afterAll(async () => {
    await apiServer.close();
  });

  afterEach(() => {
    apiServer.requests = [];
  });

  test("Should not cache if caching is disabled", async () => {
    const fetch = fetchHero(nodeFetch);

    const response1 = await fetch(`http://localhost:${apiServer.port}/posts/1`);

    const response2 = await fetch(`http://localhost:${apiServer.port}/posts/1`);

    expect(apiServer.requests.length).toBe(2);

    const body1 = await response1.json();
    expect(body1).toStrictEqual(posts[0]);

    const body2 = await response2.json();
    expect(body2).toStrictEqual(posts[0]);
  });

  test("Should respond with a cached response if caching is enabled, cache-control=public, max-age=60", async () => {
    const fetch = fetchHero(nodeFetch, { httpCache: { enabled: true } });

    const response1 = await fetch(`http://localhost:${apiServer.port}/posts/1`);

    const response2 = await fetch(`http://localhost:${apiServer.port}/posts/1`);

    expect(apiServer.requests.length).toBe(1);

    const body1 = await response1.json();
    expect(body1).toStrictEqual(posts[0]);

    const body2 = await response2.json();
    expect(body2).toStrictEqual(posts[0]);
  });

  test("Should allow configuring the cache store with a Map", async () => {
    const customMap = new Map<any, any>();

    const fetch = fetchHero(nodeFetch, {
      httpCache: { enabled: true, store: customMap },
    });

    const response1 = await fetch(`http://localhost:${apiServer.port}/posts/1`);

    const response2 = await fetch(`http://localhost:${apiServer.port}/posts/1`);

    expect(apiServer.requests.length).toBe(1);

    const body1 = await response1.json();
    expect(body1).toStrictEqual(posts[0]);

    const body2 = await response2.json();
    expect(body2).toStrictEqual(posts[0]);

    expect(customMap.size).toBe(1);
  });

  test("Should allow configuring the cache store with a connection string", async () => {
    const fetch = fetchHero(nodeFetch, {
      httpCache: { enabled: true, store: "sqlite://tests/test.sqlite" },
    });

    const response1 = await fetch(`http://localhost:${apiServer.port}/posts/1`);

    const response2 = await fetch(`http://localhost:${apiServer.port}/posts/1`);

    expect(apiServer.requests.length).toBe(1);

    const body1 = await response1.json();
    expect(body1).toStrictEqual(posts[0]);

    const body2 = await response2.json();
    expect(body2).toStrictEqual(posts[0]);
  });

  test("Should NOT respond with a cached response if shared caching is enabled, cache-control=private", async () => {
    const fetch = fetchHero(nodeFetch, {
      httpCache: { enabled: true, options: { shared: true } },
    });

    const response1 = await fetch(`http://localhost:${apiServer.port}/users/1`);

    const response2 = await fetch(`http://localhost:${apiServer.port}/users/1`);

    expect(apiServer.requests.length).toBe(2);

    const body1 = await response1.json();
    expect(body1).toStrictEqual(users[0]);

    const body2 = await response2.json();
    expect(body2).toStrictEqual(users[0]);
  });

  test("Should respond with a cached response if private caching is enabled, cache-control=private", async () => {
    const fetch = fetchHero(nodeFetch, {
      httpCache: { enabled: true, options: { shared: false } },
    });

    const response1 = await fetch(`http://localhost:${apiServer.port}/users/1`);

    const response2 = await fetch(`http://localhost:${apiServer.port}/users/1`);

    expect(apiServer.requests.length).toBe(1);

    const body1 = await response1.json();
    expect(body1).toStrictEqual(users[0]);

    const body2 = await response2.json();
    expect(body2).toStrictEqual(users[0]);
  });
});
