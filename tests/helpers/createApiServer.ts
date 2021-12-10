import * as http from "http";
import { URL } from "url";
import Router from "url-router";
import jsonBody from "body/json";

type Primitive = bigint | boolean | null | number | string | symbol | undefined;

type JSONValue = Primitive | JSONObject | JSONArray;

interface JSONObject {
  [key: string]: JSONValue;
}

interface JSONArray extends Array<JSONValue> {}

type APIFunctionRoute = (
  params: {
    [key: string]: Primitive;
  },
  res: http.ServerResponse,
  body?: any
) => JSONObject | JSONArray | "end" | undefined;

type APIObjectRoute = {
  auth?: (
    params: { [key: string]: Primitive },
    req: http.IncomingMessage
  ) => boolean;
  handler: APIFunctionRoute;
};

type APIRoute = JSONObject | JSONArray | APIFunctionRoute | APIObjectRoute;

interface APIOptions {
  port?: number;
  routes: { [key: string]: APIRoute };
  headers?: Record<string, string>;
}

type RouteParams = { [key: string]: Primitive };

type RouteHandler = (
  url: URL,
  params: RouteParams,
  request: http.IncomingMessage,
  response: http.ServerResponse,
  body?: any
) => void;

export interface APIServer {
  port: number;
  close: () => Promise<void>;
  requests: Array<http.IncomingMessage>;
}

class NodeAPIServer implements APIServer {
  server: http.Server;
  port: number;
  requests: Array<http.IncomingMessage> = [];

  constructor(port: number, cb: (server: http.Server) => void) {
    this.server = http.createServer();
    this.port = port;

    cb(this.server);
  }

  async close(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.server.close(() => resolve());
    });
  }
}

function callAPIFunctionRoute(
  handler: APIFunctionRoute,
  params: RouteParams,
  url: URL,
  res: http.ServerResponse,
  body?: any
): void {
  const jsonResponse = handler(params, res, body);

  if (jsonResponse === "end") {
    return;
  }

  if (jsonResponse) {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(jsonResponse), "utf-8");
  } else {
    res.writeHead(404, `${url.pathname} not found`);
    res.end();
  }
}

export async function createApiServer(options: APIOptions): Promise<APIServer> {
  const port = options.port ?? 3000;

  const router = new Router();

  Object.keys(options.routes).forEach((routePath) => {
    const apiRoute = options.routes[routePath];

    router.add(
      routePath,
      (
        url: URL,
        params: { [key: string]: Primitive },
        request: http.IncomingMessage,
        response: http.ServerResponse
      ) => {
        if ("auth" in apiRoute && typeof apiRoute.auth === "function") {
          if (!apiRoute.auth(params, request)) {
            response.writeHead(401);
            response.end();
            return;
          }
        }

        const headers = options.headers;

        if (headers) {
          // Set all response headers to the ones specified in the options, with headers possibly being undefined
          Object.keys(headers).forEach((header) => {
            response.setHeader(header, headers[header]);
          });
        }

        if ("handler" in apiRoute && typeof apiRoute.handler === "function") {
          callAPIFunctionRoute(apiRoute.handler, params, url, response);
        } else if (typeof apiRoute === "function") {
          callAPIFunctionRoute(apiRoute, params, url, response);
        } else {
          response.writeHead(200, { "Content-Type": "application/json" });
          response.end(JSON.stringify(apiRoute), "utf-8");
        }
      }
    );
  });

  const NotFound = (
    url: URL,
    params: { [key: string]: Primitive },
    request: http.IncomingMessage,
    response: http.ServerResponse
  ) => {
    response.writeHead(404);
    response.end();
  };

  router.add("(.*)", NotFound);

  return new Promise<APIServer>((resolve, reject) => {
    const apiServer = new NodeAPIServer(port, (server) => {
      server.on("request", (request, response) => {
        const url = new URL(request.url!, `http://${request.headers.host}`);

        const route = router.find(url.pathname);

        if (!route) {
          return NotFound(url, {}, request, response);
        }

        const handler = route.handler as RouteHandler;
        const params = route.params as RouteParams;

        apiServer.requests.push(request);

        switch (request.method) {
          case "GET":
            handler(url, params, request, response);
            break;
          case "POST":
            jsonBody(request, response, (err, body) => {
              if (err) {
                response.writeHead(400);
                response.end();
                return;
              }

              handler(url, params, request, response, body);
            });
            break;
        }
      });

      server.listen(port, () => {
        resolve(apiServer);
      });

      server.on("error", (e) => {
        reject(e);
      });
    });
  });
}
