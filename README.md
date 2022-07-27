# Fetch Hero

> Extends server-side `fetch` with extra features

![Coverage lines](./badges/badge-lines.svg)

## Features

- No magic. Wraps `fetch` and returns a new `fetch` function
- Enables RFC 7234 and RFC 5861 compliant HTTP caching (using [http-cache-semantics](https://github.com/kornelski/http-cache-semantics))
- Bypass cache semantics on GET and HEAD requests to set a specific cache TTL
- Support for multiple storage backends by using [Keyv](https://github.com/jaredwray/keyv)
- Works with local and shared caches
- Custom namespaces
- Handles caching a response body through [json-buffer](https://www.npmjs.com/package/json-buffer)
- Normalizes urls to increase cache hits
- Retry failed requests, using fine grained retry semantics powered by [async-retry](https://github.com/vercel/async-retry)
- Written in strict Typescript
- BYOF (Bring Your Own Fetch)

## Usage

Install Fetch Hero

```bash
$ npm install --save @jsonhero/fetch-hero
```

`fetchHero` wraps the `fetch` function and returns a new `fetch` function, with the exact same interface

```js
const fetchHero = require("@jsonhero/fetch-hero");
const nodeFetch = require("node-fetch");

const fetch = fetchHero(nodeFetch);

// Now use fetch exactly how you would without fetchHero
const response = await fetch("http://google.com");
```

By default http semantic caching is disabled, you can enable it by setting the `httpCache.enabled` option to `true`

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

You can also pass any connection string to `cache.store` that [Keyv](https://github.com/jaredwray/keyv).

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

You can supply a custom namespace using the `cache.namespace` option

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
    shared: false,
    store: "redis://user:pass@localhost:6379",
  },
});

// Using the user identifier so we don't mix cached responses
await fetch("http://test.dev/private", {
  fh: { cache: { namespace: user.identifier } },
});
```

As you can see, the `fetch` function above accepts a non-standard `fh` property, allowing you to customize Fetch Hero behaviour on a per request basis. See the [RequestInitFhProperties]() documentation for more info.

## HTTP Cache semantic bypassing

You can bypass the HTTP caching semantics on GET and HEAD requests by passing the `bypass` option with a `ttl` in seconds, like so:

```typescript
const fetch = fetchHero(nodeFetch, {
  httpCache: { enabled: true, bypass: { ttl: 120 } }, // 120 seconds
});

await fetch("http://test.dev/foo");
// This will ignore the response headers and return a cached response
await fetch("http://test.dev/foo");
```

This will force requests to return cached responses for 120 seconds after the first fresh request is made, bypassing the HTTP cache semantics of the response headers.

### Retrying

You can enable retrying to retry requests with failed responses:

```typescript
const fetch = fetchHero(nodeFetch, {
  retrying: { enabled: true },
});

await fetch("http://test.dev/foo"); // Will retry up to 3 times if response is 500, 502, 503, or 504
```

You can customize which response codes will be retried:

```typescript
const fetch = fetchHero(nodeFetch, {
  retrying: { enabled: true, retryOn: [429] }, // Only retry when there is a 429 error
});

await fetch("http://test.dev/foo"); // Will retry up to 3 times if response is 429
```

You can also customize the [async-retry options](https://github.com/vercel/async-retry):

````typescript
const fetch = fetchHero(nodeFetch, {
  retrying: { enabled: true, options: { retries: 10, factor: 1.2, minTimeout: 250, maxTimeout: 10000, randomize: true } }
});

await fetch("http://test.dev/foo");
```

## Storage Adapters

View the [Keyv documentation](https://github.com/jaredwray/keyv) to learn more about the storage adapters that Fetch Hero supports.

## API

### `fetchHero` function

### `FetchHeroOptions` object

### `RequestInitFhProperties` properties

An object containing FetchHero-specific properties that can be set on the Request object. For example:

```js
// Disable catching for this request
fetch(event.request, { fh: { httpCache: { enabled: false } } });
````

#### `httpCache` _optional_

An object to customize the http caching behaviour of FetchHero, with the following parameters:

| Parameter   | Type                           | Description                                                                                                                                          |
| :---------- | :----------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------- |
| `enabled`   | `boolean`                      | Set to false to disable caching for the request. If `fetchHero` was initialized without caching disabled, setting this to `true` will have no effect |
| `namespace` | `string`                       | Set a custom namespace for the request.                                                                                                              |
| `options`   | `CachePolicy.Options`          | Set custom [CachePolicy.Options](#cache-policy-options) object for the request                                                                       |
| `bypass`    | `HTTPSemanticBypassingOptions` | Set custom [HTTPSemanticBypassingOptions](#cache-policy-options) object for the request                                                              |

#### `HTTPSemanticBypassingOptions`

An object to customize the http semantic caching bypassing behaviour of FetchHero, with the following parameters:

| Parameter | Type     | Description                                             |
| :-------- | :------- | :------------------------------------------------------ |
| `ttl`     | `number` | Number of seconds to bypass HTTP caching semantics for. |

## Roadmap

- [ ] Support for [minipass-fetch](https://github.com/npm/minipass-fetch)
- [ ] Proxy support
- [ ] GZIP support
- [ ] Request pooling
- [ ] Persistent connections
- [ ] Limit memory usage
- [ ] Add performance tests
