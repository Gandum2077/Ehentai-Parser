"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EHentaiApiHandler = void 0;
const url_parse_1 = __importDefault(require("url-parse"));
const request_1 = require("./request");
const parser_1 = require("./parser");
function _updateUrlQuery(url, query, removeUndefined = false) {
    const u = new url_parse_1.default(url, true);
    const newQuery = (removeUndefined)
        ? Object.fromEntries(Object.entries(query).filter(([k, v]) => v !== undefined))
        : query;
    u.set('query', newQuery);
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
    Misc: 1
};
function _assembleSearchTerms(searchTerms) {
    if (!searchTerms || searchTerms.length === 0)
        return;
    return searchTerms.map(searchTerm => {
        let result = "";
        if (searchTerm.namespace)
            result += searchTerm.namespace + ":"; // 添加命名空间
        result += (searchTerm.exact) ? `"${searchTerm.term}$"` : `"${searchTerm.term}"`;
        if (searchTerm.exclude)
            result = `-${result}`;
        if (searchTerm.or)
            result = `~${result}`;
        return result;
    }).join(" ");
}
function _formatUTCDate(date) {
    const year = date.getUTCFullYear(); // 获取年份
    const month = (date.getUTCMonth() + 1).toString().padStart(2, '0'); // 获取月份，加1后转为两位字符串
    const day = date.getUTCDate().toString().padStart(2, '0'); // 获取日期，转为两位字符串
    return `${year}-${month}-${day}`; // 使用模板字符串拼接
}
// SearchOptions to SearchParams
function _searchOptionsToParams(options) {
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
    let f_cats;
    if (options.filteredCategories && options.filteredCategories.length > 0)
        f_cats = options.filteredCategories.reduce((acc, cur) => acc + EHCategoryNumber[cur], 0);
    if (f_cats === 1023)
        f_cats = undefined;
    const f_search = _assembleSearchTerms(options.searchTerms);
    // 只要用到了高级搜索，就要设置advsearch参数
    const usingAdvancedSearch = options.browseExpungedGalleries
        || options.requireGalleryTorrent
        || options.minimumPages
        || options.maximumPages
        || options.minimumRating
        || options.disableLanguageFilters
        || options.disableUploaderFilters
        || options.disableTagFilters;
    const advsearch = usingAdvancedSearch ? 1 : undefined;
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
    const seek = options.seek ? _formatUTCDate(options.seek) : undefined;
    // 返回搜索参数，但是要删除所有值为undefined的键
    const params = {
        f_cats,
        f_search,
        advsearch,
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
    };
    return params;
}
function _favoriteSearchOptionsToParams(options) {
    // 检查搜索参数是否合法
    if (options.range && (options.minimumGid || options.maximumGid || options.jump || options.seek)) {
        throw new Error("range参数与prev、next、jump、seek参数不兼容");
    }
    if (options.minimumGid && options.maximumGid) {
        throw new Error("prev和next参数不能同时使用");
    }
    if (options.jump && options.seek) {
        throw new Error("jump和seek参数不能同时使用");
    }
    if (options.seek && /^\d\d\d\d-\d\d-\d\d$/.exec(options.seek) === null) {
        throw new Error("seek参数必须是一个符合格式的日期字符串");
    }
    const f_search = _assembleSearchTerms(options.searchTerms);
    const favcat = options.favcat;
    const range = options.range || undefined;
    const prev = options.minimumGid || undefined;
    const next = options.maximumGid || undefined;
    const jump = options.jump ? `${options.jump.value}${options.jump.unit}` : undefined;
    const seek = options.seek;
    const params = {
        f_search,
        favcat,
        range,
        prev,
        next,
        jump,
        seek
    };
    return params;
}
class EHentaiApiHandler {
    constructor(cookie, exhentai = true, ua = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_3_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148") {
        this.cookie = cookie;
        this.ua = ua;
        const t = (exhentai) ? "x" : "-";
        this.urls = {
            default: `https://e${t}hentai.org/`,
            homepage: `https://e${t}hentai.org/`,
            watched: `https://e${t}hentai.org/watched`,
            popular: `https://e${t}hentai.org/popular`,
            favorites: `https://e${t}hentai.org/favorites.php`,
            config: `https://e${t}hentai.org/uconfig.php`,
            api: `https://e${t}hentai.org/api.php`,
            gallerypopups: `https://e${t}hentai.org/gallerypopups.php`,
            toplist: "https://e-hentai.org/toplist.php",
            upload: `https://upld.e-hentai.org/manage?ss=d&sd=d` // 自带按时间降序排序
        };
    }
    async _getHtml(url) {
        const header = {
            "User-Agent": this.ua,
            "Cookie": this.cookie
        };
        const resp = await (0, request_1.get)(url, header, 20);
        const text = await resp.text();
        return text;
    }
    async getFrontPageInfo(options = {}) {
        const url = _updateUrlQuery(this.urls.default, _searchOptionsToParams(options), true);
        const text = await this._getHtml(url);
        return (0, parser_1.parseList)(text);
    }
    async getWatchedInfo(options = {}) {
        const url = _updateUrlQuery(this.urls.watched, _searchOptionsToParams(options), true);
        const text = await this._getHtml(url);
        return (0, parser_1.parseList)(text);
    }
    async getPopularInfo() {
        const text = await this._getHtml(this.urls.watched);
        return (0, parser_1.parseList)(text);
    }
    async getFavoritesInfo(options = {}) {
        const url = _updateUrlQuery(this.urls.favorites, _favoriteSearchOptionsToParams(options), true);
        const text = await this._getHtml(url);
        return (0, parser_1.parseList)(text);
    }
    async getTopListInfo(timeRange, page) {
        const map = {
            "yesterday": 15,
            "past_month": 13,
            "past_year": 12,
            "all": 11
        };
        const url = _updateUrlQuery(this.urls.toplist, { p: page - 1 || undefined, tl: map[timeRange] }, true);
        const text = await this._getHtml(url);
        return (0, parser_1.parseList)(text);
    }
    async getUploadInfo() {
        const text = await this._getHtml(this.urls.upload);
        return (0, parser_1.parseMyUpload)(text);
    }
    async getGalleryInfo(gid, token, fullComments = true) {
        const url = fullComments ? this.urls.default + `g/${gid}/${token}/?hc=1` : this.urls.default + `g/${gid}/${token}/`;
        const text = await this._getHtml(url);
        return (0, parser_1.parseGallery)(text);
    }
    async getMPVInfo(gid, token) {
        const url = this.urls.default + `mpv/${gid}/${token}/`;
        const text = await this._getHtml(url);
        return (0, parser_1.parseMPV)(text);
    }
    async getPageInfo(gid, imgkey, page) {
        const url = this.urls.default + `s/${imgkey}/${gid}-${page}`;
        const text = await this._getHtml(url);
        return (0, parser_1.parsePageInfo)(text);
    }
    async getArchiverInfo(gid, token, or) {
        const url = this.urls.default + `archiver.php?gid=${gid}&token=${token}&or=${or}`;
        const text = await this._getHtml(url);
        return (0, parser_1.parseArchiverInfo)(text);
    }
    /**
     * 重要参数：
     * dm: "2" 代表使用Extended模式
     * ts: "1" 代表thumbnail的size为large
     */
    async getConfig() {
        const header = {
            "User-Agent": this.ua,
            "Cookie": this.cookie
        };
        const resp = await (0, request_1.get)(this.urls.config, header, 10);
        const text = await resp.text();
        return (0, parser_1.parseConfig)(text);
    }
    async postConfig(config) {
        const header = {
            "User-Agent": this.ua,
            "Content-Type": "application/x-www-form-urlencoded",
            "Cookie": this.cookie
        };
        const resp = await (0, request_1.post)(this.urls.config, header, config, 10);
        return resp.statusCode === 200;
    }
    async setFavoritesSortOrder(sortOrder) {
        const url = _updateUrlQuery(this.urls.favorites, {
            inline_set: sortOrder === "f" ? "fs_f" : "fs_p"
        });
        const header = {
            "User-Agent": this.ua,
            "Cookie": this.cookie
        };
        var resp = await (0, request_1.get)(url, header, 10);
        return resp.statusCode === 200;
    }
    async getFavcatFavnote(gid, token) {
        const url = _updateUrlQuery(this.urls.gallerypopups, {
            gid: gid,
            t: token,
            act: "addfav"
        });
        const header = {
            "User-Agent": this.ua,
            "Cookie": this.cookie
        };
        const resp = await (0, request_1.get)(url, header, 10);
        const text = await resp.text();
        return (0, parser_1.parseFavcatFavnote)(text);
    }
    async addFav(gid, token, favcat, favnote = "") {
        const url = _updateUrlQuery(this.urls.gallerypopups, {
            gid: gid,
            t: token,
            act: "addfav"
        });
        const header = {
            "User-Agent": this.ua,
            "Content-Type": "application/x-www-form-urlencoded",
            "Cookie": this.cookie
        };
        const body = {
            favcat: favcat.toString(),
            favnote: favnote,
            update: "1"
        };
        const resp = await (0, request_1.post)(url, header, body, 10);
        return resp.statusCode === 200;
    }
    async deleteFav(gid, token) {
        const url = _updateUrlQuery(this.urls.gallerypopups, {
            gid: gid,
            t: token,
            act: "addfav"
        });
        const header = {
            "User-Agent": this.ua,
            "Content-Type": "application/x-www-form-urlencoded",
            "Cookie": this.cookie
        };
        const body = {
            favcat: "favdel",
            favnote: "",
            update: "1"
        };
        const resp = await (0, request_1.post)(url, header, body, 10);
        return resp.statusCode === 200;
    }
    async rateGallery(gid, token, apikey, apiuid, rating) {
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
        const resp = await (0, request_1.post)(this.urls.api, header, body, 10);
        return resp.statusCode === 200;
    }
    async postNewComment(gid, token, text) {
        const gallery_url = this.urls.default + `g/${gid}/${token}/`;
        const header = {
            "User-Agent": this.ua,
            "Content-Type": "application/x-www-form-urlencoded",
            Cookie: this.cookie
        };
        const body = { commenttext_new: text };
        const resp = await (0, request_1.post)(gallery_url, header, body, 10);
        if (resp.statusCode === 200) {
            const text = await resp.text();
            return {
                success: true,
                infos: (0, parser_1.parseGallery)(text)
            };
        }
        else {
            return {
                success: false
            };
        }
    }
    async getEditComment(gid, token, apikey, apiuid, comment_id) {
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
        const resp = await (0, request_1.post)(this.urls.api, header, body, 10);
        const success = resp.statusCode === 200;
        if (success) {
            const data = await resp.json();
            return {
                success: true,
                editable_comment: data.editable_comment,
                comment_id: data.comment_id
            };
        }
        else {
            return {
                success: false
            };
        }
    }
    async postEditComment(gid, token, comment_id, text) {
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
        const resp = await (0, request_1.post)(gallery_url, header, body, 10);
        if (resp.statusCode === 200) {
            const text = await resp.text();
            return {
                success: true,
                infos: (0, parser_1.parseGallery)(text)
            };
        }
        else {
            return {
                success: false
            };
        }
    }
    async voteComment(gid, token, comment_id, apikey, apiuid, comment_vote // 1 for upvote, -1 for downvote, 但是同一个数字既代表投票也代表取消投票，需要先判断当前投票
    ) {
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
        const resp = await (0, request_1.post)(this.urls.api, header, body, 10);
        return resp.statusCode === 200;
    }
    async fetchImageInfo(gid, key, mpvkey, page, nl) {
        const header = {
            "User-Agent": this.ua,
            "Content-Type": "application/json",
            Cookie: this.cookie
        };
        const body = {
            method: "imagedispatch",
            gid: gid,
            page: page,
            imgkey: key,
            mpvkey: mpvkey
        };
        if (nl)
            body["nl"] = nl;
        const resp = await (0, request_1.post)(this.urls.api, header, body, 20);
        if (resp.statusCode !== 200)
            throw new Error("请求失败");
        const info = await resp.json();
        const imageUrl = info.i;
        const size = {
            width: parseInt(info.xres),
            height: parseInt(info.yres)
        };
        const fileSize = info.d.split(" :: ")[1];
        const fullSizeUrl = this.urls.default + info.lf;
        const reloadAPIKey = info.s;
        const regexResult = /Download original (\d+) x (\d+) (.*) source/.exec(info.o);
        let fullSize;
        let fullFileSize;
        if (regexResult && regexResult.length === 4) {
            fullSize = {
                width: parseInt(regexResult[1]),
                height: parseInt(regexResult[2])
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
            reloadAPIKey
        };
    }
    async downloadImage(url, noCookie = false, usingDownloadAPI = false) {
        const header = { "User-Agent": this.ua };
        if (!noCookie)
            header["Cookie"] = this.cookie;
        if (usingDownloadAPI) {
            const resp = await $http.download({
                url: url,
                timeout: 30,
                showsProgress: false,
                header
            });
            return resp.data;
        }
        else {
            const resp = await (0, request_1.get)(url, header, 30);
            return await resp.data();
        }
    }
    async startHathDownload(gid, token, or, xres) {
        const url = this.urls.default + `archiver.php?gid=${gid}&token=${token}&or=${or}`;
        const header = {
            "User-Agent": this.ua,
            "Content-Type": "application/x-www-form-urlencoded",
            Cookie: this.cookie
        };
        const body = {
            hathdl_xres: xres,
        };
        const resp = await (0, request_1.post)(url, header, body, 10);
        if (resp.statusCode !== 200) {
            return {
                success: false
            };
        }
        const html = await resp.text();
        const { message } = (0, parser_1.parseArchiveResult)(html);
        let result;
        if (message === 'You must have a H@H client assigned to your account to use this feature.') {
            result = "no-hath";
        }
        else if (message === 'Your H@H client appears to be offline.') {
            result = "offline";
        }
        else {
            result = "success";
        }
        return {
            success: true,
            message: result,
            rawMessage: message
        };
    }
}
exports.EHentaiApiHandler = EHentaiApiHandler;
