import * as nodeFetch from "node-fetch";

global.Request = nodeFetch.Request as unknown as typeof global.Request;
global.Headers = nodeFetch.Headers as unknown as typeof global.Headers;
global.Response = nodeFetch.Response as unknown as typeof global.Response;
