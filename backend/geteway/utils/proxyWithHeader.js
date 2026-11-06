import proxy from "express-http-proxy"

const TOKEN_HEADER = "x-service-token";

/**
 * Proxies to an internal service and injects the trusted identity headers.
 * Client-supplied values for these headers are overwritten, never forwarded.
 */
export const proxyWithHeader = (serviceUrl, options = {}) => {
    return proxy(serviceUrl, {
        proxyReqPathResolver: options.path ? () => options.path : undefined,
        proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
            if (srcReq.userId) {
                proxyReqOpts.headers["x-user-id"] = srcReq.userId
            }
            if (process.env.INTERNAL_SERVICE_TOKEN) {
                proxyReqOpts.headers[TOKEN_HEADER] = process.env.INTERNAL_SERVICE_TOKEN
            }
            return proxyReqOpts
        }
    })
}
