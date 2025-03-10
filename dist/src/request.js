"use strict";
// 判断运行环境，来决定使用哪种API
// 只实现两种基本功能：GET、POST
// 只处理三种返回：image、text、json
Object.defineProperty(exports, "__esModule", { value: true });
exports.post = exports.get = exports.parseSetCookie = void 0;
const error_1 = require("./error");
const parser_1 = require("./parser");
var ENV;
(function (ENV) {
    ENV[ENV["NODE"] = 0] = "NODE";
    ENV[ENV["JSBOX"] = 1] = "JSBOX";
})(ENV || (ENV = {}));
let env;
if ((typeof process !== "undefined" &&
    process.versions &&
    process.versions.node > "17.5") ||
    typeof fetch !== "undefined") {
    env = ENV.NODE;
}
else if (typeof $http !== "undefined" && $http.request !== undefined) {
    env = ENV.JSBOX;
}
else {
    throw new Error("环境不支持");
}
class RequestResponse {
    constructor({ statusCode, contentType, response, resp, }) {
        this.statusCode = statusCode;
        this.contentType = contentType;
        if (env === ENV.NODE) {
            this._response = response;
        }
        else if (env === ENV.JSBOX) {
            this._resp = resp;
        }
        else {
            throw new Error("环境不支持");
        }
    }
    async buffer() {
        if (env === ENV.NODE && this._response) {
            const arrayBuffer = await this._response.arrayBuffer();
            return Buffer.from(arrayBuffer);
        }
        else {
            throw new Error("环境不支持");
        }
    }
    rawData() {
        if (env === ENV.JSBOX && this._resp) {
            return this._resp.rawData;
        }
        else {
            throw new Error("环境不支持");
        }
    }
    async text() {
        if (env === ENV.NODE && this._response) {
            return await this._response.text();
        }
        else if (env === ENV.JSBOX && this._resp) {
            return this._resp.data;
        }
        else {
            throw new Error("环境不支持");
        }
    }
    async json() {
        if (env === ENV.NODE && this._response) {
            return await this._response.json();
        }
        else if (env === ENV.JSBOX && this._resp) {
            return this._resp.data;
        }
        else {
            throw new Error("环境不支持");
        }
    }
    setCookie() {
        if (env === ENV.NODE && this._response) {
            return parseSetCookie(this._response.headers.get("Set-Cookie"));
        }
        else if (env === ENV.JSBOX && this._resp) {
            return parseSetCookie(this._resp.response.headers["Set-Cookie"]);
        }
        else {
            throw new Error("环境不支持");
        }
    }
}
function parseSetCookie(setCookieString) {
    if (!setCookieString)
        return [];
    const regex0 = /^([^;=]+)=([^;]+);/;
    const regex = /, ([^;=]+)=([^;]+);/g;
    const found0 = regex0.exec(setCookieString)?.slice(1);
    const found = [...setCookieString.matchAll(regex)].map((n) => [n[1], n[2]]);
    if (found0)
        found.unshift(found0);
    return found;
}
exports.parseSetCookie = parseSetCookie;
async function __request({ method, url, header, timeout, body, checkCopyrightError, }) {
    let statusCode;
    let contentType;
    if (env === ENV.NODE) {
        let bodyStr = "";
        if (body) {
            if (header["Content-Type"] === "application/x-www-form-urlencoded") {
                const abody = Object.entries(body).map((n) => [n[0], n[1].toString()]);
                bodyStr = new URLSearchParams(abody).toString();
            }
            else {
                header["Content-Type"] = "application/json";
                bodyStr = JSON.stringify(body);
            }
        }
        const response = method === "GET"
            ? await fetch(url, {
                method: method,
                headers: header,
                signal: AbortSignal.timeout(timeout * 1000),
            })
            : await fetch(url, {
                method: method,
                headers: header,
                body: bodyStr,
                signal: AbortSignal.timeout(timeout * 1000),
            });
        if (response.status === 509) {
            throw new error_1.EHBandwidthLimitExceededError(`509 error! status: ${response.status}\nurl: ${url}`);
        }
        else if (response.status >= 500) {
            throw new error_1.EHServerError(`Server error! status: ${response.status}\nurl: ${url}`, response.status);
        }
        else if (!response.ok) {
            if (response.status === 404 && checkCopyrightError) {
                const result = (0, parser_1.parseCopyrightPage)(await response.text());
                if (result.unavailable) {
                    throw new error_1.EHCopyrightError(result.copyrightOwner);
                }
            }
            throw new error_1.EHNetworkError(`HTTP error! status: ${response.status}\nurl: ${url}`, response.status);
        }
        else {
            const setCookie = parseSetCookie(response.headers.get("Set-Cookie"));
            console.log(setCookie);
            if (setCookie.some((n) => n[0] === "igneous" && n[1] === "mystery")) {
                throw new error_1.EHIgneousExpiredError();
            }
        }
        statusCode = response.status;
        contentType = response.headers.get("Content-Type") || "";
        return new RequestResponse({ statusCode, contentType, response });
    }
    else if (env === ENV.JSBOX) {
        const resp = await $http.request({
            method: method,
            url: url,
            header: header,
            body: body,
            timeout: timeout,
        });
        if (resp.error) {
            console.error(resp.error);
            console.error(resp.response);
            if (resp.error.code === -1001) {
                // HttpTypes.NSURLErrorDomain.NSURLErrorTimedOut
                throw new error_1.EHTimeoutError(`Timeout Error! url: ${url}`);
            }
            else if (!resp.response || !resp.response.statusCode) {
                throw new error_1.EHNetworkError(`Network Error! \nurl: ${url}\nheader: ${JSON.stringify(header)}\nbody: ${JSON.stringify(body)}`);
            }
        }
        statusCode = resp.response.statusCode;
        if (statusCode === 509) {
            throw new error_1.EHBandwidthLimitExceededError(`509 error! status: ${statusCode}\nurl: ${url}`);
        }
        else if (statusCode >= 500) {
            throw new error_1.EHServerError(`Server error! status: ${statusCode}\nurl: ${url}`, statusCode);
        }
        else if (statusCode >= 400) {
            if (statusCode === 404 &&
                checkCopyrightError &&
                typeof resp.data === "string") {
                const result = (0, parser_1.parseCopyrightPage)(resp.data);
                if (result.unavailable) {
                    throw new error_1.EHCopyrightError(result.copyrightOwner);
                }
            }
            throw new error_1.EHNetworkError(`HTTP error! status: ${statusCode}\nurl: ${url}`, statusCode);
        }
        else {
            const setCookie = parseSetCookie(resp.response.headers["Set-Cookie"]);
            if (setCookie.some((n) => n[0] === "igneous" && n[1] === "mystery")) {
                throw new error_1.EHIgneousExpiredError();
            }
        }
        contentType = resp.response.headers["Content-Type"] || "";
        return new RequestResponse({ statusCode, contentType, resp });
    }
    else {
        throw new Error("环境不支持");
    }
}
async function get(url, header, timeout, checkCopyrightError) {
    return await __request({
        method: "GET",
        url,
        header,
        timeout,
        checkCopyrightError,
    });
}
exports.get = get;
async function post(url, header, body, timeout) {
    return await __request({ method: "POST", url, header, timeout, body });
}
exports.post = post;
