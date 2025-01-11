import Url from 'url-parse'
import { get, post } from './request'
import {
  parseList, parseGallery, parseMPV, parsePageInfo, parseConfig, parseFavcatFavnote, parseArchiverInfo,
  parseArchiveResult, parseMyUpload, parseMyTags, parseGalleryTorrentsInfo,
  parseShowpageInfo,
  parseEditableComment
} from './parser'
import {
  EHFavoritesList, EHPopularList, EHFrontPageList, EHWatchedList, TagNamespace,
  EHSearchOptions, EHFavoriteSearchOptions, EHSearchParams, EHFavoriteSearchParams,
  EHPage,
  EHTopList,
  EHUploadList,
  EHSearchTerm,
  TagNamespaceAlternate,
  EHQualifier,
  EHTopListSearchOptions,
  EHPopularSearchOptions,
  EHMyTags,
  EHGallery,
  EHFavoriteInfo,
  EHGalleryTorrent,
  EHArchive,
  EHMPV
} from './types'
import {
  ehQualifiers,
  tagNamespaceAlternateMap,
  tagNamespaceAlternates,
  tagNamespaceMostUsedAlternateMap,
  tagNamespaces
} from "./constant";
import { EHAPIError, EHIPBannedError } from './error'

const DEFAULT_USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"

function _updateUrlQuery(url: string, query: Record<string, any>, removeUndefined: boolean = false): string {
  const u = new Url(url, true)
  const newQuery = (removeUndefined)
    ? Object.fromEntries(Object.entries(query).filter(([k, v]) => v !== undefined))
    : query
  u.set('query', newQuery)
  return u.toString()
}

const EHCategoryNumber = {
  Doujinshi: 2,
  Manga: 4,
  "Artist CG": 8,
  "Game CG": 16,
  Western: 512,
  "Non-H": 256,
  "Image Set": 32,
  Cosplay: 64,
  "Asian Porn": 128,
  Misc: 1
}

export function assembleSearchTerms(searchTerms?: EHSearchTerm[]) {
  if (!searchTerms || searchTerms.length === 0) return "";
  return searchTerms.map(searchTerm => {
    if (searchTerm.namespace && searchTerm.qualifier && searchTerm.qualifier !== "weak") {
      throw new Error("命名空间和修饰词不能同时使用(weak除外)");
    }
    let result = "";
    if (searchTerm.qualifier) result += `${searchTerm.qualifier}:`;

    if (searchTerm.namespace) result += `${tagNamespaceMostUsedAlternateMap[searchTerm.namespace]}:`; // 添加命名空间
    let term = searchTerm.term;
    if (searchTerm.dollar) term += "$";
    if (term.includes(" ")) {
      term = `"${term}"`;
    }
    result += term;
    // 如果~和-同时使用，必须-在前，~在后，否则直接报错
    // 但实测并非ehentai搜索支持这种写法，而是后面的符号会被忽略
    if (searchTerm.tilde) result = `~${result}`;
    if (searchTerm.subtract) result = `-${result}`;
    return result;
  }).join(" ");
}

// SearchOptions to SearchParams
function _searchOptionsToParams(options: EHSearchOptions) {
  // 检查搜索参数是否合法
  if (options.range && (options.minimumGid || options.maximumGid || options.jump || options.seek)) {
    throw new Error("range参数与prev、next、jump、seek参数不兼容");
  }
  if (options.minimumGid && options.maximumGid) {
    throw new Error("prev和next参数不能同时使用");
  }
  if ((options.jump || options.seek) && !(options.minimumGid || options.maximumGid)) {
    throw new Error("jump和seek参数必须和prev或next参数一起使用");
  }
  if (options.jump && options.seek) {
    throw new Error("jump和seek参数不能同时使用");
  }

  let f_cats: number | undefined
  if (options.excludedCategories && options.excludedCategories.length > 0)
    f_cats = options.excludedCategories.reduce((acc, cur) => acc + EHCategoryNumber[cur], 0);
  if (f_cats === 1023) f_cats = undefined;
  const f_search = assembleSearchTerms(options.searchTerms);
  // // 只要用到了高级搜索，就要设置advsearch参数
  // const usingAdvancedSearch = options.browseExpungedGalleries
  //   || options.requireGalleryTorrent
  //   || options.minimumPages
  //   || options.maximumPages
  //   || options.minimumRating
  //   || options.disableLanguageFilters
  //   || options.disableUploaderFilters
  //   || options.disableTagFilters;
  // const advsearch = usingAdvancedSearch ? 1 : undefined;
  const f_sh = options.browseExpungedGalleries ? "on" : undefined;
  const f_sto = options.requireGalleryTorrent ? "on" : undefined;
  const f_spf = options.minimumPages || undefined;
  const f_spt = options.maximumPages || undefined;
  const f_srdd = options.minimumRating || undefined;
  const f_sfl = options.disableLanguageFilters ? "on" : undefined;
  const f_sfu = options.disableUploaderFilters ? "on" : undefined;
  const f_sft = options.disableTagFilters ? "on" : undefined;
  const range = options.range || undefined;
  const prev = options.minimumGid || undefined;
  const next = options.maximumGid || undefined;
  const jump = options.jump ? `${options.jump.value}${options.jump.unit}` : undefined;
  const seek = options.seek || undefined;

  const params: EHSearchParams = {
    f_cats,
    f_search,
    // advsearch,
    f_sh,
    f_sto,
    f_spf,
    f_spt,
    f_srdd,
    f_sfl,
    f_sfu,
    f_sft,
    range,
    prev,
    next,
    jump,
    seek
  }
  return params;
}

