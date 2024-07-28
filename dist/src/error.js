"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EHNetworkError = exports.EHTimeoutError = exports.EHServiceUnavailableError = exports.EHAPIError = void 0;
class EHAPIError extends Error {
    constructor(message, statusCode, detail) {
        super(message);
        this.name = "EHAPIError";
        this.statusCode = statusCode;
        this.detail = detail;
    }
}
exports.EHAPIError = EHAPIError;
class EHServiceUnavailableError extends Error {
    constructor(detail) {
        super();
        this.name = "EHServiceUnavailableError";
        this.message = "服务不可用，图像配额可能耗尽";
        this.statusCode = 503;
        this.detail = detail;
    }
}
exports.EHServiceUnavailableError = EHServiceUnavailableError;
class EHTimeoutError extends Error {
    constructor(detail) {
        super();
        this.name = "EHTimeoutError";
        this.message = "请求超时";
        this.detail = detail;
    }
}
exports.EHTimeoutError = EHTimeoutError;
class EHNetworkError extends Error {
    constructor(detail) {
        super();
        this.name = "EHNetworkError";
        this.message = "未知网络错误";
        this.detail = detail;
    }
}
exports.EHNetworkError = EHNetworkError;
