// 通用错误接口
interface AppError {
  name: string;
  message: string;
  detail?: string;
  stack?: string;
  statusCode?: number;
  level?: "warn" | "error";
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

export class EHServiceUnavailableError extends Error implements AppError {
  name = "EHServiceUnavailableError";
  message = "服务不可用，图像配额可能耗尽";
  statusCode = 503;
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

  constructor(detail?: string) {
    super();
    this.detail = detail;
  }
}