function _favoriteSearchOptionsToParams(options: EHFavoriteSearchOptions) {
  // 检查搜索参数是否合法
  if (options.minimumGid && options.maximumGid) {
    throw new Error("prev和next参数不能同时使用");
  }
  if (options.jump && options.seek) {
    throw new Error("jump和seek参数不能同时使用");
  }
  if (options.seek && /^\d\d\d\d-\d\d-\d\d$/.exec(options.seek) === null) {
    throw new Error("seek参数必须是一个符合格式的日期字符串");
  }
  const f_search = assembleSearchTerms(options.searchTerms);
  const favcat = options.favcat;
  let prev = options.minimumGid?.toString();
  if (prev && options.minimumFavoritedTimestamp) prev += `-${options.minimumFavoritedTimestamp}`;
  let next = options.maximumGid?.toString();
  if (next && options.maximumFavoritedTimestamp) next += `-${options.maximumFavoritedTimestamp}`;
  const jump = options.jump ? `${options.jump.value}${options.jump.unit}` : undefined;
  const seek = options.seek

  const params: EHFavoriteSearchParams = {
    f_search,
    favcat,
    prev,
    next,
    jump,
    seek
  }
  return params;
}

function _disassembleFsearch(fsearch: string) {
  // 双引号包裹的字符串视为一个整体，不会被分割。除此之外，空格分割。
  // 方法：首先有一个状态标记inQuote，初始为false。
  // 然后逐字遍历，第一次遇到双引号则inQuote=true，第二次则inQuote=false，以此类推。
  // 如果inQuote为true，则直到下一个双引号之前的空格都不会被分割。
  // 如果inQuote为false，则遇到空格就分割。

  let inQuote = false;
  let result: string[] = [];
  let current = "";
  for (let i = 0; i < fsearch.length; i++) {
    let c = fsearch[i];
    if (c === '"') inQuote = !inQuote;
    if (c === ' ' && !inQuote) {
      if (current) result.push(current);
      current = "";
    } else {
      current += c;
    }
  }
  if (current) result.push(current);
  return result;
}

