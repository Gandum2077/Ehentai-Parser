// 通用错误接口
interface AppError {
  name: string;
  message: string;
  detail?: string;
  stack?: string;
  statusCode?: number;
}

export class EHAPIError extends Error implements AppError {
  name = "EHAPIError";
  detail?: string;
  statusCode: number;

  constructor(message: string, statusCode: number, detail?: string) {
    super(message);
    this.statusCode = statusCode;
    this.detail = detail;
  }
}

export class EHIgneousExpiredError extends Error implements AppError {
  name = "EHIgneousExpiredError";
  message: string = "igneous过期";
  constructor() {
    super();
  }
}

export class EHIPBannedError extends Error implements AppError {
  name = "EHIPBannedError";
  message = "IP被禁止";
  detail?: string;

  constructor(detail?: string) {
    super();
    this.detail = detail;
  }
}

export class EHServerError extends Error implements AppError {
  name = "EHServerError";
  message = "服务器错误";
  statusCode = 500;
  detail?: string;

  constructor(detail?: string, statusCode?: number) {
    super();
    this.detail = detail;
    if (statusCode) {
      this.statusCode = statusCode;
    }
  }
}

export class EHBandwidthLimitExceededError extends Error implements AppError {
  name = "EHBandwidthLimitExceededError";
  message = "带宽限制已超出";
  statusCode = 509;
  detail?: string;

  constructor(detail?: string) {
    super();
    this.detail = detail;
  }
}

export class EHCopyrightError extends Error implements AppError {
  name = "EHCopyrightError";
  message = "由于版权原因被删除";
  statusCode = 404;
  copyrightOwner?: string;

  constructor(copyrightOwner?: string) {
    super();
    this.copyrightOwner = copyrightOwner;
  }
}

export class EHInsufficientFundError extends Error implements AppError {
  name = "EHInsufficientFundError";
  message = "资金不足";
  detail?: string;

  constructor(detail?: string) {
    super();
    this.detail = detail;
  }
}

export class EHTimeoutError extends Error implements AppError {
  name = "EHTimeoutError";
  message = "请求超时";
  detail?: string;

  constructor(detail?: string) {
    super();
    this.detail = detail;
  }
}

export class EHNetworkError extends Error implements AppError {
  name = "EHNetworkError";
  message = "未知网络错误";
  detail?: string;
  statusCode?: number;

  constructor(detail?: string, statusCode?: number) {
    super();
    this.detail = detail;
    if (statusCode) {
      this.statusCode = statusCode;
    }
  }
}
