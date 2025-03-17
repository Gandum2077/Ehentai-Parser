"use strict";
// 判断运行环境，来决定使用哪种API
// 只实现两种基本功能：GET、POST
// 只处理三种返回：image、text、json
Object.defineProperty(exports, "__esModule", { value: true });
exports.downloadWithTimeout = exports.post = exports.get = void 0;
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
/**
 * 给JSBox擦屁股，将合并的Set-Cookie重新分开
 * @param setCookieStr string
 * @returns string[]
 */
function splitCookiesString(setCookieStr) {
    if (!setCookieStr)
        return [];
    const cookies = [];
    let currentCookie = "";
    let inExpires = false;
    for (let i = 0; i < setCookieStr.length; i++) {
        const char = setCookieStr[i];
        if (char === ",") {
            // 如果当前处于 expires 属性中（日期中的逗号），则直接加入当前 cookie
            if (inExpires) {
                currentCookie += char;
            }
            else {
                // 否则认为这是一个 cookie 的分隔符
                cookies.push(currentCookie.trim());
                currentCookie = "";
                // 跳过逗号后面的空格
                while (setCookieStr[i + 1] === " ") {
                    i++;
                }
            }
        }
        else {
            currentCookie += char;
            // 检测是否刚刚开始处理 expires 属性
            if (!inExpires && currentCookie.toLowerCase().endsWith("; expires=")) {
                inExpires = true;
            }
            // 如果在 expires 中，遇到 GMT 表示日期结束，可以退出 expires 状态
            if (inExpires && currentCookie.indexOf("GMT") !== -1) {
                inExpires = false;
            }
        }
    }
    if (currentCookie) {
        cookies.push(currentCookie.trim());
    }
    return cookies;
}
/**
 * 将单个的setCookie分解为格式化的数据
 * @param cookieStr string
 * @returns ParsedCookie
 */
function parseCookieString(cookieStr) {
    // 将单个 cookie 字符串以分号拆分成各部分
    const parts = cookieStr.split(";").map((part) => part.trim());
    const [nameValue, ...attributes] = parts;
    // 考虑 cookie value 可能包含 '=' 号
    const [name, ...valueParts] = nameValue.split("=");
    const value = valueParts.join("=");
    const cookieObj = { name, value };
    // 解析其他属性（例如 expires、path、domain 等）
    attributes.forEach((attr) => {
        const [key, ...rest] = attr.split("=");
        const keyLower = key.trim().toLowerCase();
        const val = rest.join("=").trim();
        switch (keyLower) {
            case "domain":
                if (val) {
                    cookieObj.domain = val;
                }
                break;
            case "path":
                if (val) {
                    cookieObj.path = val;
                }
                break;
            case "version":
                if (val) {
                    cookieObj.version = parseInt(val);
                }
                break;
            case "sessiononly":
                if (val) {
                    cookieObj.SessionOnly = true;
                }
                break;
            case "secure":
                cookieObj.Secure = true;
                break;
            case "httponly":
                cookieObj.HttpOnly = true;
                break;
            default:
                // 其它未知属性可忽略或按需处理
                break;
        }
    });
    return cookieObj;
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
            if (typeof this._resp.data === "string") {
                return this._resp.data;
            }
            else {
                return "";
            }
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
            const setCookieStrs = this._response.headers.getSetCookie();
            return setCookieStrs.map((n) => parseCookieString(n));
        }
        else if (env === ENV.JSBOX && this._resp) {
            const setCookieStrs = splitCookiesString(this._resp.response.headers["Set-Cookie"]);
            return setCookieStrs.map((n) => parseCookieString(n));
        }
        else {
            throw new Error("环境不支持");
        }
    }
}
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
// 定义一个有timeout的下载函数，通过Promise.race实现
function withTimeout(promise, timeoutMs) {
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new error_1.EHTimeoutError("Timeout error on download")), timeoutMs));
    return Promise.race([promise, timeoutPromise]);
}
async function _download(url, header) {
    const resp = await $http.download({ url, header });
    return resp;
}
async function downloadWithTimeout({ url, header, timeout, }) {
    const resp = await withTimeout(_download(url, header), timeout * 1000);
    return resp;
}
exports.downloadWithTimeout = downloadWithTimeout;
