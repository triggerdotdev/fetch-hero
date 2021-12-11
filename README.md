# Fetch Hero

![Coverage branches](./badges/badge-branches.svg)
![Coverage functions](./badges/badge-functions.svg)
![Coverage lines](./badges/badge-lines.svg)
![Coverage statements](./badges/badge-statements.svg)

Adds the following features to `node-fetch`:

- Enables RFC 7234 and RFC 5861 HTTP caching

## Install

```bash
$ npm install --save node-fetch-hero
```

## Usage

`fetchHero` wraps the `fetch` function and returns a new `fetch` function, with the exact same interface:

```typescript
import fetchHero from "node-fetch-hero";
import nodeFetch from "node-fetch";

const fetch = fetchHero(nodeFetch);

// Now use fetch exactly how you would without fetchHero
const response = await fetch("http://google.com");
```

```js
const fetchHero = require("node-fetch-hero");
const nodeFetch = require("node-fetch");

const fetch = fetchHero(nodeFetch);

// Now use fetch exactly how you would without fetchHero
const response = await fetch("http://google.com");
```

### Turn on caching:

> **Note**: All examples will be in Typescript from now on

```typescript
const fetch = fetchHero(nodeFetch, { httpCache: { enabled: true } });
```

By default `fetchHero` will use an in-memory cache.

### Customize the store

You can supply anything that implements the [Map](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map) interface:

```typescript
const customMap = new Map<any, any>();

const fetch = fetchHero(nodeFetch, {
  httpCache: { enabled: true, store: customMap },
});
```
