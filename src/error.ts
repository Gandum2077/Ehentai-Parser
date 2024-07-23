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

export class ServiceUnavailableError extends Error implements AppError {
  name = "ServiceUnavailableError";
  message = "服务不可用，图像配额可能耗尽";
  statusCode = 503;
  detail?: string;

  constructor(detail?: string) {
    super();
    this.detail = detail;
  }
}

export class TimeoutError extends Error implements AppError {
  name = "TimeoutError";
  message = "请求超时";
  detail?: string;

  constructor(detail?: string) {
    super();
    this.detail = detail;
  }
}

export class NetworkError extends Error implements AppError {
  name = "NetworkError";
  message = "未知网络错误";
  detail?: string;

  constructor(detail?: string) {
    super();
    this.detail = detail;
  }
}