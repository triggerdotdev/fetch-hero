# Fetch Hero

> Extends `node-fetch` with extra features

![Coverage lines](./badges/badge-lines.svg)

## Features

- No magic. Wraps `fetch` and returns a new `fetch` function
- Enables RFC 7234 and RFC 5861 compliant HTTP caching (using [http-cache-semantics](https://github.com/kornelski/http-cache-semantics))
- Works with local and shared caches
- Support for multiple storage backends by using [Keyv](https://github.com/jaredwray/keyv)
- Custom namespaces
- Handles caching a response body through [json-buffer](https://www.npmjs.com/package/json-buffer)
- Normalizes urls to increase cache hits
- Written in strict Typescript

## Usage

Install Fetch Hero

```bash
$ npm install --save node-fetch-hero
```

`fetchHero` wraps the `fetch` function and returns a new `fetch` function, with the exact same interface

```js
const fetchHero = require("node-fetch-hero");
const nodeFetch = require("node-fetch");

const fetch = fetchHero(nodeFetch);

// Now use fetch exactly how you would without fetchHero
const response = await fetch("http://google.com");
```

By default caching is disabled, you can enable it by setting the `httpCache.enabled` option to `true`

```js
const fetch = fetchHero(nodeFetch, { httpCache: { enabled: true } });
```

This will use an in-memory store, but you can customize it by supplying an object that implements the [Map](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map) interface

```js
const customMap = new Map();

const fetch = fetchHero(nodeFetch, {
  httpCache: { enabled: true, store: customMap },
});
```

Or in Typescript:

```typescript
const customMap = new Map<any, any>();

const fetch = fetchHero(nodeFetch, {
  httpCache: { enabled: true, store: customMap },
});
```

You can also pass any connection string to `httpCache.store` that [Keyv](https://github.com/jaredwray/keyv).

```bash
$ npm install --save @keyv/redis
```

`@keyv/redis` will automatically be imported when using a `redis://` connection string

```js
const fetch = fetchHero(nodeFetch, {
  httpCache: { enabled: true, store: "redis://user:pass@localhost:6379" },
});
```

### Namespacing

By default, cache keys will be namespaced by `"fetch-hero.default"`

```js
const customMap = new Map();

const fetch = fetchHero(nodeFetch, {
  httpCache: { enabled: true, store: customMap },
});

await fetch("http://test.dev/foo");

customMap.has("fetch-hero.default:GET:http://test.dev/foo"); // true
```

You can supply a custom namespace using the `httpCache.namespace` option

```js
const customMap = new Map();

const fetch = fetchHero(nodeFetch, {
  httpCache: { enabled: true, store: customMap, namespace: "foobar" },
});

await fetch("http://test.dev/foo");

customMap.has("fetch-hero.default:GET:http://test.dev/foo"); // false
customMap.has("fetch-hero.foobar:GET:http://test.dev/foo"); // true
```

### Shared caches

If you are using a shared cache (e.g. a Redis instance) and plan to share cached responses with more than 1 user, then you must set `httpCache.shared` to `true` (it is `true` by default, for security reasons)

```js
const fetch = fetchHero(nodeFetch, {
  httpCache: {
    enabled: true,
    shared: true,
    store: "redis://user:pass@localhost:6379",
  },
});

await fetch("http://test.dev/foo");
```

This will effect which responses will be cached. For example, responses with the `Cache-Control` header set to `private` or with a `s-maxage` directive will not be storable in a shared cache.

If you are using something like redis for your cache storage, and would like to still cache private responses, then set `httpCache.shared` to `false` and provide a namespace when calling the `fetch` function:

```js
const fetch = fetchHero(nodeFetch, {
  httpCache: {
    enabled: true,
    shared: true,
    store: "redis://user:pass@localhost:6379",
  },
});

// Using the user identifier so we don't mix cached responses
await fetch(
  "http://test.dev/private",
  {},
  { httpCache: { namespace: user.identifier } }
);
```

As you can see, the `fetch` function above accepts a non-standard third argument that accepts the same options object as passed in the second argument to `fetchHero`, allowing you to customize cache behaviour on a per-request basis.

> _Note_: You cannot pass in a new `store` value on a per-request basis. If you need to use multiple stores, call `fetchHero` multiple times with different options to produce a different `fetch` function per store

## Storage Adapters

View the [Keyv documentation](https://github.com/jaredwray/keyv) to learn more about the storage adapters that Fetch Hero supports.

## Roadmap

- [ ] Proxy support
- [ ] GZIP support
- [ ] Configurable request retrying
- [ ] Request pooling
- [ ] Persistent connections
