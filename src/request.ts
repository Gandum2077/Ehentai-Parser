// 判断运行环境，来决定使用哪种API
// 只实现两种基本功能：GET、POST
// 只处理三种返回：image、text、json

import { EHNetworkError, EHServiceUnavailableError, EHTimeoutError } from "./error";

enum ENV {
  NODE = 0,
  JSBOX = 1
}

let env: ENV;
if (typeof process !== 'undefined' && process.versions && process.versions.node > "17.5" || typeof fetch !== 'undefined') {
  env = ENV.NODE;
} else if (typeof $http !== 'undefined' && $http.request !== undefined) {
  env = ENV.JSBOX;
} else {
  throw new Error('环境不支持');
}

class RequestResponse {
  statusCode: number
  contentType: string
  _response?: Response
  _resp?: HttpTypes.HttpResponse
  constructor({
    statusCode,
    contentType,
    response,
    resp
  }: {
    statusCode: number;
    contentType: string;
    response?: Response;
    resp?: HttpTypes.HttpResponse;
  }) {
    this.statusCode = statusCode
    this.contentType = contentType
    if (env === ENV.NODE) {
      this._response = response
    } else if (env === ENV.JSBOX) {
      this._resp = resp
    } else {
      throw new Error('环境不支持');
    }
  }

  async buffer() {
    if (env === ENV.NODE && this._response) {
      const arrayBuffer = await this._response.arrayBuffer()
      return Buffer.from(arrayBuffer)
    } else {
      throw new Error('环境不支持');
    }

  }

  rawData() {
    if (env === ENV.JSBOX && this._resp) {
      return this._resp.rawData
    } else {
      throw new Error('环境不支持');
    }
  }

  async text() {
    if (env === ENV.NODE && this._response) {
      return await this._response.text()
    } else if (env === ENV.JSBOX && this._resp) {
      return this._resp.data as string
    } else {
      throw new Error('环境不支持');
    }
  }

  async json() {
    if (env === ENV.NODE && this._response) {
      return await this._response.json()
    } else if (env === ENV.JSBOX && this._resp) {
      return this._resp.data
    } else {
      throw new Error('环境不支持');
    }
  }
}

async function __request(
  method: "GET" | "POST",
  url: string,
  header: Record<string, string>,
  timeout: number,
  body?: Record<string, string | number>
): Promise<RequestResponse> {
  let statusCode: number
  let contentType: string
  if (env === ENV.NODE) {
    let bodyStr = ''
    if (body) {
      if (header['Content-Type'] === 'application/x-www-form-urlencoded') {
        const abody = Object.entries(body).map(n => ([n[0], n[1].toString()]))
        bodyStr = new URLSearchParams(abody).toString()
      } else {
        header['Content-Type'] = 'application/json'
        bodyStr = JSON.stringify(body)
      }
    }
    const response = (method === "GET")
      ? await fetch(url, { method: method, headers: header, signal: AbortSignal.timeout(timeout * 1000) })
      : await fetch(url, { method: method, headers: header, body: bodyStr, signal: AbortSignal.timeout(timeout * 1000) })
    if (response.status > 500) throw new EHServiceUnavailableError(`Server error! status: ${response.status}\nurl: ${url}`, response.status);
    if (!response.ok) throw new EHNetworkError(`HTTP error! status: ${response.status}\nurl: ${url}`, response.status);
    statusCode = response.status
    contentType = response.headers.get('Content-Type') || '';
    return new RequestResponse({ statusCode, contentType, response })
  } else if (env === ENV.JSBOX) {
    const resp = await $http.request({
      method: method,
      url: url,
      header: header,
      body: body,
      timeout: timeout
    })
    if (resp.error) {
      console.error(resp.error)
      console.error(resp.response)
      if (resp.error.code === -1001) { // HttpTypes.NSURLErrorDomain.NSURLErrorTimedOut
        throw new EHTimeoutError(`Timeout Error! url: ${url}`);
      } else if (!resp.response || !resp.response.statusCode) {
        throw new EHNetworkError(`Network Error! \nurl: ${url}\nheader: ${JSON.stringify(header)}\nbody: ${JSON.stringify(body)}`);
      }
    }
    statusCode = resp.response.statusCode
    if (statusCode >= 500) throw new EHServiceUnavailableError(`Server error! status: ${statusCode}\nurl: ${url}`, statusCode);
    if (statusCode >= 400) throw new EHNetworkError(`HTTP error! status: ${statusCode}\nurl: ${url}`, statusCode);
    contentType = resp.response.headers['Content-Type'] || '';
    return new RequestResponse({ statusCode, contentType, resp })
  } else {
    throw new Error('环境不支持');
  }
}

export async function get(
  url: string,
  header: Record<string, string>,
  timeout: number
): Promise<RequestResponse> {
  return await __request('GET', url, header, timeout)
}

export async function post(
  url: string,
  header: Record<string, string>,
  body: Record<string, string | number>,
  timeout: number
): Promise<RequestResponse> {
  return await __request('POST', url, header, timeout, body)
}
