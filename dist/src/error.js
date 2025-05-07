"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EHImageLookupTooManyRequestsError = exports.EHNetworkError = exports.EHTimeoutError = exports.EHInsufficientFundError = exports.EHCopyrightError = exports.EHBandwidthLimitExceededError = exports.EHServerError = exports.EHIPBannedError = exports.EHIgneousExpiredError = exports.EHAPIError = void 0;
class EHAPIError extends Error {
    constructor(message, statusCode, detail) {
        super(message);
        this.name = "EHAPIError";
        this.statusCode = statusCode;
        this.detail = detail;
    }
}
exports.EHAPIError = EHAPIError;
class EHIgneousExpiredError extends Error {
    constructor() {
        super();
        this.name = "EHIgneousExpiredError";
        this.message = "igneous过期";
    }
}
exports.EHIgneousExpiredError = EHIgneousExpiredError;
class EHIPBannedError extends Error {
    constructor(detail) {
        super();
        this.name = "EHIPBannedError";
        this.message = "IP被禁止";
        this.detail = detail;
    }
}
exports.EHIPBannedError = EHIPBannedError;
class EHServerError extends Error {
    constructor(detail, statusCode) {
        super();
        this.name = "EHServerError";
        this.message = "服务器错误";
        this.statusCode = 500;
        this.detail = detail;
        if (statusCode) {
            this.statusCode = statusCode;
        }
    }
}
exports.EHServerError = EHServerError;
class EHBandwidthLimitExceededError extends Error {
    constructor(detail) {
        super();
        this.name = "EHBandwidthLimitExceededError";
        this.message = "带宽限制已超出";
        this.statusCode = 509;
        this.detail = detail;
    }
}
exports.EHBandwidthLimitExceededError = EHBandwidthLimitExceededError;
class EHCopyrightError extends Error {
    constructor(copyrightOwner) {
        super();
        this.name = "EHCopyrightError";
        this.message = "由于版权原因被删除";
        this.statusCode = 404;
        this.copyrightOwner = copyrightOwner;
    }
}
exports.EHCopyrightError = EHCopyrightError;
class EHInsufficientFundError extends Error {
    constructor(detail) {
        super();
        this.name = "EHInsufficientFundError";
        this.message = "资金不足";
        this.detail = detail;
    }
}
exports.EHInsufficientFundError = EHInsufficientFundError;
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
    constructor(detail, statusCode) {
        super();
        this.name = "EHNetworkError";
        this.message = "未知网络错误";
        this.detail = detail;
        if (statusCode) {
            this.statusCode = statusCode;
        }
    }
}
exports.EHNetworkError = EHNetworkError;
class EHImageLookupTooManyRequestsError extends Error {
    constructor(detail) {
        super();
        this.name = "EHImageLookupTooManyRequestsError";
        this.message = "图片搜索过于频繁";
        this.detail = detail;
    }
}
exports.EHImageLookupTooManyRequestsError = EHImageLookupTooManyRequestsError;
