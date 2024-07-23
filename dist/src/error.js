"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NetworkError = exports.TimeoutError = exports.ServiceUnavailableError = exports.EHAPIError = void 0;
class EHAPIError extends Error {
    constructor(message, statusCode, detail) {
        super(message);
        this.name = "EHAPIError";
        this.statusCode = statusCode;
        this.detail = detail;
    }
}
exports.EHAPIError = EHAPIError;
class ServiceUnavailableError extends Error {
    constructor(detail) {
        super();
        this.name = "ServiceUnavailableError";
        this.message = "服务不可用，图像配额可能耗尽";
        this.statusCode = 503;
        this.detail = detail;
    }
}
exports.ServiceUnavailableError = ServiceUnavailableError;
class TimeoutError extends Error {
    constructor(detail) {
        super();
        this.name = "TimeoutError";
        this.message = "请求超时";
        this.detail = detail;
    }
}
exports.TimeoutError = TimeoutError;
class NetworkError extends Error {
    constructor(detail) {
        super();
        this.name = "NetworkError";
        this.message = "未知网络错误";
        this.detail = detail;
    }
}
exports.NetworkError = NetworkError;
