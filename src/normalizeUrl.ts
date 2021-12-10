import { URL, URLSearchParams } from "node:url";

export interface Options {
  readonly stripProtocol?: boolean;
  readonly stripHash?: boolean;
  readonly stripWWW?: boolean;
  readonly removeTrailingSlash?: boolean;
  readonly removeSingleSlash?: boolean;
}

/**
[Normalize](https://en.wikipedia.org/wiki/URL_normalization) a URL.

@param url - URL to normalize, including [data URL](https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/Data_URIs).

@example
```
import normalizeUrl from 'normalize-url';

normalizeUrl('sindresorhus.com');
//=> 'http://sindresorhus.com'

normalizeUrl('//www.sindresorhus.com:80/../baz?b=bar&a=foo');
//=> 'http://sindresorhus.com/baz?a=foo&b=bar'
```
*/

export default function normalizeUrl(
  urlOrString: URL | string,
  options: Options
): string {
  const url = urlOrString instanceof URL ? urlOrString : new URL(urlOrString);

  if (options.stripHash) {
    url.hash = "";
  }

  if (options.stripWWW) {
    url.host = url.host.replace(/^www\./, "");
  }

  if (options.removeTrailingSlash || options.removeSingleSlash) {
    const path = url.pathname.replace(/\/$/, "");

    if (options.removeTrailingSlash) {
      url.pathname = path;
    } else if (options.removeSingleSlash) {
      url.pathname = path.replace(/\/\//, "/");
    }
  }

  if (options.stripProtocol) {
    url.protocol = "";
  }

  return url.toString();
}
