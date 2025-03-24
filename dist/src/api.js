"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EHAPIHandler = exports.buildSortedFsearch = exports.parseFsearch = exports.assembleSearchTerms = void 0;
const url_parse_1 = __importDefault(require("url-parse"));
const request_1 = require("./request");
const parser_1 = require("./parser");
const constant_1 = require("./constant");
const error_1 = require("./error");
const DEFAULT_USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
function _updateUrlQuery(url, query, removeUndefined = false) {
    const u = new url_parse_1.default(url, true);
    const newQuery = removeUndefined
        ? Object.fromEntries(Object.entries(query).filter(([k, v]) => v !== undefined))
        : query;
    u.set("query", newQuery);
    return u.toString();
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
    Misc: 1,
};
function assembleSearchTerms(searchTerms) {
    if (!searchTerms || searchTerms.length === 0)
        return "";
    return searchTerms
        .map((searchTerm) => {
        if (searchTerm.namespace &&
            searchTerm.qualifier &&
            searchTerm.qualifier !== "weak") {
            throw new Error("命名空间和修饰词不能同时使用(weak除外)");
        }
        let result = "";
        if (searchTerm.qualifier)
            result += `${searchTerm.qualifier}:`;
        if (searchTerm.namespace) {
            // 添加命名空间
            result += `${constant_1.tagNamespaceMostUsedAlternateMap[searchTerm.namespace]}:`;
        }
        let term = searchTerm.term;
        if (searchTerm.dollar)
            term += "$";
        if (term.includes(" ")) {
            term = `"${term}"`;
        }
        result += term;
        // 如果~和-同时使用，必须-在前，~在后，否则直接报错
        // 但实测并非ehentai搜索支持这种写法，而是后面的符号会被忽略
        if (searchTerm.tilde)
            result = `~${result}`;
        if (searchTerm.subtract)
            result = `-${result}`;
        return result;
    })
        .join(" ");
}
exports.assembleSearchTerms = assembleSearchTerms;
// SearchOptions to SearchParams
function _searchOptionsToParams(options) {
    // 检查搜索参数是否合法
    if (options.range &&
        (options.minimumGid || options.maximumGid || options.jump || options.seek)) {
        throw new Error("range参数与prev、next、jump、seek参数不兼容");
    }
    if (options.minimumGid && options.maximumGid) {
        throw new Error("prev和next参数不能同时使用");
    }
    if ((options.jump || options.seek) &&
        !(options.minimumGid || options.maximumGid)) {
        throw new Error("jump和seek参数必须和prev或next参数一起使用");
    }
    if (options.jump && options.seek) {
        throw new Error("jump和seek参数不能同时使用");
    }
    let f_cats;
    if (options.excludedCategories && options.excludedCategories.length > 0)
        f_cats = options.excludedCategories.reduce((acc, cur) => acc + EHCategoryNumber[cur], 0);
    if (f_cats === 1023)
        f_cats = undefined;
    const f_search = assembleSearchTerms(options.searchTerms) || undefined;
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
    const jump = options.jump
        ? `${options.jump.value}${options.jump.unit}`
        : undefined;
    const seek = options.seek || undefined;
    const params = {
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
        seek,
    };
    return params;
}
function _favoriteSearchOptionsToParams(options) {
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
    const f_search = assembleSearchTerms(options.searchTerms) || undefined;
    const favcat = options.favcat;
    let prev = options.minimumGid?.toString();
    if (prev && options.minimumFavoritedTimestamp)
        prev += `-${options.minimumFavoritedTimestamp}`;
    let next = options.maximumGid?.toString();
    if (next && options.maximumFavoritedTimestamp)
        next += `-${options.maximumFavoritedTimestamp}`;
    const jump = options.jump
        ? `${options.jump.value}${options.jump.unit}`
        : undefined;
    const seek = options.seek;
    const params = {
        f_search,
        favcat,
        prev,
        next,
        jump,
        seek,
    };
    return params;
}
function _popularSearchOptionsToParams(options) {
    const f_sfl = options.disableLanguageFilters ? "on" : undefined;
    const f_sfu = options.disableUploaderFilters ? "on" : undefined;
    const f_sft = options.disableTagFilters ? "on" : undefined;
    return {
        f_sfl,
        f_sfu,
        f_sft,
    };
}
function _disassembleFsearch(fsearch) {
    // 双引号包裹的字符串视为一个整体，不会被分割。除此之外，空格分割。
    // 方法：首先有一个状态标记inQuote，初始为false。
    // 然后逐字遍历，第一次遇到双引号则inQuote=true，第二次则inQuote=false，以此类推。
    // 如果inQuote为true，则直到下一个双引号之前的空格都不会被分割。
    // 如果inQuote为false，则遇到空格就分割。
    let inQuote = false;
    let result = [];
    let current = "";
    for (let i = 0; i < fsearch.length; i++) {
        let c = fsearch[i];
        if (c === '"')
            inQuote = !inQuote;
        if (c === " " && !inQuote) {
            if (current)
                result.push(current);
            current = "";
        }
        else {
            current += c;
        }
    }
    if (current)
        result.push(current);
    return result;
}
function _parseSingleFsearch(fsearch) {
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
    }
    else if (fsearch[0] === "~") {
        tilde = true;
        fsearch = fsearch.slice(1);
    }
    // 检测结尾第一个字符：如果是`$`，则表示精确搜索。
    let dollar = false;
    if (fsearch[fsearch.length - 1] === "$") {
        dollar = true;
        fsearch = fsearch.slice(0, -1);
    }
    // 注意：事实上ehentai搜索可以在开头或者结尾添加多个符号，
    // 但并非ehentai搜索支持这种写法，而是多余的符号会被忽略
    // 由于忽略的规则并不明确，这里不考虑这种情况
    // 然后以冒号为界分割
    const parts = fsearch.split(":").map((p) => p.trimStart());
    // 实际检测发现，ehentai可以自动忽略修饰词前面的空格，但是不能忽略后面的
    // 比如" weak: f: anal  "是合法的，但是" weak :f: anal"是不合法的。
    // 如果超过4个部分，说明有多余的冒号，报错
    if (parts.length > 4) {
        throw new Error("Too many colons in a single fsearch term");
    }
    // 如果有三个部分，必须第一个部分为`weak`，
    // 第二个部分为tagNamespace或tagNamespaceAlternates，否则报错
    else if (parts.length === 3) {
        if (parts[0] !== "weak") {
            throw new Error("Invalid fsearch term with 3 parts, first part must be `weak`");
        }
        if (!constant_1.tagNamespaces.includes(parts[1]) &&
            !constant_1.tagNamespaceAlternates.includes(parts[1])) {
            throw new Error("Invalid tag namespace in fsearch term");
        }
        let namespace;
        if (constant_1.tagNamespaces.includes(parts[1])) {
            namespace = parts[1];
        }
        else {
            namespace = constant_1.tagNamespaceAlternateMap[parts[1]];
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
        let qualifier;
        let namespace;
        if (constant_1.ehQualifiers.includes(parts[0])) {
            qualifier = parts[0];
        }
        else if (constant_1.tagNamespaces.includes(parts[0])) {
            namespace = parts[0];
        }
        else if (constant_1.tagNamespaceAlternates.includes(parts[0])) {
            namespace = constant_1.tagNamespaceAlternateMap[parts[0]];
        }
        else {
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
function _sortByKey(array, key) {
    array.sort((a, b) => {
        if (a[key] === undefined)
            return 1;
        if (b[key] === undefined)
            return -1;
        if (a[key] < b[key])
            return -1;
        if (a[key] > b[key])
            return 1;
        return 0;
    });
}
function _sortSearchTerms(searchTerms) {
    _sortByKey(searchTerms, "tilde");
    _sortByKey(searchTerms, "subtract");
    _sortByKey(searchTerms, "dollar");
    _sortByKey(searchTerms, "term");
    _sortByKey(searchTerms, "namespace");
    _sortByKey(searchTerms, "qualifier");
    return searchTerms;
}
function parseFsearch(fsearch) {
    const parts = _disassembleFsearch(fsearch);
    return parts.map(_parseSingleFsearch);
}
exports.parseFsearch = parseFsearch;
function buildSortedFsearch(searchTerms) {
    _sortSearchTerms(searchTerms);
    return assembleSearchTerms(searchTerms);
}
exports.buildSortedFsearch = buildSortedFsearch;
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
    uploadapi: `https://upload.e-hentai.org/api`,
    mytags: `https://e-hentai.org/mytags`,
    archiver: `https://e-hentai.org/archiver.php`,
    gallerytorrents: `https://e-hentai.org/gallerytorrents.php?gid=3015818&t=a8787bf44a`,
};
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
    uploadapi: `https://upld.exhentai.org/upld/api`,
    mytags: `https://exhentai.org/mytags`,
    archiver: `https://exhentai.org/archiver.php`,
    gallerytorrents: `https://e-hentai.org/gallerytorrents.php?gid=3015818&t=a8787bf44a`,
};
class CookieJar {
    constructor(cookie) {
        this._parsedCookieMap = new Map();
        if (cookie) {
            this.updateCookie(cookie);
        }
    }
    updateCookie(cookie) {
        if (typeof cookie === "string") {
            const cookiePairs = cookie
                .split(";")
                .map((pair) => pair.trim());
            for (const pair of cookiePairs) {
                if (!pair)
                    continue;
                const [name, ...valueParts] = pair.split("=");
                const value = valueParts.join("=");
                // 这里只能获得 name 和 value，没有其他属性信息
                this._parsedCookieMap.set(name, { name, value });
            }
        }
        else {
            for (const i of cookie) {
                this._parsedCookieMap.set(i.name, i);
            }
        }
    }
    getParsedCookies() {
        const now = new Date();
        // 收集已过期的 cookie 名称
        const expiredCookies = [];
        this._parsedCookieMap.forEach((cookie, name) => {
            if (cookie.expires) {
                const expDate = new Date(cookie.expires);
                if (expDate.getTime() <= now.getTime()) {
                    expiredCookies.push(name);
                }
            }
        });
        // 删除已过期的 cookie
        for (const name of expiredCookies) {
            this._parsedCookieMap.delete(name);
        }
        return [...this._parsedCookieMap.values()];
    }
    /**
     * 生成用于 Cookie 请求头的字符串形式："name1=value1; name2=value2"
     * 在生成 header 前会先删除过期的 cookie。
     */
    getCookieHeader() {
        const now = new Date();
        // 收集已过期的 cookie 名称
        const expiredCookies = [];
        this._parsedCookieMap.forEach((cookie, name) => {
            if (cookie.expires) {
                const expDate = new Date(cookie.expires);
                if (expDate.getTime() <= now.getTime()) {
                    expiredCookies.push(name);
                }
            }
        });
        // 删除已过期的 cookie
        for (const name of expiredCookies) {
            this._parsedCookieMap.delete(name);
        }
        // 生成 header 字符串
        const cookies = Array.from(this._parsedCookieMap.values());
        return cookies.map((c) => `${c.name}=${c.value}`).join("; ");
    }
    /**
     * 删除指定名称的 cookie
     */
    deleteCookie(name) {
        this._parsedCookieMap.delete(name);
    }
}
class EHAPIHandler {
    /**
     *
     * @param cookieChanged cookie改变时触发的回调函数，仅对两个cookie生效：iq和igneous
     */
    constructor(cookieChanged) {
        this._exhentai = false;
        this.ua = DEFAULT_USER_AGENT;
        this._cookieChanged = cookieChanged;
        this._cookiejar = new CookieJar();
        this.urls = this._exhentai ? exhentaiUrls : ehentaiUrls;
    }
    get cookie() {
        return this._cookiejar.getCookieHeader();
    }
    get parsedCookie() {
        return this._cookiejar.getParsedCookies();
    }
    updateCookie(cookie) {
        this._cookiejar.updateCookie(cookie);
    }
    get exhentai() {
        return this._exhentai;
    }
    set exhentai(value) {
        this._exhentai = value;
        this.urls = value ? exhentaiUrls : ehentaiUrls;
    }
    async _getHtml(url, checkCopyrightError = false) {
        const header = {
            "User-Agent": this.ua,
            Cookie: this.cookie,
        };
        const resp = await this.get({
            url,
            header,
            timeout: 20,
            checkCopyrightError,
        });
        const text = await resp.text();
        if (text.startsWith("Your IP address has been temporarily banned")) {
            throw new error_1.EHIPBannedError(text);
        }
        return text;
    }
    async get(options) {
        const resp = await (0, request_1.get)(options.url, options.header, options.timeout, options.checkCopyrightError);
        const setCookie = resp.setCookie();
        if (setCookie.some((n) => n.name === "igneous" && n.value === "mystery")) {
            throw new error_1.EHIgneousExpiredError();
        }
        const cookie_iq = setCookie.find((n) => n.name === "iq");
        const cookie_igneous = setCookie.find((n) => n.name === "igneous");
        let flag = false;
        if (cookie_iq) {
            this._cookiejar.updateCookie([cookie_iq]);
            flag = true;
        }
        if (cookie_igneous) {
            this._cookiejar.updateCookie([cookie_igneous]);
            flag = true;
        }
        if (flag) {
            this._cookieChanged(this.parsedCookie);
        }
        return resp;
    }
    async post(options) {
        const resp = await (0, request_1.post)(options.url, options.header, options.body, options.timeout);
        const setCookie = resp.setCookie();
        if (setCookie.some((n) => n.name === "igneous" && n.value === "mystery")) {
            throw new error_1.EHIgneousExpiredError();
        }
        const cookie_iq = setCookie.find((n) => n.name === "iq");
        const cookie_igneous = setCookie.find((n) => n.name === "igneous");
        let flag = false;
        if (cookie_iq) {
            this._cookiejar.updateCookie([cookie_iq]);
            flag = true;
        }
        if (cookie_igneous) {
            this._cookiejar.updateCookie([cookie_igneous]);
            flag = true;
        }
        if (flag) {
            this._cookieChanged(this.parsedCookie);
        }
        return resp;
    }
    buildUrl(args) {
        if (args.type === "front_page") {
            const url = _updateUrlQuery(this.urls.default, _searchOptionsToParams(args.options), true);
            return url;
        }
        else if (args.type === "watched") {
            const url = _updateUrlQuery(this.urls.watched, _searchOptionsToParams(args.options), true);
            return url;
        }
        else if (args.type === "popular") {
            const url = _updateUrlQuery(this.urls.popular, _popularSearchOptionsToParams(args.options), true);
            return url;
        }
        else if (args.type === "favorites") {
            const url = _updateUrlQuery(this.urls.favorites, _favoriteSearchOptionsToParams(args.options), true);
            return url;
        }
        else if (args.type === "toplist") {
            const map = {
                yesterday: 15,
                past_month: 13,
                past_year: 12,
                all: 11,
            };
            const url = _updateUrlQuery(this.urls.toplist, { p: args.options.page, tl: map[args.options.timeRange] }, true);
            return url;
        }
        else {
            return this.urls.upload;
        }
    }
    /**
     * 获取首页信息 https://e-hentai.org/
     * @param options EHSearchOptions
     * @returns EHFrontPageList
     */
    async getFrontPageInfo(options = {}) {
        const url = _updateUrlQuery(this.urls.default, _searchOptionsToParams(options), true);
        const text = await this._getHtml(url);
        return (0, parser_1.parseList)(text);
    }
    /**
     * 获取订阅信息 https://e-hentai.org/watched
     * @param options EHSearchOptions
     * @returns EHWatchedList
     */
    async getWatchedInfo(options = {}) {
        const url = _updateUrlQuery(this.urls.watched, _searchOptionsToParams(options), true);
        const text = await this._getHtml(url);
        return (0, parser_1.parseList)(text);
    }
    /**
     * 获取当前热门信息 https://e-hentai.org/popular
     * @returns EHPopularList
     */
    async getPopularInfo(options = {}) {
        const url = _updateUrlQuery(this.urls.popular, _popularSearchOptionsToParams(options), true);
        const text = await this._getHtml(url);
        return (0, parser_1.parseList)(text);
    }
    /**
     * 获取收藏页信息 https://e-hentai.org/favorites.php
     * @param options EHFavoriteSearchOptions
     * @returns EHFavoritesList
     */
    async getFavoritesInfo(options = {}) {
        const url = _updateUrlQuery(this.urls.favorites, _favoriteSearchOptionsToParams(options), true);
        const text = await this._getHtml(url);
        return (0, parser_1.parseList)(text);
    }
    /**
     * 获取排行榜信息 https://e-hentai.org/toplist.php
     * @param timeRange "yesterday" | "past_month" | "past_year" | "all"
     * @param page 从0开始
     * @returns EHTopList
     */
    async getTopListInfo(options) {
        const map = {
            yesterday: 15,
            past_month: 13,
            past_year: 12,
            all: 11,
        };
        const url = _updateUrlQuery(this.urls.toplist, { p: options.page, tl: map[options.timeRange] }, true);
        const text = await this._getHtml(url);
        return (0, parser_1.parseList)(text);
    }
    /**
     * 获取我的上传信息 https://upld.e-hentai.org/manage?ss=d&sd=d
     * @returns EHUploadList
     */
    async getUploadInfo() {
        const text = await this._getHtml(this.urls.upload);
        return (0, parser_1.parseMyUpload)(text);
    }
    async uncollapseFolder({ fid, apiuid, apikey, }) {
        const header = {
            "User-Agent": this.ua,
            "Content-Type": "application/json",
            Cookie: this.cookie,
        };
        const body = {
            method: "managefolders",
            apiuid,
            apikey,
            state: "p", // state表示是否为发布图库的文件夹（另一个为u）
            fid,
            ss: "d", // ss和sd表示按日期排序、降序，保持一致
            sd: "d",
        };
        const resp = await this.post({
            url: this.urls.uploadapi,
            header,
            body,
            timeout: 10,
        });
        if (resp.statusCode !== 200)
            throw new error_1.EHAPIError("展开上传文件夹失败", resp.statusCode, `展开上传文件夹失败，状态码：${resp.statusCode}，body：\n${JSON.stringify(body, null, 2)}`);
        const json = await resp.json();
        return (0, parser_1.parseUncollapseInfo)(json);
    }
    /**
     * 获取画廊信息 https://e-hentai.org/g/{gid}/{token}/
     * @param gid
     * @param token
     * @param fullComments 是否获取完整评论
     * @param page 缩略图页码，从0开始
     * @returns EHGallery
     */
    async getGalleryInfo(gid, token, fullComments, page = 0) {
        const baseUrl = this.urls.default + `g/${gid}/${token}/`;
        const url = _updateUrlQuery(baseUrl, { hc: fullComments ? 1 : undefined, p: page || undefined }, true);
        const text = await this._getHtml(url, true);
        return (0, parser_1.parseGallery)(text);
    }
    /**
     * 获取MPV页面信息 https://e-hentai.org/mpv/{gid}/{token}/
     * @param gid
     * @param token
     * @returns EHMPV
     */
    async getMPVInfo(gid, token) {
        const url = this.urls.default + `mpv/${gid}/${token}/`;
        const text = await this._getHtml(url);
        return (0, parser_1.parseMPV)(text);
    }
    /**
     * 获取某一页信息 https://e-hentai.org/s/{imgkey}/{gid}-{page}
     * @param gid
     * @param imgkey
     * @param page 从0开始
     * @param reloadKey 可选，重新加载所需的参数，若如此做，获取到的图片Url将是新的
     * @returns EHPage
     */
    async getPageInfo(gid, imgkey, page, reloadKey) {
        const url = this.urls.default +
            `s/${imgkey}/${gid}-${page + 1}` +
            (reloadKey ? `?nl=${reloadKey}` : "");
        const text = await this._getHtml(url);
        return (0, parser_1.parsePageInfo)(text);
    }
    /**
     * 获取归档页信息 https://e-hentai.org/archiver.php?gid={gid}&token={token}
     * @param gid
     * @param token
     * @returns EHArchive
     */
    async getArchiverInfo(gid, token) {
        const url = this.urls.default + `archiver.php?gid=${gid}&token=${token}`;
        const text = await this._getHtml(url);
        return (0, parser_1.parseArchiverInfo)(text);
    }
    /**
     * 启动Hath下载 https://e-hentai.org/archiver.php?gid={gid}&token={token}
     * @param gid
     * @param token
     * @param xres
     * @returns
     */
    async startHathDownload(gid, token, xres) {
        const url = this.urls.default + `archiver.php?gid=${gid}&token=${token}`;
        const header = {
            "User-Agent": this.ua,
            "Content-Type": "application/x-www-form-urlencoded",
            Cookie: this.cookie,
        };
        const body = {
            hathdl_xres: xres.toString(),
        };
        const resp = await this.post({ url, header, body, timeout: 10 });
        if (resp.statusCode !== 200)
            throw new error_1.EHAPIError("启动Hath下载失败", resp.statusCode, `启动Hath下载失败，状态码：${resp.statusCode}，url:${url}\nbody：\n${JSON.stringify(body, null, 2)}`);
        const html = await resp.text();
        const { message } = (0, parser_1.parseArchiveResult)(html);
        let result;
        if (message ===
            "You must have a H@H client assigned to your account to use this feature.") {
            result = "no-hath";
        }
        else if (message === "Your H@H client appears to be offline.") {
            result = "offline";
        }
        else if (message.includes("download has been queued")) {
            result = "success";
        }
        else {
            throw new error_1.EHAPIError("启动Hath下载失败", resp.statusCode, `启动Hath下载失败，状态码：${resp.statusCode}，url:${url}\n原始回复: ${message}`);
        }
        return result;
    }
    /**
     * 获取归档下载信息
     */
    async getArchiveDownloadInfo(gid, token, type) {
        const url = this.urls.default + `archiver.php?gid=${gid}&token=${token}`;
        const header = {
            "User-Agent": this.ua,
            "Content-Type": "application/x-www-form-urlencoded",
            Cookie: this.cookie,
        };
        const body = type
            ? {
                dltype: "org",
                dlcheck: "Download Original Archive",
            }
            : {
                dltype: "res",
                dlcheck: "Download Resample Archive",
            };
        const resp = await this.post({ url, header, body, timeout: 10 });
        if (resp.statusCode !== 200) {
            throw new error_1.EHAPIError("获取存档下载信息失败", resp.statusCode, `获取存档下载信息失败，状态码：${resp.statusCode}，body：\n${JSON.stringify(body, null, 2)}`);
        }
        const html = await resp.text();
        if (html.startsWith("You do not have enough funds")) {
            throw new error_1.EHInsufficientFundError();
        }
        const data = (0, parser_1.parseArchiveDownloadInfo)(html);
        if (!data.hath_url) {
            throw new error_1.EHAPIError("获取存档下载信息失败", resp.statusCode, `获取存档下载信息失败，状态码：${resp.statusCode}，body：\n${JSON.stringify(body, null, 2)}`);
        }
        return data;
    }
    /**
     * 获取图库种子页信息 https://e-hentai.org/gallerytorrents.php?gid={gid}&token={token}
     * @param gid
     * @param token
     * @returns
     */
    async getGalleryTorrentsInfo(gid, token) {
        const url = this.urls.default + `gallerytorrents.php?gid=${gid}&t=${token}`;
        const text = await this._getHtml(url);
        return (0, parser_1.parseGalleryTorrentsInfo)(text);
    }
    /**
     * 获取配置信息 https://e-hentai.org/uconfig.php
     * 返回值中的重要参数：
     * dm: "2" 代表使用Extended模式
     * ts: "1" 代表thumbnail的size为large
     * xu: string 每一行代表一个屏蔽的上传者
     * favorite_0: string 收藏夹名称（后续的数字代表favcat）
     */
    async getConfig() {
        const header = {
            "User-Agent": this.ua,
            Cookie: this.cookie,
        };
        const resp = await this.get({ url: this.urls.config, header, timeout: 10 });
        const text = await resp.text();
        return (0, parser_1.parseConfig)(text);
    }
    /**
     * 提交配置信息 https://e-hentai.org/uconfig.php
     * 需要提交全部参数。所以需要先获取配置信息，然后修改后再提交
     * @param config
     * @returns boolean
     */
    async postConfig(config) {
        const header = {
            "User-Agent": this.ua,
            "Content-Type": "application/x-www-form-urlencoded",
            Cookie: this.cookie,
        };
        const resp = await this.post({
            url: this.urls.config,
            header,
            body: config,
            timeout: 10,
        });
        if (resp.statusCode !== 200)
            throw new error_1.EHAPIError("提交配置信息失败", resp.statusCode, `提交配置信息失败，状态码：${resp.statusCode}，提交的配置信息：\n${JSON.stringify(config, null, 2)}`);
        return true;
    }
    /**
     * 获取我的标签信息 https://e-hentai.org/mytags
     * @param {number} tagset
     * @returns EHMyTags
     */
    async getMyTags(tagset = 0) {
        const url = tagset
            ? _updateUrlQuery(this.urls.mytags, { tagset: tagset })
            : this.urls.mytags;
        const header = {
            "User-Agent": this.ua,
            Cookie: this.cookie,
        };
        const resp = await this.get({ url, header, timeout: 10 });
        const text = await resp.text();
        return (0, parser_1.parseMyTags)(text);
    }
    /**
     * 设置收藏页排序方式
     * @param sortOrder "favorited_time" 代表按收藏时间排序，"published_time" 代表按发布时间排序
     * @returns boolean
     */
    async setFavoritesSortOrder(sortOrder) {
        const url = _updateUrlQuery(this.urls.favorites, {
            inline_set: sortOrder === "favorited_time" ? "fs_f" : "fs_p",
        });
        const header = {
            "User-Agent": this.ua,
            Cookie: this.cookie,
        };
        var resp = await this.get({ url, header, timeout: 10 });
        if (resp.statusCode !== 200)
            throw new error_1.EHAPIError("设置收藏页排序方式失败", resp.statusCode, `url: ${url}\nheader: ${JSON.stringify(header, null, 2)}`);
        return true;
    }
    /**
     * 获取收藏页的favcat和favnote信息
     * @param gid
     * @param token
     * @returns EHFavoriteInfo
     */
    async getFavcatFavnote(gid, token) {
        const url = _updateUrlQuery(this.urls.gallerypopups, {
            gid: gid,
            t: token,
            act: "addfav",
        });
        const header = {
            "User-Agent": this.ua,
            Cookie: this.cookie,
        };
        const resp = await this.get({ url, header, timeout: 10 });
        const text = await resp.text();
        return (0, parser_1.parseFavcatFavnote)(text);
    }
    /**
     * 添加或修改收藏
     * @param gid
     * @param token
     * @param favcat
     * @param favnote
     * @returns boolean
     */
    async addOrModifyFav(gid, token, favcat, favnote = "") {
        const url = _updateUrlQuery(this.urls.gallerypopups, {
            gid: gid,
            t: token,
            act: "addfav",
        });
        const header = {
            "User-Agent": this.ua,
            "Content-Type": "application/x-www-form-urlencoded",
            Cookie: this.cookie,
        };
        const body = {
            favcat: favcat.toString(),
            favnote: favnote,
            update: "1",
        };
        const resp = await this.post({ url, header, body, timeout: 10 });
        if (resp.statusCode !== 200)
            throw new error_1.EHAPIError("添加或修改收藏失败", resp.statusCode, `url: ${url}\nheader: ${JSON.stringify(header, null, 2)}\nbody: ${JSON.stringify(body, null, 2)}`);
        return true;
    }
    /**
     * 删除收藏
     * @param gid
     * @param token
     * @returns boolean
     */
    async deleteFav(gid, token) {
        const url = _updateUrlQuery(this.urls.gallerypopups, {
            gid: gid,
            t: token,
            act: "addfav",
        });
        const header = {
            "User-Agent": this.ua,
            "Content-Type": "application/x-www-form-urlencoded",
            Cookie: this.cookie,
        };
        const body = {
            favcat: "favdel",
            favnote: "",
            update: "1",
        };
        const resp = await this.post({ url, header, body, timeout: 10 });
        if (resp.statusCode !== 200)
            throw new error_1.EHAPIError("删除收藏失败", resp.statusCode, `url: ${url}\nheader: ${JSON.stringify(header, null, 2)}\nbody: ${JSON.stringify(body, null, 2)}`);
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
    async rateGallery(gid, token, apikey, apiuid, rating) {
        const ratingForUpload = (rating * 2).toString();
        const header = {
            "User-Agent": this.ua,
            "Content-Type": "application/json",
            Cookie: this.cookie,
        };
        const body = {
            method: "rategallery",
            apikey: apikey,
            apiuid: apiuid,
            gid: gid,
            rating: ratingForUpload,
            token: token,
        };
        const resp = await this.post({
            url: this.urls.api,
            header,
            body,
            timeout: 10,
        });
        if (resp.statusCode !== 200)
            throw new error_1.EHAPIError("评分失败", resp.statusCode, `评分失败，状态码：${resp.statusCode}，body：\n${JSON.stringify(body, null, 2)}`);
        return true;
    }
    /**
     * 发布评论
     * @param gid
     * @param token
     * @param text
     * @returns EHGallery
     */
    async postNewComment(gid, token, text) {
        const gallery_url = this.urls.default + `g/${gid}/${token}/`;
        const header = {
            "User-Agent": this.ua,
            "Content-Type": "application/x-www-form-urlencoded",
            Cookie: this.cookie,
        };
        const body = { commenttext_new: text };
        const resp = await this.post({
            url: gallery_url,
            header,
            body,
            timeout: 10,
        });
        if (resp.statusCode !== 200)
            throw new error_1.EHAPIError("发布评论失败", resp.statusCode, `发布评论失败，状态码：${resp.statusCode}\nbody：\n${JSON.stringify(body, null, 2)}`);
        const html = await resp.text();
        return (0, parser_1.parseGallery)(html);
    }
    /**
     * 获取已发表的评论
     * @param gid
     * @param token
     * @param apikey
     * @param apiuid
     * @param comment_id
     */
    async getEditComment(gid, token, apikey, apiuid, comment_id) {
        const header = {
            "User-Agent": this.ua,
            "Content-Type": "application/json",
            Cookie: this.cookie,
        };
        const body = {
            method: "geteditcomment",
            apiuid: apiuid,
            apikey: apikey,
            gid: gid,
            token: token,
            comment_id: comment_id,
        };
        const resp = await this.post({
            url: this.urls.api,
            header,
            body,
            timeout: 10,
        });
        if (resp.statusCode !== 200)
            throw new error_1.EHAPIError("获取评论编辑失败", resp.statusCode, `获取评论编辑失败，状态码：${resp.statusCode}\nbody：\n${JSON.stringify(body, null, 2)}`);
        const data = await resp.json();
        const text = (0, parser_1.parseEditableComment)(data.editable_comment);
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
    async postEditComment(gid, token, comment_id, text) {
        const gallery_url = this.urls.default + `g/${gid}/${token}/`;
        const body = {
            edit_comment: comment_id,
            commenttext_edit: text,
        };
        const header = {
            "User-Agent": this.ua,
            "Content-Type": "application/x-www-form-urlencoded",
            Cookie: this.cookie,
        };
        const resp = await this.post({
            url: gallery_url,
            header,
            body,
            timeout: 10,
        });
        if (resp.statusCode !== 200)
            throw new error_1.EHAPIError("发布修改后的评论失败", resp.statusCode, `发布修改后的评论失败，状态码：${resp.statusCode}\nbody：\n${JSON.stringify(body, null, 2)}`);
        const html = await resp.text();
        return (0, parser_1.parseGallery)(html);
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
    async voteComment(gid, token, comment_id, apikey, apiuid, comment_vote // 1 for upvote, -1 for downvote, 但是同一个数字既代表投票也代表取消投票，需要先判断当前投票
    ) {
        const header = {
            "User-Agent": this.ua,
            "Content-Type": "application/json",
            Cookie: this.cookie,
        };
        const body = {
            method: "votecomment",
            apiuid: apiuid,
            apikey: apikey,
            gid: gid,
            token: token,
            comment_id: comment_id,
            comment_vote: comment_vote,
        };
        const resp = await this.post({
            url: this.urls.api,
            header,
            body,
            timeout: 10,
        });
        if (resp.statusCode !== 200)
            throw new error_1.EHAPIError("给评论打分失败", resp.statusCode, `给评论打分失败，状态码：${resp.statusCode}\nbody：\n${JSON.stringify(body, null, 2)}`);
        const data = (await resp.json());
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
    async fetchImageInfo(gid, key, mpvkey, page, reloadKey) {
        const header = {
            "User-Agent": this.ua,
            "Content-Type": "application/json",
            Cookie: this.cookie,
        };
        const body = {
            method: "imagedispatch",
            gid: gid,
            page: page + 1,
            imgkey: key,
            mpvkey: mpvkey,
        };
        if (reloadKey)
            body["nl"] = reloadKey;
        const resp = await this.post({
            url: this.urls.api,
            header,
            body,
            timeout: 20,
        });
        if (resp.statusCode !== 200)
            throw new Error("请求失败");
        const info = await resp.json();
        const imageUrl = info.i;
        const size = {
            width: parseInt(info.xres),
            height: parseInt(info.yres),
        };
        const fileSize = info.d.split(" :: ")[1];
        const fullSizeUrl = this.urls.default + info.lf;
        const reloadKeyNext = info.s;
        const regexResult = /Download original (\d+) x (\d+) (.*) source/.exec(info.o);
        let fullSize;
        let fullFileSize;
        if (regexResult && regexResult.length === 4) {
            fullSize = {
                width: parseInt(regexResult[1]),
                height: parseInt(regexResult[2]),
            };
            fullFileSize = regexResult[3];
        }
        else {
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
            reloadKey: reloadKeyNext,
        };
    }
    async fetchImageInfoByShowpage(gid, imgkey, showkey, page) {
        const header = {
            "User-Agent": this.ua,
            "Content-Type": "application/json",
            Cookie: this.cookie,
        };
        const body = {
            method: "showpage",
            gid: gid,
            page: page + 1,
            imgkey,
            showkey,
        };
        const resp = await this.post({
            url: this.urls.api,
            header,
            body,
            timeout: 20,
        });
        if (resp.statusCode !== 200)
            throw new Error("请求失败");
        const info = await resp.json();
        return (0, parser_1.parseShowpageInfo)(info);
    }
    /**
     * 下载缩略图
     * @param url
     * @param ehgt 是否强制使用ehgt的缩略图
     */
    async downloadThumbnail(url, ehgt = true) {
        if (ehgt) {
            url = url.replace("https://s.exhentai.org/", "https://ehgt.org/");
        }
        if (url.includes(".hath.network/")) {
            const header = {
                "User-Agent": this.ua,
            };
            const resp = await (0, request_1.downloadWithTimeout)({ url, header, timeout: 30 });
            const data = resp.data;
            if (!data.info.mimeType.startsWith("image")) {
                throw new error_1.EHNetworkError("下载的文件不是图片");
            }
            return data;
        }
        else {
            const header = {
                "User-Agent": this.ua,
                Cookie: this.cookie,
            };
            const resp = await this.get({ url, header, timeout: 15 });
            const data = resp.rawData();
            if (!data.info.mimeType.startsWith("image")) {
                throw new error_1.EHNetworkError("下载的文件不是图片");
            }
            return data;
        }
    }
    /**
     * 下载大图片
     * @param url
     */
    async downloadImage(url) {
        const header = {
            "User-Agent": this.ua,
            // 不需要cookie
        };
        const resp = await (0, request_1.downloadWithTimeout)({ url, header, timeout: 30 });
        const data = resp.data;
        if (!data.info.mimeType.startsWith("image")) {
            throw new error_1.EHNetworkError("下载的文件不是图片");
        }
        return data;
    }
    /**
     * 下载原图
     * @param url
     */
    async downloadOriginalImage(url) {
        const header = {
            "User-Agent": this.ua,
            Cookie: this.cookie,
        };
        const resp = await (0, request_1.downloadWithTimeout)({ url, header, timeout: 40 });
        const data = resp.data;
        if (!data.info.mimeType.startsWith("image")) {
            throw new error_1.EHNetworkError("下载的文件不是图片");
        }
        return data;
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
    async createNewTagset({ tagset, tagset_name, tagset_enable, tagset_color, }) {
        const url = tagset
            ? _updateUrlQuery(this.urls.mytags, { tagset: tagset })
            : this.urls.mytags;
        const header = {
            "User-Agent": this.ua,
            "Content-Type": "application/x-www-form-urlencoded",
            Cookie: this.cookie,
        };
        const body = {
            tagset_action: "create",
            tagset_name,
            tagset_color: tagset_color || "",
        };
        if (tagset_enable)
            body["tagset_enable"] = "on";
        const resp = await this.post({ url, header, body, timeout: 10 });
        const text = await resp.text();
        return (0, parser_1.parseMyTags)(text);
    }
    /**
     * MyTags 删除标签集，必须为空的时候才能删除
     *
     * 请注意，这个方法传入的都是要删除的标签集的信息
     * @param tagset 要删除的标签集的id
     * @param tagset_enable 要删除的标签集是否启用
     * @param tagset_color 要删除的标签集的颜色
     */
    async deleteTagset({ tagset, tagset_enable, tagset_color, }) {
        if (tagset < 1)
            throw new Error("tagset必须大于0");
        if (tagset === 1)
            throw new Error("不能删除默认标签集");
        const url = _updateUrlQuery(this.urls.mytags, { tagset: tagset });
        const header = {
            "User-Agent": this.ua,
            "Content-Type": "application/x-www-form-urlencoded",
            Cookie: this.cookie,
        };
        const body = {
            tagset_action: "delete",
            tagset_name: "",
            tagset_color: tagset_color || "",
        };
        if (tagset_enable)
            body["tagset_enable"] = "on";
        const resp = await this.post({ url, header, body, timeout: 10 });
        const text = await resp.text();
        return (0, parser_1.parseMyTags)(text);
    }
    async _enableOrDisableTagset({ tagset, tagset_enable, tagset_color, }) {
        const url = tagset
            ? _updateUrlQuery(this.urls.mytags, { tagset: tagset })
            : this.urls.mytags;
        const header = {
            "User-Agent": this.ua,
            "Content-Type": "application/x-www-form-urlencoded",
            Cookie: this.cookie,
        };
        const body = {
            tagset_action: "update",
            tagset_name: "",
            tagset_color: tagset_color || "",
        };
        if (tagset_enable)
            body["tagset_enable"] = "on";
        const resp = await this.post({ url, header, body, timeout: 10 });
        const text = await resp.text();
        return (0, parser_1.parseMyTags)(text);
    }
    /**
     *
     * @param param0
     * @param {number} param0.tagset 要启用的标签集的id
     * @param {string} param0.tagset_color 要启用的标签集的颜色
     * @returns
     */
    async enableTagset({ tagset, tagset_color, }) {
        return this._enableOrDisableTagset({
            tagset,
            tagset_enable: true,
            tagset_color,
        });
    }
    /**
     *
     * @param param0
     * @param {number} param0.tagset 要禁用的标签集的id
     * @param {string} param0.tagset_color 要禁用的标签集的颜色
     * @returns
     */
    async disableTagset({ tagset, tagset_color, }) {
        return this._enableOrDisableTagset({
            tagset,
            tagset_enable: false,
            tagset_color,
        });
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
    async addTag({ tagset, namespace, name, watched, hidden, color, weight, }) {
        if (!weight)
            weight = 10;
        if (weight < -99 || weight > 99)
            throw new Error("tagweight必须在-99到99之间");
        if (watched && hidden)
            throw new Error("不能同时设置watched和hidden");
        const url = tagset
            ? _updateUrlQuery(this.urls.mytags, { tagset: tagset })
            : this.urls.mytags;
        const header = {
            "User-Agent": this.ua,
            "Content-Type": "application/x-www-form-urlencoded",
            Cookie: this.cookie,
        };
        const body = {
            usertag_action: "add",
            tagname_new: namespace + ":" + name,
            tagcolor_new: color || "",
            tagweight_new: weight,
            usertag_target: 0,
        };
        if (watched)
            body["tagwatch_new"] = "on";
        if (hidden)
            body["taghide_new"] = "on";
        const resp = await this.post({ url, header, body, timeout: 10 });
        const text = await resp.text();
        return (0, parser_1.parseMyTags)(text);
    }
    /**
     *
     * @param param0
     * @param {number} [param0.tagset]
     * @param {number} param0.tagid
     * @returns
     */
    async deleteTag({ tagset, tagid, }) {
        const url = tagset
            ? _updateUrlQuery(this.urls.mytags, { tagset: tagset })
            : this.urls.mytags;
        const header = {
            "User-Agent": this.ua,
            "Content-Type": "application/x-www-form-urlencoded",
            Cookie: this.cookie,
        };
        const body = {
            usertag_action: "mass",
            tagname_new: "",
            tagcolor_new: "",
            tagweight_new: 10,
            "modify_usertags[]": tagid,
            usertag_target: 0,
        };
        const resp = await this.post({ url, header, body, timeout: 10 });
        const text = await resp.text();
        return (0, parser_1.parseMyTags)(text);
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
    async updateTag({ apiuid, apikey, tagid, watched, hidden, color, weight, }) {
        if (weight < -99 || weight > 99)
            throw new Error("tagweight必须在-99到99之间");
        if (watched && hidden)
            throw new Error("不能同时设置watched和hidden");
        const body = {
            method: "setusertag",
            apiuid,
            apikey,
            tagid,
            tagwatch: watched ? 1 : 0,
            taghide: hidden ? 1 : 0,
            tagcolor: color || "",
            tagweight: weight.toString(),
        };
        const header = {
            "User-Agent": this.ua,
            "Content-Type": "application/json",
            Cookie: this.cookie,
        };
        const resp = await this.post({
            url: this.urls.api,
            header,
            body,
            timeout: 10,
        });
        if (resp.statusCode !== 200)
            throw new error_1.EHAPIError("更新标签失败", resp.statusCode, `更新标签失败，状态码：${resp.statusCode}\nbody：\n${JSON.stringify(body, null, 2)}`);
        return true;
    }
    /**
     * 尝试获取新的igneous
     * 方法是删除cookie中的igneous，然后重新请求首页
     * 此方法限定在exhentai中使用
     */
    async updateCookieIgneous() {
        if (!this._exhentai) {
            throw new Error("updateCookieIgneous only work in exhentai");
        }
        this._cookiejar.deleteCookie("igneous");
        const resp = await (0, request_1.get)(this.urls.default, {
            "User-Agent": this.ua,
            "Content-Type": "application/json",
            Cookie: this.cookie,
        }, 30);
        const setCookie = resp.setCookie();
        const igneous = setCookie.find((n) => n.name === "igneous" && n.value.length === 17);
        if (igneous) {
            this._cookiejar.updateCookie([igneous]);
            const parsed = this.parsedCookie;
            this._cookieChanged(parsed);
            return parsed;
        }
        else {
            throw new error_1.EHAPIError("重新获取igneous失败", 404);
        }
    }
    /**
     * 获取图片配额的信息
     * @returns \{
     *  unlocked: true;
     *  used: number;
     *  total: number;
     *  restCost: number;
     * } | { unlocked: false }
     */
    async getImageLimits() {
        const url = "https://e-hentai.org/home.php";
        const html = await this._getHtml(url);
        return (0, parser_1.parseOverview)(html);
    }
    /**
     * 获取资产金额
     * @returns \{ credits: number, gp: number }
     */
    async getCreditsAndGpCount() {
        // const url = "https://e-hentai.org/exchange.php?t=gp";
        // const html = await this._getHtml(url);
        // return parseGpexchange(html);
        const url = "https://e-hentai.org/archiver.php?gid=530350&token=8b3c7e4a21";
        // 这是mpv demo用的那个图库
        const html = await this._getHtml(url);
        const data = (0, parser_1.parseArchiverInfo)(html);
        return { credits: data.credits, gp: data.gp };
    }
    /**
     * 购买配额(20k GP 买1w配额)
     *
     * 注意：此函数会可能会改变cookie，对非捐赠用户使用会下发一个iq的cookie
     * @returns \{
     *  unlocked: true;
     *  used: number;
     *  total: number;
     *  restCost: number;
     * } | { unlocked: false }
     *
     */
    async UnlockQuota() {
        const url = "https://e-hentai.org/home.php";
        const header = {
            "User-Agent": this.ua,
            "Content-Type": "application/x-www-form-urlencoded",
            Cookie: this.cookie,
        };
        const body = {
            reset_imagelimit: "Unlock Quota",
        };
        const resp = await this.post({ url, header, body, timeout: 10 });
        const text = await resp.text();
        return (0, parser_1.parseOverview)(text);
    }
    /**
     * 重置配额
     *
     * 注意：此函数会可能会改变cookie，对非捐赠用户使用会下发一个iq的cookie
     * @returns \{
     *  unlocked: true;
     *  used: number;
     *  total: number;
     *  restCost: number;
     * } | { unlocked: false }
     *
     */
    async ResetQuota() {
        const url = "https://e-hentai.org/home.php";
        const header = {
            "User-Agent": this.ua,
            "Content-Type": "application/x-www-form-urlencoded",
            Cookie: this.cookie,
        };
        const body = {
            reset_imagelimit: "Reset Quota",
        };
        const resp = await this.post({ url, header, body, timeout: 10 });
        const text = await resp.text();
        return (0, parser_1.parseOverview)(text);
    }
}
exports.EHAPIHandler = EHAPIHandler;