function _parseSingleFsearch(fsearch: string): EHSearchTerm {
  // 转为全小写（实测ehentai搜索不区分大小写）
  fsearch = fsearch.toLowerCase();
  // 去掉引号
  fsearch = fsearch.replace(/"/g, "");
  // 去掉首尾空格
  fsearch = fsearch.trim();
  // 检测开头第一个字符：如果是`-`，则表示排除；如果是`~`，则表示或。
  let subtract = false;
  let tilde = false;
  if (fsearch[0] === "-") {
    subtract = true;
    fsearch = fsearch.slice(1);
  } else if (fsearch[0] === "~") {
    tilde = true;
    fsearch = fsearch.slice(1);
  }
  // 检测结尾第一个字符：如果是`$`，则表示精确搜索。
  let dollar = false;
  if (fsearch[fsearch.length - 1] === "$") {
    dollar = true;
    fsearch = fsearch.slice(0, -1);
  }

  // 注意：事实上ehentai搜索可以在开头或者结尾添加多个符号，但并非ehentai搜索支持这种写法，而是多余的符号会被忽略
  // 由于忽略的规则并不明确，这里不考虑这种情况

  // 然后以冒号为界分割
  const parts = fsearch.split(":").map(p => p.trimStart());
  // 实际检测发现，ehentai可以自动忽略修饰词前面的空格，但是不能忽略后面的
  // 比如" weak: f: anal  "是合法的，但是" weak :f: anal"是不合法的。

  // 如果超过4个部分，说明有多余的冒号，报错
  if (parts.length > 4) {
    throw new Error("Too many colons in a single fsearch term");
  }
  // 如果有三个部分，必须第一个部分为`weak`，第二个部分为tagNamespace或tagNamespaceAlternates，否则报错
  else if (parts.length === 3) {
    if (parts[0] !== "weak") {
      throw new Error("Invalid fsearch term with 3 parts, first part must be `weak`");
    }
    if (
      !tagNamespaces.includes(parts[1] as TagNamespace)
      && !tagNamespaceAlternates.includes(parts[1] as TagNamespaceAlternate)
    ) {
      throw new Error("Invalid tag namespace in fsearch term");
    }
    let namespace: TagNamespace;
    if (tagNamespaces.includes(parts[1] as TagNamespace)) {
      namespace = parts[1] as TagNamespace;
    } else {
      namespace = tagNamespaceAlternateMap[parts[1] as TagNamespaceAlternate];
    }
    return {
      namespace,
      qualifier: "weak",
      term: parts[2].replace(/_/g, " ").trim(),
      dollar,
      subtract,
      tilde,
    };

  }
  // 如果有两个部分，第一个部分必须为ehQualifiers或tagNamespace或tagNamespaceAlternates，否则报错
  else if (parts.length === 2) {
    let qualifier: EHQualifier | undefined;
    let namespace: TagNamespace | undefined;
    if (ehQualifiers.includes(parts[0] as EHQualifier)) {
      qualifier = parts[0] as EHQualifier;
    } else if (tagNamespaces.includes(parts[0] as TagNamespace)) {
      namespace = parts[0] as TagNamespace;
    } else if (tagNamespaceAlternates.includes(parts[0] as TagNamespaceAlternate)) {
      namespace = tagNamespaceAlternateMap[parts[0] as TagNamespaceAlternate];
    } else {
      throw new Error("Invalid tag namespace in fsearch term");
    }
    return {
      qualifier,
      namespace,
      term: parts[1].replace(/_/g, " ").trim(),
      dollar,
      subtract,
      tilde,
    };
  }
  // 如果只有一个部分，那么这个部分就是term
  else {
    return {
      term: parts[0].replace(/_/g, " ").trim(),
      dollar,
      subtract,
      tilde,
    };
  }
}

function _sortByKey(array: any[], key: string) {
  array.sort((a, b) => {
    if (a[key] === undefined) return 1;
    if (b[key] === undefined) return -1;
    if (a[key] < b[key]) return -1;
    if (a[key] > b[key]) return 1;
    return 0;
  });
}

function _sortSearchTerms(searchTerms: EHSearchTerm[]) {
  _sortByKey(searchTerms, "tilde");
  _sortByKey(searchTerms, "subtract");
  _sortByKey(searchTerms, "dollar");
  _sortByKey(searchTerms, "term");
  _sortByKey(searchTerms, "namespace");
  _sortByKey(searchTerms, "qualifier");
  return searchTerms;
}

export function parseFsearch(fsearch: string): EHSearchTerm[] {
  const parts = _disassembleFsearch(fsearch);
  return parts.map(_parseSingleFsearch);
}

export function buildSortedFsearch(searchTerms: EHSearchTerm[]) {
  _sortSearchTerms(searchTerms)
  return assembleSearchTerms(searchTerms)
}

const ehentaiUrls = {
  default: `https://e-hentai.org/`,
  homepage: `https://e-hentai.org/`,
  watched: `https://e-hentai.org/watched`,
  popular: `https://e-hentai.org/popular`,
  favorites: `https://e-hentai.org/favorites.php`,
  config: `https://e-hentai.org/uconfig.php`,
  api: `https://api.e-hentai.org/api.php`,
  gallerypopups: `https://e-hentai.org/gallerypopups.php`,
  toplist: "https://e-hentai.org/toplist.php",
  upload: `https://upld.e-hentai.org/manage?ss=d&sd=d`, // 自带按时间降序排序
  mytags: `https://e-hentai.org/mytags`,
  archiver: `https://e-hentai.org/archiver.php`,
  gallerytorrents: `https://e-hentai.org/gallerytorrents.php?gid=3015818&t=a8787bf44a`
}

const exhentaiUrls = {
  default: `https://exhentai.org/`,
  homepage: `https://exhentai.org/`,
  watched: `https://exhentai.org/watched`,
  popular: `https://exhentai.org/popular`,
  favorites: `https://exhentai.org/favorites.php`,
  config: `https://exhentai.org/uconfig.php`,
  api: `https://s.exhentai.org/api.php`,
  gallerypopups: `https://exhentai.org/gallerypopups.php`,
  toplist: "https://e-hentai.org/toplist.php",
  upload: `https://upld.exhentai.org/upld/manage?ss=d&sd=d`, // 自带按时间降序排序
  mytags: `https://exhentai.org/mytags`,
  archiver: `https://exhentai.org/archiver.php`,
  gallerytorrents: `https://e-hentai.org/gallerytorrents.php?gid=3015818&t=a8787bf44a`
}

export class EHAPIHandler {
  ua: string = DEFAULT_USER_AGENT
  cookie: string
  private _exhentai: boolean
  urls: Record<string, string>

  constructor(
    exhentai: boolean = true,
    cookie?: string,
  ) {
    this.cookie = cookie || ""
    this._exhentai = exhentai
    this.urls = (exhentai) ? exhentaiUrls : ehentaiUrls
  }

  get exhentai() {
    return this._exhentai
  }

  set exhentai(value: boolean) {
    this._exhentai = value
    this.urls = (value) ? exhentaiUrls : ehentaiUrls
  }

  private async _getHtml(url: string): Promise<string> {
    const header = {
      "User-Agent": this.ua,
      "Cookie": this.cookie
    }
    const resp = await get(url, header, 20)
    const text = await resp.text()
    if (text.startsWith("Your IP address has been temporarily banned")) {
      throw new EHIPBannedError(text)
    }
    return text
  }

  /**
   * 获取首页信息 https://e-hentai.org/
   * @param options EHSearchOptions
   * @returns EHFrontPageList
   */
  async getFrontPageInfo(options: EHSearchOptions = {}): Promise<EHFrontPageList> {
    const url = _updateUrlQuery(this.urls.default, _searchOptionsToParams(options), true)
    const text = await this._getHtml(url)
    return parseList(text) as EHFrontPageList
  }

  /**
   * 获取订阅信息 https://e-hentai.org/watched
   * @param options EHSearchOptions
   * @returns EHWatchedList
   */
  async getWatchedInfo(options: EHSearchOptions = {}): Promise<EHWatchedList> {
    const url = _updateUrlQuery(this.urls.watched, _searchOptionsToParams(options), true)
    const text = await this._getHtml(url)
    return parseList(text) as EHWatchedList
  }

  /**
   * 获取当前热门信息 https://e-hentai.org/popular
   * @returns EHPopularList
   */
  async getPopularInfo(options: EHPopularSearchOptions = {}): Promise<EHPopularList> {
    const text = await this._getHtml(this.urls.popular)
    return parseList(text) as EHPopularList
  }

  /**
   * 获取收藏页信息 https://e-hentai.org/favorites.php
   * @param options EHFavoriteSearchOptions
   * @returns EHFavoritesList
   */
  async getFavoritesInfo(options: EHFavoriteSearchOptions = {}): Promise<EHFavoritesList> {
    const url = _updateUrlQuery(this.urls.favorites, _favoriteSearchOptionsToParams(options), true)
    const text = await this._getHtml(url)
    return parseList(text) as EHFavoritesList
  }

  /**
   * 获取排行榜信息 https://e-hentai.org/toplist.php
   * @param timeRange "yesterday" | "past_month" | "past_year" | "all"
   * @param page 从0开始
   * @returns EHTopList
   */
  async getTopListInfo(options: EHTopListSearchOptions): Promise<EHTopList> {
    const map = {
      "yesterday": 15,
      "past_month": 13,
      "past_year": 12,
      "all": 11
    }
    const url = _updateUrlQuery(this.urls.toplist, { p: options.page, tl: map[options.timeRange] }, true)
    const text = await this._getHtml(url)
    return parseList(text) as EHTopList
  }

  /**
   * 获取我的上传信息 https://upld.e-hentai.org/manage?ss=d&sd=d
   * @returns EHUploadList
   */
  async getUploadInfo(): Promise<EHUploadList> {
    const text = await this._getHtml(this.urls.upload)
    return parseMyUpload(text) as EHUploadList
  }

  /**
   * 获取画廊信息 https://e-hentai.org/g/{gid}/{token}/
   * @param gid
   * @param token
   * @param fullComments 是否获取完整评论
   * @param page 缩略图页码，从0开始
   * @returns EHGallery
   */
  async getGalleryInfo(gid: number, token: string, fullComments: boolean, page: number = 0): Promise<EHGallery> {
    const baseUrl = this.urls.default + `g/${gid}/${token}/`;
    const url = _updateUrlQuery(baseUrl, { hc: fullComments ? 1 : undefined, p: page || undefined }, true)
    const text = await this._getHtml(url)
    return parseGallery(text)
  }

  /**
   * 获取MPV页面信息 https://e-hentai.org/mpv/{gid}/{token}/
   * @param gid
   * @param token
   * @returns EHMPV
   */
  async getMPVInfo(gid: number, token: string): Promise<EHMPV> {
    const url = this.urls.default + `mpv/${gid}/${token}/`;
    const text = await this._getHtml(url)
    return parseMPV(text)
  }

  /**
   * 获取某一页信息 https://e-hentai.org/s/{imgkey}/{gid}-{page}
   * @param gid
   * @param imgkey
   * @param page 从0开始
   * @param reloadKey 可选，重新加载所需的参数，若如此做，获取到的图片Url将是新的
   * @returns EHPage
   */
  async getPageInfo(gid: number, imgkey: string, page: number, reloadKey?: string): Promise<EHPage> {
    const url = this.urls.default + `s/${imgkey}/${gid}-${page + 1}` + (reloadKey ? `?nl=${reloadKey}` : "");
    const text = await this._getHtml(url)
    return parsePageInfo(text)
  }

  /**
   * 获取归档页信息 https://e-hentai.org/archiver.php?gid={gid}&token={token}
   * @param gid
   * @param token
   * @returns EHArchive
   */
  async getArchiverInfo(gid: number, token: string): Promise<EHArchive> {
    const url = this.urls.default + `archiver.php?gid=${gid}&token=${token}`;
    const text = await this._getHtml(url)
    return parseArchiverInfo(text)
  }

  /**
   * 启动Hath下载 https://e-hentai.org/archiver.php?gid={gid}&token={token}
   * @param gid 
   * @param token 
   * @param xres 
   * @returns 
   */
  async startHathDownload(
    gid: number,
    token: string,
    xres: string
  ): Promise<"success" | "offline" | "no-hath"> {
    const url = this.urls.default + `archiver.php?gid=${gid}&token=${token}`;
    const header = {
      "User-Agent": this.ua,
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: this.cookie
    };
    const body = {
      hathdl_xres: xres,
    };
    const resp = await post(url, header, body, 10);
    if (resp.statusCode !== 200) throw new EHAPIError(
      "启动Hath下载失败",
      resp.statusCode,
      `启动Hath下载失败，状态码：${resp.statusCode}，url:${url}\nbody：\n${JSON.stringify(body, null, 2)}`
    )
    const html = await resp.text();
    const { message } = parseArchiveResult(html);
    let result: "success" | "offline" | "no-hath";
    if (message === 'You must have a H@H client assigned to your account to use this feature.') {
      result = "no-hath";
    } else if (message === 'Your H@H client appears to be offline.') {
      result = "offline";
    } else if (message.includes("download has been queued")) {
      result = "success";
    } else {
      throw new EHAPIError(
        "启动Hath下载失败",
        resp.statusCode,
        `启动Hath下载失败，状态码：${resp.statusCode}，url:${url}\n原始回复: ${message}`
      )
    }
    return result
  }

  /**
 * 获取图库种子页信息 https://e-hentai.org/gallerytorrents.php?gid={gid}&token={token}
 * @param gid
 * @param token
 * @returns 
 */
  async getGalleryTorrentsInfo(gid: number, token: string): Promise<EHGalleryTorrent[]> {
    const url = this.urls.default + `gallerytorrents.php?gid=${gid}&t=${token}`;
    const text = await this._getHtml(url)
    return parseGalleryTorrentsInfo(text)
  }

  /**
   * 获取配置信息 https://e-hentai.org/uconfig.php
   * 返回值中的重要参数：
   * dm: "2" 代表使用Extended模式
   * ts: "1" 代表thumbnail的size为large
   * xu: string 每一行代表一个屏蔽的上传者
   * favorite_0: string 收藏夹名称（后续的数字代表favcat）
   */
  async getConfig(): Promise<Record<string, string>> {
    const header = {
      "User-Agent": this.ua,
      "Cookie": this.cookie
    }
    const resp = await get(this.urls.config, header, 10)
    const text = await resp.text()
    return parseConfig(text)
  }

  /**
   * 提交配置信息 https://e-hentai.org/uconfig.php
   * 需要提交全部参数。所以需要先获取配置信息，然后修改后再提交
   * @param config
   * @returns boolean
   */
  async postConfig(config: Record<string, string>): Promise<boolean> {
    const header = {
      "User-Agent": this.ua,
      "Content-Type": "application/x-www-form-urlencoded",
      "Cookie": this.cookie
    }
    const resp = await post(this.urls.config, header, config, 10)
    if (resp.statusCode !== 200) throw new EHAPIError(
      "提交配置信息失败",
      resp.statusCode,
      `提交配置信息失败，状态码：${resp.statusCode}，提交的配置信息：\n${JSON.stringify(config, null, 2)}`
    )
    return true
  }

  /**
   * 获取我的标签信息 https://e-hentai.org/mytags
   * @param {number} tagset
   * @returns EHMyTags
   */
  async getMyTags(tagset: number = 0): Promise<EHMyTags> {
    const url = tagset ? _updateUrlQuery(this.urls.mytags, { tagset: tagset }) : this.urls.mytags;
    const header = {
      "User-Agent": this.ua,
      "Cookie": this.cookie
    }
    const resp = await get(url, header, 10)
    const text = await resp.text()
    return parseMyTags(text)
  }

  /**
   * 设置收藏页排序方式
   * @param sortOrder "favorited_time" 代表按收藏时间排序，"published_time" 代表按发布时间排序
   * @returns boolean
   */
  async setFavoritesSortOrder(sortOrder: "favorited_time" | "published_time"): Promise<boolean> {
    const url = _updateUrlQuery(this.urls.favorites, {
      inline_set: sortOrder === "favorited_time" ? "fs_f" : "fs_p"
    });
    const header = {
      "User-Agent": this.ua,
      "Cookie": this.cookie
    }
    var resp = await get(url, header, 10);
    if (resp.statusCode !== 200) throw new EHAPIError(
      "设置收藏页排序方式失败",
      resp.statusCode,
      `url: ${url}\nheader: ${JSON.stringify(header, null, 2)}`
    )
    return true;
  }

  /**
   * 获取收藏页的favcat和favnote信息
   * @param gid
   * @param token
   * @returns EHFavoriteInfo
   */
  async getFavcatFavnote(gid: number, token: string): Promise<EHFavoriteInfo> {
    const url = _updateUrlQuery(this.urls.gallerypopups, {
      gid: gid,
      t: token,
      act: "addfav"
    });
    const header = {
      "User-Agent": this.ua,
      "Cookie": this.cookie
    }
    const resp = await get(url, header, 10);
    const text = await resp.text()
    return parseFavcatFavnote(text);
  }
  /**
   * 添加或修改收藏
   * @param gid 
   * @param token 
   * @param favcat 
   * @param favnote 
   * @returns boolean
   */
  async addOrModifyFav(gid: number, token: string, favcat: number, favnote: string = ""): Promise<boolean> {
    const url = _updateUrlQuery(this.urls.gallerypopups, {
      gid: gid,
      t: token,
      act: "addfav"
    });
    const header = {
      "User-Agent": this.ua,
      "Content-Type": "application/x-www-form-urlencoded",
      "Cookie": this.cookie
    }
    const body = {
      favcat: favcat.toString(),
      favnote: favnote,
      update: "1"
    }
    const resp = await post(url, header, body, 10);
    if (resp.statusCode !== 200) throw new EHAPIError(
      "添加或修改收藏失败",
      resp.statusCode,
      `url: ${url}\nheader: ${JSON.stringify(header, null, 2)}\nbody: ${JSON.stringify(body, null, 2)}`
    )
    return true;
  }

  /**
   * 删除收藏
   * @param gid 
   * @param token 
   * @returns boolean
   */
  async deleteFav(gid: number, token: string): Promise<boolean> {
    const url = _updateUrlQuery(this.urls.gallerypopups, {
      gid: gid,
      t: token,
      act: "addfav"
    });
    const header = {
      "User-Agent": this.ua,
      "Content-Type": "application/x-www-form-urlencoded",
      "Cookie": this.cookie
    }
    const body = {
      favcat: "favdel",
      favnote: "",
      update: "1"
    }
    const resp = await post(url, header, body, 10);
    if (resp.statusCode !== 200) throw new EHAPIError(
      "删除收藏失败",
      resp.statusCode,
      `url: ${url}\nheader: ${JSON.stringify(header, null, 2)}\nbody: ${JSON.stringify(body, null, 2)}`
    )
    return true;
  }

  /**
   * 给画廊评分
   * @param gid 
   * @param token 
   * @param apikey
   * @param apiuid
   * @param rating 0.5-5，代表0.5-5星 
   * @returns boolean
   */
  async rateGallery(
    gid: number,
    token: string,
    apikey: string,
    apiuid: number,
    rating: 0.5 | 1 | 1.5 | 2 | 2.5 | 3 | 3.5 | 4 | 4.5 | 5
  ): Promise<boolean> {
    const ratingForUpload = (rating * 2).toString();
    const header = {
      "User-Agent": this.ua,
      "Content-Type": "application/json",
      Cookie: this.cookie
    };
    const body = {
      method: "rategallery",
      apikey: apikey,
      apiuid: apiuid,
      gid: gid,
      rating: ratingForUpload,
      token: token
    };
    const resp = await post(this.urls.api, header, body, 10);
    if (resp.statusCode !== 200) throw new EHAPIError(
      "评分失败",
      resp.statusCode,
      `评分失败，状态码：${resp.statusCode}，body：\n${JSON.stringify(body, null, 2)}`
    )
    return true;
  }

  /**
   * 发布评论
   * @param gid 
   * @param token 
   * @param text 
   * @returns EHGallery
   */
  async postNewComment(gid: number, token: string, text: string): Promise<EHGallery> {
    const gallery_url = this.urls.default + `g/${gid}/${token}/`;
    const header = {
      "User-Agent": this.ua,
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: this.cookie
    };
    const body = { commenttext_new: text };
    const resp = await post(gallery_url, header, body, 10);
    if (resp.statusCode !== 200) throw new EHAPIError(
      "发布评论失败",
      resp.statusCode,
      `发布评论失败，状态码：${resp.statusCode}\nbody：\n${JSON.stringify(body, null, 2)}`
    )
    const html = await resp.text()
    return parseGallery(html)
  }

  /**
   * 获取已发表的评论
   * @param gid 
   * @param token 
   * @param apikey
   * @param apiuid
   * @param comment_id 
   */
  async getEditComment(
    gid: number,
    token: string,
    apikey: string,
    apiuid: number,
    comment_id: number
  ) {
    const header = {
      "User-Agent": this.ua,
      "Content-Type": "application/json",
      Cookie: this.cookie
    };
    const body = {
      method: "geteditcomment",
      apiuid: apiuid,
      apikey: apikey,
      gid: gid,
      token: token,
      comment_id: comment_id
    };
    const resp = await post(this.urls.api, header, body, 10);
    if (resp.statusCode !== 200) throw new EHAPIError(
      "获取评论编辑失败",
      resp.statusCode,
      `获取评论编辑失败，状态码：${resp.statusCode}\nbody：\n${JSON.stringify(body, null, 2)}`
    )
    const data = await resp.json();
    const text = parseEditableComment(data.editable_comment);
    return text;
  }

  /**
   * 发布修改后的评论
   * @param gid 
   * @param token 
   * @param comment_id 
   * @param text 
   * @returns EHGallery
   */
  async postEditComment(gid: number, token: string, comment_id: number, text: string): Promise<EHGallery> {
    const gallery_url = this.urls.default + `g/${gid}/${token}/`;
    const body = {
      edit_comment: comment_id,
      commenttext_edit: text
    };
    const header = {
      "User-Agent": this.ua,
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: this.cookie
    };
    const resp = await post(gallery_url, header, body, 10);
    if (resp.statusCode !== 200) throw new EHAPIError(
      "发布修改后的评论失败",
      resp.statusCode,
      `发布修改后的评论失败，状态码：${resp.statusCode}\nbody：\n${JSON.stringify(body, null, 2)}`
    )
    const html = await resp.text()
    return parseGallery(html)
  }

  /**
   * 给评论打分
   * @param gid 
   * @param token 
   * @param comment_id 
   * @param apikey 
   * @param apiuid 
   * @param comment_vote // 1 for upvote, -1 for downvote, 但是同一个数字既代表投票也代表取消投票，需要先判断当前投票
   */
  async voteComment(
    gid: number,
    token: string,
    comment_id: number,
    apikey: string,
    apiuid: number,
    comment_vote: 1 | -1  // 1 for upvote, -1 for downvote, 但是同一个数字既代表投票也代表取消投票，需要先判断当前投票
  ): Promise<{
    comment_id: number;
    comment_score: number;
    comment_vote: 1 | -1 | 0;
  }> {
    const header = {
      "User-Agent": this.ua,
      "Content-Type": "application/json",
      Cookie: this.cookie
    };
    const body = {
      method: "votecomment",
      apiuid: apiuid,
      apikey: apikey,
      gid: gid,
      token: token,
      comment_id: comment_id,
      comment_vote: comment_vote
    };
    const resp = await post(this.urls.api, header, body, 10);
    if (resp.statusCode !== 200) throw new EHAPIError(
      "给评论打分失败",
      resp.statusCode,
      `给评论打分失败，状态码：${resp.statusCode}\nbody：\n${JSON.stringify(body, null, 2)}`
    )
    const data = await resp.json() as {
      comment_id: number;
      comment_score: number;
      comment_vote: 1 | -1 | 0;
    }
    return data;
  }

  /**
   * 获取图片信息，前提是拥有mpvkey。否则应该使用getPageInfo来获取图片信息。
   * @param gid 
   * @param key 
   * @param mpvkey 
   * @param page 从0开始
   * @param reloadKey 可选，重新加载所需的参数，若如此做，获取到的图片Url将是新的
   * @returns EHPage
   */
  async fetchImageInfo(gid: number, key: string, mpvkey: string, page: number, reloadKey?: string): Promise<EHPage> {
    const header = {
      "User-Agent": this.ua,
      "Content-Type": "application/json",
      Cookie: this.cookie
    };
    const body: Record<string, number | string> = {
      method: "imagedispatch",
      gid: gid,
      page: page + 1,
      imgkey: key,
      mpvkey: mpvkey
    };
    if (reloadKey) body["nl"] = reloadKey;
    const resp = await post(this.urls.api, header, body, 20);
    if (resp.statusCode !== 200) throw new Error("请求失败");
    const info: {
      i: string; // i: 图片真实网址，是全网址无需拼接
      d: string; // d: 图片下方的文字，如"1000 x 1000 :: 100.0 KB"
      o: string; // o: 下载原图按钮所用的文字，如"Download original 2114 x 3047 2.03 MiB source"
      lf: string; // lf: 获取全尺寸图片的API，如"fullimg?xxxxxxx"（会自动跳转到真正的网址），需要与"https://exhentai.org/"拼接
      ls: string; // ls: 获取包含本图片的搜索结果页面，会跳转到搜索页，需要与"https://exhentai.org/"拼接
      ll: string; // ll: forum link的链接，注意，它需要与"https://exhentai.org/r/"拼接
      lo: string; // lo: 如果直接打开（不以MPV的方式），其应有的网址，如"s/xxxx/1234-1"，需要与"https://exhentai.org/"拼接
      xres: string; // xres: 宽 如"1000"
      yres: string; // yres: 高 如"1000"
      s: string; // s: 重新加载所需的参数，用法为在下一次请求中加入nl
    } = await resp.json()
    const imageUrl = info.i;
    const size = {
      width: parseInt(info.xres),
      height: parseInt(info.yres)
    };
    const fileSize = info.d.split(" :: ")[1];
    const fullSizeUrl = this.urls.default + info.lf;
    const reloadKeyNext = info.s;
    const regexResult = /Download original (\d+) x (\d+) (.*) source/.exec(info.o);
    let fullSize: { width: number; height: number };
    let fullFileSize: string;
    if (regexResult && regexResult.length === 4) {
      fullSize = {
        width: parseInt(regexResult[1]),
        height: parseInt(regexResult[2])
      };
      fullFileSize = regexResult[3];
    } else {
      fullSize = size;
      fullFileSize = fileSize;
    }
    return {
      imageUrl,
      size,
      fileSize,
      fullSizeUrl,
      fullSize,
      fullFileSize,
      reloadKey: reloadKeyNext
    };
  }

  async fetchImageInfoByShowpage(gid: number, imgkey: string, showkey: string, page: number): Promise<EHPage> {
    const header = {
      "User-Agent": this.ua,
      "Content-Type": "application/json",
      Cookie: this.cookie
    };
    const body: Record<string, number | string> = {
      method: "showpage",
      gid: gid,
      page: page + 1,
      imgkey,
      showkey
    };
    const resp = await post(this.urls.api, header, body, 20);
    if (resp.statusCode !== 200) throw new Error("请求失败");
    const info: {
      p: number; // p: 页码
      s: string; // s: 网址的路径，如"s/xxxx/1234-1"
      n: string; // n: html片段，包含跳页的链接
      i: string; // i: html片段，表示图片下方的文字，如 "<div>01.gif :: 1000 x 720 :: 7.07 MiB<\/div>"
      k: string; // k: imgkey
      i3: string; // i3: html片段，信息包含了图片的真实网址，还有reloadkey
      i5: string; // i5: html片段，包含图库网址
      i6: string; // i6: html片段，包含图片搜索网址，论坛链接，reloadkey，还可能包含全尺寸图片网址
      x: string; // x: 宽 如"1000"
      y: string; // y: 高 如"1000"
    } = await resp.json()

    return parseShowpageInfo(info)
  }

  /**
   * 下载缩略图
   * @param url
   * @param ehgt 是否强制使用ehgt的缩略图
   */
  async downloadThumbnail(url: string, ehgt: boolean = true): Promise<NSData> {
    if (ehgt) {
      url = url.replace("s.exhentai.org", "ehgt.org");
      const header = {
        "User-Agent": this.ua
        // 不需要cookie
      }
      const resp = await get(url, header, 15)
      return resp.rawData()
    } else {
      const header = {
        "User-Agent": this.ua,
        "Cookie": this.cookie
      }
      const resp = await get(url, header, 15)
      return resp.rawData()
    }
  }

  /**
   * 下载大图片
   * @param url
   */
  async downloadImage(url: string): Promise<NSData> {
    const header = {
      "User-Agent": this.ua
      // 不需要cookie
    }
    const resp = await get(url, header, 30)
    return resp.rawData()
  }

  /**
   * MyTags 新建标签集
   * 
   * 请注意，这个方法除了新建标签集的名称，还需要传入当前标签集是否启用和颜色。
   * 
   * @param name 新建标签集的名称
   * @param tagset 传入的标签集，如果不传入则默认为0
   * @param tagset_enable 当前标签集是否启用
   * @param tagset_color 当前标签集的颜色
   * @returns EHMyTags 返回的是新建标签集的数据
   */
  async createNewTagset({
    tagset,
    tagset_name,
    tagset_enable,
    tagset_color
  }: {
    tagset?: number,
    tagset_name: string,
    tagset_enable?: boolean,
    tagset_color?: string
  }): Promise<EHMyTags> {
    const url = tagset ? _updateUrlQuery(this.urls.mytags, { tagset: tagset }) : this.urls.mytags;
    const header = {
      "User-Agent": this.ua,
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: this.cookie
    };
    const body: Record<string, string> = {
      tagset_action: "create",
      tagset_name,
      tagset_color: tagset_color || ""
    }
    if (tagset_enable) body["tagset_enable"] = "on";
    const resp = await post(url, header, body, 10);
    const text = await resp.text();
    return parseMyTags(text)
  }

  /**
   * MyTags 删除标签集，必须为空的时候才能删除
   * 
   * 请注意，这个方法传入的都是要删除的标签集的信息
   * @param tagset 要删除的标签集的id
   * @param tagset_enable 要删除的标签集是否启用
   * @param tagset_color 要删除的标签集的颜色
   */
  async deleteTagset({
    tagset,
    tagset_enable,
    tagset_color
  }: {
    tagset: number,
    tagset_enable?: boolean,
    tagset_color?: string
  }): Promise<EHMyTags> {
    if (tagset < 1) throw new Error("tagset必须大于0");
    if (tagset === 1) throw new Error("不能删除默认标签集");
    const url = _updateUrlQuery(this.urls.mytags, { tagset: tagset });
    const header = {
      "User-Agent": this.ua,
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: this.cookie
    };
    const body: Record<string, string> = {
      tagset_action: "delete",
      tagset_name: "",
      tagset_color: tagset_color || ""
    }
    if (tagset_enable) body["tagset_enable"] = "on";
    const resp = await post(url, header, body, 10);
    const text = await resp.text();
    return parseMyTags(text)
  }


  async _enableOrDisableTagset({
    tagset,
    tagset_enable,
    tagset_color
  }: {
    tagset: number,
    tagset_enable?: boolean,
    tagset_color?: string
  }): Promise<EHMyTags> {
    const url = tagset ? _updateUrlQuery(this.urls.mytags, { tagset: tagset }) : this.urls.mytags;
    const header = {
      "User-Agent": this.ua,
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: this.cookie
    };
    const body: Record<string, string> = {
      tagset_action: "update",
      tagset_name: "",
      tagset_color: tagset_color || ""
    }
    if (tagset_enable) body["tagset_enable"] = "on";
    const resp = await post(url, header, body, 10);
    const text = await resp.text();
    return parseMyTags(text)
  }

  /**
   * 
   * @param param0
   * @param {number} param0.tagset 要启用的标签集的id
   * @param {string} param0.tagset_color 要启用的标签集的颜色
   * @returns 
   */
  async enableTagset({
    tagset,
    tagset_color
  }: {
    tagset: number,
    tagset_color?: string
  }): Promise<EHMyTags> {
    return this._enableOrDisableTagset({ tagset, tagset_enable: true, tagset_color });
  }

  /**
   * 
   * @param param0 
   * @param {number} param0.tagset 要禁用的标签集的id
   * @param {string} param0.tagset_color 要禁用的标签集的颜色
   * @returns 
   */
  async disableTagset({
    tagset,
    tagset_color
  }: {
    tagset: number,
    tagset_color?: string
  }): Promise<EHMyTags> {
    return this._enableOrDisableTagset({ tagset, tagset_enable: false, tagset_color });
  }

  /**
   * 
   * @param param0 
   * @param {number} param0.tagset
   * @param {TagNamespace} param0.namespace
   * @param {string} param0.name
   * @param {boolean} param0.watched
   * @param {boolean} param0.hidden
   * @param {string} param0.color
   * @param {number} param0.weight
   * @returns EHMyTags
   */
  async addTag({
    tagset,
    namespace,
    name,
    watched,
    hidden,
    color,
    weight
  }: {
    tagset?: number,
    namespace: TagNamespace,
    name: string,
    watched?: boolean,
    hidden?: boolean,
    color?: string,
    weight?: number
  }): Promise<EHMyTags> {
    if (!weight) weight = 10;
    if (weight < -99 || weight > 99) throw new Error("tagweight必须在-99到99之间");
    if (watched && hidden) throw new Error("不能同时设置watched和hidden");
    const url = tagset ? _updateUrlQuery(this.urls.mytags, { tagset: tagset }) : this.urls.mytags;
    const header = {
      "User-Agent": this.ua,
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: this.cookie
    };
    const body: Record<string, string | number> = {
      usertag_action: "add",
      tagname_new: namespace + ":" + name,
      tagcolor_new: color || "",
      tagweight_new: weight,
      usertag_target: 0,
    }
    if (watched) body["tagwatch_new"] = "on";
    if (hidden) body["taghide_new"] = "on";
    const resp = await post(url, header, body, 10);
    const text = await resp.text();
    return parseMyTags(text)
  }

  /**
   * 
   * @param param0
   * @param {number} [param0.tagset] 
   * @param {number} param0.tagid
   * @returns 
   */
  async deleteTag({ tagset, tagid }: { tagset?: number, tagid: number }): Promise<EHMyTags> {
    const url = tagset ? _updateUrlQuery(this.urls.mytags, { tagset: tagset }) : this.urls.mytags;
    const header = {
      "User-Agent": this.ua,
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: this.cookie
    };

    const body = {
      usertag_action: "mass",
      tagname_new: "",
      tagcolor_new: "",
      tagweight_new: 10,
      "modify_usertags[]": tagid,
      usertag_target: 0
    }
    const resp = await post(url, header, body, 10);
    const text = await resp.text();
    return parseMyTags(text)
  }

  /**
   * 
   * @param param0 
   * @param {number} param0.apiuid 
   * @param {string} param0.apikey
   * @param {number} param0.tagid
   * @param {boolean} param0.watched
   * @param {boolean} param0.hidden
   * @param {string} param0.color
   * @param {number} param0.weight
   * 
   * @returns 
   */
  async updateTag({
    apiuid,
    apikey,
    tagid,
    watched,
    hidden,
    color,
    weight
  }: {
    apiuid: number,
    apikey: string,
    tagid: number,
    watched: boolean,
    hidden: boolean,
    color?: string,
    weight: number
  }): Promise<boolean> {
    if (weight < -99 || weight > 99) throw new Error("tagweight必须在-99到99之间");
    if (watched && hidden) throw new Error("不能同时设置watched和hidden");
    const body = {
      method: "setusertag",
      apiuid,
      apikey,
      tagid,
      tagwatch: watched ? 1 : 0,
      taghide: hidden ? 1 : 0,
      tagcolor: color || "",
      tagweight: weight.toString()
    }
    const header = {
      "User-Agent": this.ua,
      "Content-Type": "application/json",
      Cookie: this.cookie
    };
    const resp = await post(this.urls.api, header, body, 10);
    if (resp.statusCode !== 200) throw new EHAPIError(
      "更新标签失败",
      resp.statusCode,
      `更新标签失败，状态码：${resp.statusCode}\nbody：\n${JSON.stringify(body, null, 2)}`
    )
    return true;
  }
}
