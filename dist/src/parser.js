"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseEditableComment = exports.parseShowpageInfo = exports.parseMyTags = exports.parseGalleryTorrentsInfo = exports.parseArchiveResult = exports.parseArchiverInfo = exports.parsePageInfo = exports.parseFavcatFavnote = exports.parseConfig = exports.parseMPV = exports.parseGallery = exports.parseMyUpload = exports.parseList = exports.extractGidToken = void 0;
const cheerio = __importStar(require("cheerio"));
const _favcatColors = [
    "#000",
    "#f00",
    "#fa0",
    "#dd0",
    "#080",
    "#9f4",
    "#4bf",
    "#00f",
    "#508",
    "#e8e"
];
function extractGidToken(url) {
    const patt = /https:\/\/e[-x]hentai\.org\/\w+\/(\d+)\/(\w+)\/?/;
    const r = patt.exec(url);
    if (!r || r.length < 3) {
        throw new Error("Invalid url");
    }
    else {
        return {
            gid: parseInt(r[1]),
            token: r[2]
        };
    }
}
exports.extractGidToken = extractGidToken;
function sortTaglist(unsorted) {
    const taglist = [];
    const namespaces = [...new Set(unsorted.map(x => x.namespace))];
    for (const namespace of namespaces) {
        const tags = unsorted.filter(x => x.namespace === namespace).map(x => x.tag);
        taglist.push({
            namespace,
            tags
        });
    }
    return taglist;
}
function parseList(html) {
    const $ = cheerio.load(html);
    let type;
    let display_mode;
    const h1Text = $("h1").text();
    if (h1Text.includes("Hentai")) {
        type = "front_page";
    }
    else if (h1Text.includes("Watched")) {
        type = "watched";
    }
    else if (h1Text.includes("Popular")) {
        type = "popular";
    }
    else if (h1Text.includes("Favorites")) {
        type = "favorites";
    }
    else if (h1Text.includes("Toplists")) {
        type = "toplist";
    }
    else {
        throw new Error("ParseList Error: Unknown type");
    }
    // 获取显示模式
    if (type !== "toplist") {
        const val = $("option[value='e']").parent("select").val(); // 结果可能是 m, p, l, e, t
        if (val === "m" || val === "p") {
            display_mode = "minimal";
        }
        else if (val === "l") {
            display_mode = "compact";
        }
        else if (val === "e") {
            display_mode = "extended";
        }
        else if (val === "t") {
            display_mode = "thumbnail";
        }
        else {
            // 如果没有搜索结果，那么也没有这个select，此参数将没有意义。简化处理，默认为compact
            display_mode = "compact";
        }
    }
    else {
        display_mode = "compact";
    }
    const items = _parseListItems($, display_mode);
    switch (type) {
        case "front_page": {
            const prev_page_available = Boolean($("#uprev").attr("href"));
            const next_page_available = Boolean($("#unext").attr("href"));
            const searchtext = $(".searchtext").text().replace(/,/g, "");
            const r1 = searchtext.match(/(\d+) result/);
            const total_item_count = r1 && r1.length > 1 ? parseInt(r1[1]) : 0;
            const r2 = searchtext.match(/Filtered (\d+)/);
            const filtered_count = r2 && r2.length > 1 ? parseInt(r2[1]) : 0;
            return {
                type,
                display_mode,
                prev_page_available,
                next_page_available,
                total_item_count,
                filtered_count,
                items
            };
        }
        case "watched": {
            const prev_page_available = Boolean($("#uprev").attr("href"));
            const next_page_available = Boolean($("#unext").attr("href"));
            const searchtext = $(".searchtext").text().replace(/,/g, "");
            const r = searchtext.match(/^Filtered (\d+)/);
            const filtered_count = r && r.length > 1 ? parseInt(r[1]) : 0;
            return {
                type,
                display_mode,
                filtered_count,
                prev_page_available,
                next_page_available,
                items
            };
        }
        case "popular": {
            const searchtext = $(".searchtext").text().replace(/,/g, "");
            const r = searchtext.match(/^Filtered (\d+)/);
            const filtered_count = r && r.length > 1 ? parseInt(r[1]) : 0;
            return {
                type,
                display_mode,
                filtered_count,
                items
            };
        }
        case "favorites": {
            const prev_page_available = Boolean($("#uprev").attr("href"));
            const next_page_available = Boolean($("#unext").attr("href"));
            const sort_order = $("select").eq(0).val() === "p" ? "published_time" : "favorited_time";
            let first_item_favorited_timestamp;
            let last_item_favorited_timestamp;
            if (sort_order === "favorited_time") {
                if (prev_page_available) {
                    first_item_favorited_timestamp = parseInt($("#uprev").attr("href")?.match(/prev=\d+-(\d+)/)?.at(1) || "0");
                }
                if (next_page_available) {
                    last_item_favorited_timestamp = parseInt($("#unext").attr("href")?.match(/next=\d+-(\d+)/)?.at(1) || "0");
                }
            }
            const favcat_infos = [];
            $(".ido .nosel .fp").slice(0, -1).each((i, elem) => {
                const fp = $(elem);
                const count = parseInt(fp.find("div").eq(0).text()) || 0;
                const title = fp.find("div").eq(2).text();
                favcat_infos.push({
                    count,
                    title
                });
            });
            return {
                type,
                prev_page_available,
                next_page_available,
                sort_order,
                first_item_favorited_timestamp,
                last_item_favorited_timestamp,
                display_mode,
                items,
                favcat_infos
            };
        }
        case "toplist": {
            const rangeText = $("h1 a").eq(1).text();
            let time_range;
            if (rangeText.includes("Yesterday")) {
                time_range = "yesterday";
            }
            else if (rangeText.includes("Past Year")) {
                time_range = "past_year";
            }
            else if (rangeText.includes("Past Month")) {
                time_range = "past_month";
            }
            else {
                time_range = "all";
            }
            const current_page = parseInt($("table.ptt .ptds").text()) - 1 || 0;
            const total_pages = parseInt($("table.ptt td").eq(-2).text()) || 200;
            return {
                type,
                time_range,
                current_page,
                total_pages,
                items: items
            };
        }
        default:
            throw new Error("Unknown type");
    }
}
exports.parseList = parseList;
function _parseListItems($, displayMode) {
    switch (displayMode) {
        case "minimal":
            return _parseListMinimalItems($);
        case "compact":
            return _parseListCompactItems($);
        case "extended":
            return _parseListExtendedItems($);
        case "thumbnail":
            return _parseListThumbnailItems($);
        default:
            throw new Error("parseList Error: Unknown display mode");
    }
}
function _parseListMinimalItems($) {
    const items = [];
    if ($("table.itg.gltm > tbody > tr").length <= 1)
        return items; // 两种情况：1.没有搜索结果 2.搜索结果被全部过滤掉了
    $("table.itg.gltm > tbody > tr").slice(1).each((i, elem) => {
        const tr = $(elem);
        const thumbnail_url = tr.find(".glthumb img").attr("src") || "";
        const category = tr.find(".glthumb > div:nth-child(2) > div:nth-child(1) > div").eq(0).text();
        const postedDiv = tr.find(".glthumb > div:nth-child(2) > div:nth-child(1) > div").eq(1);
        const posted_time = new Date(postedDiv.text() + "Z");
        const visible = postedDiv.find("s").length === 0;
        const favcat_title = postedDiv.attr("title");
        const favorited = Boolean(favcat_title);
        const favcatColor = postedDiv.attr("style")?.slice(13, 17);
        const favcat = favcatColor ? _favcatColors.indexOf(favcatColor) : undefined;
        const starStyle = tr.find(".glthumb .ir").attr("style") || "";
        const r = /background-position:-?(\d{1,2})px -?(\d{1,2})px; ?opacity:[0-9.]*/g.exec(starStyle);
        const estimated_display_rating = (r && r.length >= 3) ? (5 - parseInt(r[1]) / 16 - Math.floor(parseInt(r[2]) / 21) * 0.5) : 0;
        const is_my_rating = (tr.find(".glthumb .ir").attr("class") || "").includes("irb");
        const length = parseInt(tr.find(".glthumb .ir").next().text());
        const torrent_available = tr.find(".gldown a").length > 0;
        const title = tr.find(".glink").text();
        const url = tr.find(".glname a").attr("href") || "";
        const { gid, token } = extractGidToken(url);
        const taglistUnsorted = [];
        tr.find(".gltm .gt").each((i, el) => {
            const text = $(el).attr("title") || "";
            if (!text.includes(":"))
                return;
            const [a, b] = text.split(":");
            taglistUnsorted.push({
                namespace: (a || "temp"),
                tag: b
            });
        });
        // 只有favorites页面有favorited_time
        const favorited_time = (tr.find(".glfm.glfav").length > 0) ? new Date(tr.find(".glfm.glfav").text() + "Z") : undefined;
        // favorites页面没有uploader
        const uploader = (!favorited_time && tr.find(".gl5m.glhide a").length > 0) ? tr.find(".gl5m.glhide a").text() : undefined;
        const disowned = Boolean(favorited_time) && !Boolean(uploader);
        items.push({
            type: "minimal",
            gid,
            token,
            url,
            title,
            thumbnail_url,
            category,
            posted_time: posted_time.toISOString(),
            visible,
            estimated_display_rating,
            is_my_rating,
            uploader,
            disowned,
            length,
            torrent_available,
            favorited,
            favcat,
            favcat_title,
            taglist: sortTaglist(taglistUnsorted),
            favorited_time: favorited_time?.toISOString()
        });
    });
    return items;
}
function _parseListCompactItems($) {
    const items = [];
    if ($("table.itg.gltc > tbody > tr").length <= 1)
        return items; // 两种情况：1.没有搜索结果 2.搜索结果被全部过滤掉了
    $("table.itg.gltc > tbody > tr").slice(1).each((i, elem) => {
        const tr = $(elem);
        const thumbnail_url = tr.find(".glthumb img").attr("src") || "";
        const category = tr.find(".glthumb > div:nth-child(2) > div:nth-child(1) > div").eq(0).text();
        const postedDiv = tr.find(".glthumb > div:nth-child(2) > div:nth-child(1) > div").eq(1);
        const posted_time = new Date(postedDiv.text() + "Z");
        const visible = postedDiv.find("s").length === 0;
        const favcat_title = postedDiv.attr("title");
        const favorited = Boolean(favcat_title);
        const favcatColor = postedDiv.attr("style")?.slice(13, 17);
        const favcat = favcatColor ? _favcatColors.indexOf(favcatColor) : undefined;
        const starStyle = tr.find(".glthumb .ir").attr("style") || "";
        const r = /background-position:-?(\d{1,2})px -?(\d{1,2})px; ?opacity:[0-9.]*/g.exec(starStyle);
        const estimated_display_rating = (r && r.length >= 3) ? (5 - parseInt(r[1]) / 16 - Math.floor(parseInt(r[2]) / 21) * 0.5) : 0;
        const is_my_rating = (tr.find(".glthumb .ir").attr("class") || "").includes("irb");
        const length = parseInt(tr.find(".glthumb .ir").next().text());
        const torrent_available = tr.find(".gldown a").length > 0;
        const title = tr.find(".glink").text();
        const url = tr.find(".glname a").attr("href") || "";
        const { gid, token } = extractGidToken(url);
        const taglistUnsorted = [];
        tr.find(".glink").next().find(".gt").each((i, el) => {
            const text = $(el).attr("title") || "";
            if (!text.includes(":"))
                return;
            const [a, b] = text.split(":");
            taglistUnsorted.push({
                namespace: (a || "temp"),
                tag: b
            });
        });
        // 只有favorites页面有favorited_time
        const favorited_time = (tr.find(".glfav").length > 0)
            ? new Date(tr.find(".glfav p").eq(0).text() + " " + tr.find(".glfav p").eq(1).text() + "Z")
            : undefined;
        // favorites页面没有uploader
        const uploader = (!favorited_time && tr.find(".glhide a").length > 0) ? tr.find(".glhide a").text() : undefined;
        const disowned = Boolean(favorited_time) && !Boolean(uploader);
        items.push({
            type: "compact",
            gid,
            token,
            url,
            title,
            thumbnail_url,
            category,
            posted_time: posted_time.toISOString(),
            visible,
            estimated_display_rating,
            is_my_rating,
            uploader,
            disowned,
            length,
            torrent_available,
            favorited,
            favcat,
            favcat_title,
            taglist: sortTaglist(taglistUnsorted),
            favorited_time: favorited_time?.toISOString()
        });
    });
    return items;
}
function _parseListExtendedItems($) {
    const items = [];
    if ($("table.itg.glte td").length <= 1)
        return items; // 两种情况：1.没有搜索结果 2.搜索结果被全部过滤掉了
    $("table.itg.glte > tbody > tr").each((i, elem) => {
        const tr = $(elem);
        const thumbnail_url = tr.find(".gl1e img").attr("src") || "";
        const gl3eDivs = tr.find(".gl3e > div");
        const category = gl3eDivs.eq(0).text();
        const postedDiv = gl3eDivs.eq(1);
        const posted_time = new Date(postedDiv.text() + "Z");
        const visible = postedDiv.find("s").length === 0;
        const favcat_title = postedDiv.attr("title");
        const favorited = Boolean(favcat_title);
        const favcatColor = postedDiv.attr("style")?.slice(13, 17);
        const favcat = favcatColor ? _favcatColors.indexOf(favcatColor) : undefined;
        const starStyle = gl3eDivs.eq(2).attr("style") || "";
        const r = /background-position:-?(\d{1,2})px -?(\d{1,2})px; ?opacity:[0-9.]*/g.exec(starStyle);
        const estimated_display_rating = (r && r.length >= 3) ? (5 - parseInt(r[1]) / 16 - Math.floor(parseInt(r[2]) / 21) * 0.5) : 0;
        const is_my_rating = (gl3eDivs.eq(2).attr("class") || "").includes("irb");
        const uploader = gl3eDivs.eq(3).find("a") ? gl3eDivs.eq(3).find("a").text() : undefined;
        const disowned = !Boolean(uploader);
        const length = parseInt(gl3eDivs.eq(4).text());
        const torrent_available = gl3eDivs.find(".gldown a").length > 0;
        const favorited_time = (gl3eDivs.length > 6) ? new Date(gl3eDivs.eq(6).find("p").eq(1).text() + "Z") : undefined;
        const title = tr.find(".glink").text();
        const url = tr.find(".gl2e > div > a").attr("href") || "";
        const taglist = [];
        tr.find(".gl2e > div > a table tr").each((i, el) => {
            const tr = $(el);
            const namespace = tr.find("td").eq(0).text().slice(0, -1);
            const tags = [];
            tr.find("td").eq(1).find("div").each((i, e) => tags.push($(e).text()));
            taglist.push({
                namespace,
                tags
            });
        });
        const { gid, token } = extractGidToken(url);
        items.push({
            type: "extended",
            gid,
            token,
            url,
            title,
            thumbnail_url,
            category,
            posted_time: posted_time.toISOString(),
            visible,
            estimated_display_rating,
            is_my_rating,
            uploader,
            disowned,
            length,
            torrent_available,
            favorited,
            favcat,
            favcat_title,
            taglist,
            favorited_time: favorited_time?.toISOString()
        });
    });
    return items;
}
function _parseListThumbnailItems($) {
    const items = [];
    if ($("div.itg.gld > div").length <= 0)
        return items; // 两种情况：1.没有搜索结果 2.搜索结果被全部过滤掉了
    $("div.itg.gld > div").each((i, elem) => {
        const div = $(elem);
        const thumbnail_url = div.find(".gl3t img").attr("src") || "";
        const category = div.find(".gl5t .cs").text();
        const postedDiv = div.find(".gl5t .cs").next();
        const posted_time = new Date(postedDiv.text() + "Z");
        const visible = postedDiv.find("s").length === 0;
        const favcat_title = postedDiv.attr("title");
        const favorited = Boolean(favcat_title);
        const favcatColor = postedDiv.attr("style")?.slice(13, 17);
        const favcat = favcatColor ? _favcatColors.indexOf(favcatColor) : undefined;
        const starStyle = div.find(".ir").attr("style") || "";
        const r = /background-position:-?(\d{1,2})px -?(\d{1,2})px; ?opacity:[0-9.]*/g.exec(starStyle);
        const estimated_display_rating = (r && r.length >= 3) ? (5 - parseInt(r[1]) / 16 - Math.floor(parseInt(r[2]) / 21) * 0.5) : 0;
        const is_my_rating = (div.find(".ir").attr("class") || "").includes("irb");
        const length = parseInt(div.find(".ir").next().text());
        const torrent_available = div.find(".gldown a").length > 0;
        const title = div.find(".glname a").text();
        const url = div.find(".glname a").attr("href") || "";
        const { gid, token } = extractGidToken(url);
        const taglistUnsorted = [];
        div.find(".gl6t .gt").each((i, el) => {
            const text = $(el).attr("title") || "";
            if (!text.includes(":"))
                return;
            const [a, b] = text.split(":");
            taglistUnsorted.push({
                namespace: (a || "temp"),
                tag: b
            });
        });
        items.push({
            type: "thumbnail",
            gid,
            token,
            url,
            title,
            thumbnail_url,
            category,
            posted_time: posted_time.toISOString(),
            visible,
            estimated_display_rating,
            is_my_rating,
            disowned: false,
            length,
            torrent_available,
            favorited,
            favcat,
            favcat_title,
            taglist: sortTaglist(taglistUnsorted)
        });
    });
    return items;
}
function parseMyUpload(html) {
    const $ = cheerio.load(html);
    const items = [];
    let folder_name = "";
    $("form .s table > tbody > tr").each((i, elem) => {
        const tr = $(elem);
        if (tr.attr("class")?.includes("gtr")) {
            folder_name = tr.find("span").eq(0).text();
            return;
        }
        else {
            // 通过此链接来判断是否为已发布图库
            const managegalleryUrl = tr.find(".gtc1 a").attr("href");
            if (!managegalleryUrl || managegalleryUrl.includes("ulgid"))
                return;
            const title = tr.find(".gtc1 a").text();
            const url = tr.find(".gtc5 a").eq(0).attr("href") || "";
            const { gid, token } = extractGidToken(url);
            const added_time = new Date(tr.find(".gtc2").text() + "Z");
            const length = parseInt(tr.find(".gtc3").text());
            let public_category;
            const public_category_text = tr.find(".gtc4").text();
            if (public_category_text === "-") {
                public_category = "Private";
            }
            else {
                public_category = public_category_text;
            }
            items.push({
                type: "upload",
                folder_name,
                gid,
                token,
                url,
                title,
                added_time: added_time.toISOString(),
                length,
                public_category
            });
        }
    });
    return {
        type: "upload",
        items
    };
}
exports.parseMyUpload = parseMyUpload;
function parseGallery(html) {
    const $ = cheerio.load(html);
    let scriptText = "";
    $("script").each((i, elem) => {
        if ($(elem).html()?.includes("var gid = ")) {
            scriptText = $(elem).html() || "";
        }
    });
    const gid = parseInt(/var gid = (\d*);/.exec(scriptText)?.at(1) || "0");
    const token = /var token = "(\w*)";/.exec(scriptText)?.at(1) || "";
    const apiuid = parseInt(/var apiuid = (\d*);/.exec(scriptText)?.at(1) || "0");
    const apikey = /var apikey = "(\w*)";/.exec(scriptText)?.at(1) || "";
    const average_rating = parseFloat(/var average_rating = (.*);/.exec(scriptText)?.at(1) || "0");
    const display_rating = parseFloat(/var display_rating = (.*);/.exec(scriptText)?.at(1) || "0");
    // metadata
    const english_title = $("#gn").text();
    const japanese_title = $("#gj").text();
    const thumbnail_url = /\((.*)\)/g.exec($("#gd1 > div").attr("style") || "")?.at(1) || "";
    const category = $("#gdc").text();
    const uploader = ($("#gdn a").length > 0) ? $("#gdn a").text() : undefined;
    const disowned = !Boolean(uploader);
    const posted_time = new Date($("#gdd tr:nth-of-type(1) td:nth-of-type(2)").text() + "Z");
    const parentElement = $("#gdd tr:nth-of-type(2) td:nth-of-type(2)");
    const parent_url = (parentElement.text() !== "None") ? parentElement.find("a").attr("href") : undefined;
    let parent_gid = undefined;
    let parent_token = undefined;
    if (parent_url) {
        const r = extractGidToken(parent_url);
        parent_gid = r.gid;
        parent_token = r.token;
    }
    const visible_text = $("#gdd tr:nth-of-type(3) td:nth-of-type(2)").text();
    const visible = visible_text === "Yes";
    let invisible_cause;
    const invisible_cause_tmp = /\((.*)\)/.exec(visible_text)?.at(1)?.toLowerCase();
    if (visible) {
        invisible_cause = undefined;
    }
    else if (invisible_cause_tmp === "expunged"
        || invisible_cause_tmp === "replaced"
        || invisible_cause_tmp === "private") {
        invisible_cause = invisible_cause_tmp;
    }
    else {
        invisible_cause = "unknown";
    }
    const languageElement = $("#gdd tr:nth-of-type(4) td:nth-of-type(2)");
    const language = languageElement.contents().eq(0).text().trim().toLowerCase();
    const translated = languageElement.find("span").length > 0 && languageElement.find("span").text().trim() === "TR";
    const rewrited = languageElement.find("span").length > 0 && languageElement.find("span").text().trim() === "RW";
    const file_size = $("#gdd tr:nth-of-type(5) td:nth-of-type(2)").text();
    const length = parseInt($("#gdd tr:nth-of-type(6) td:nth-of-type(2)").text().slice(0, -6));
    const rating_count = parseInt($("#rating_count").text());
    const ratingImageClassAttr = $("#rating_image").attr("class") || "";
    const is_my_rating = ratingImageClassAttr.includes("irb");
    const torrent_count = parseInt(/\d+/.exec($("#gd5 > p:nth-child(3)").text())?.at(0) || "0");
    let favorite_count;
    const favorite_count_text = $("#gdd tr:nth-of-type(7) td:nth-of-type(2)").text();
    if (favorite_count_text === "Never") {
        favorite_count = 0;
    }
    else if (favorite_count_text === "Once") {
        favorite_count = 1;
    }
    else {
        favorite_count = parseInt($("#gdd tr:nth-of-type(7) td:nth-of-type(2)").text().slice(0, -6));
    }
    let favorited;
    let favcat;
    let favcat_title;
    const favElement = $("#fav .i");
    if (favElement.length === 0) {
        favorited = false;
        favcat = undefined;
        favcat_title = undefined;
    }
    else {
        favorited = true;
        favcat_title = favElement.attr("title");
        const style = favElement.attr("style") || "";
        favcat = Math.floor(parseInt(/background-position:0px -(\d+)px/.exec(style)?.at(1) || "0") / 19);
    }
    // taglist
    const taglist = [];
    if ($("#taglist").length > 0) {
        $("#taglist tr").each((i, elem) => {
            const tr = $(elem);
            const namespace = tr.find("td").eq(0).text().slice(0, -1);
            const tags = [];
            tr.find("td").eq(1).find("a").each((i, e) => {
                let text = $(e).text();
                if (text.includes("|"))
                    text = text.split("|")[0].trim();
                tags.push(text);
            });
            taglist.push({
                namespace,
                tags
            });
        });
    }
    // newer versions
    const newer_versions = [];
    $("#gnd a").each((i, e) => {
        const a = $(e);
        const title = a.text();
        const url = a.attr("href") || "";
        const { gid, token } = extractGidToken(url);
        const timeStr = e.next?.data || "";
        newer_versions.push({
            gid,
            token,
            title,
            posted_time: new Date(timeStr.slice(8) + "Z").toISOString()
        });
    });
    // image
    const images = [];
    let thumbnail_size = $("div#gdt.gt200").length > 0 ? "large" : "normal";
    // 2024-11-5更新：大小图共用一套代码
    $("#gdt a").each((i, elem) => {
        const div = $(elem).find("div");
        const r = /Page (\d+): (.*)/.exec(div.attr("title") || "");
        const page = parseInt(r?.at(1) || "1") - 1;
        const name = r?.at(2) || "";
        const r2 = /width:(\d+)(px)?;height:(\d+)(px)?;background:transparent url\(([^(]+)\) -?(\d+)(px)? -?(\d+)(px)? no-repeat/.exec(div.attr("style") || "");
        const frame = {
            x: parseInt(r2?.at(6) ?? "0"),
            y: parseInt(r2?.at(8) ?? "0"),
            width: parseInt(r2?.at(1) ?? "200"),
            height: parseInt(r2?.at(3) ?? "1")
        };
        const thumbnail_url = r2?.at(5) ?? "";
        const page_url = $(elem).attr("href") || "";
        const imgkey = /hentai.org\/s\/(\w+)\/\d+-\d+/.exec(page_url)?.at(1) || "";
        images.push({
            page,
            name,
            imgkey,
            page_url,
            thumbnail_url,
            frame
        });
    });
    const total_pages = parseInt($('.gtb table.ptt td').eq(-2).text());
    const current_page = parseInt($('.gtb table.ptt td.ptds').text()) - 1;
    let num_of_images_on_each_page = undefined; // 如果只有1页，就没有这个字段
    if (thumbnail_size === "normal" && total_pages > 1) {
        // normal有4种可能：40、100、200、400
        if (total_pages * 40 >= length) {
            num_of_images_on_each_page = 40;
        }
        else if (total_pages * 100 >= length) {
            num_of_images_on_each_page = 100;
        }
        else if (total_pages * 200 >= length) {
            num_of_images_on_each_page = 200;
        }
        else {
            num_of_images_on_each_page = 400;
        }
    }
    else if (thumbnail_size === "large" && total_pages > 1) {
        // large有4种可能：20、50、100、200
        if (total_pages * 20 >= length) {
            num_of_images_on_each_page = 20;
        }
        else if (total_pages * 50 >= length) {
            num_of_images_on_each_page = 50;
        }
        else if (total_pages * 100 >= length) {
            num_of_images_on_each_page = 100;
        }
        else {
            num_of_images_on_each_page = 200;
        }
    }
    // comments
    const comments = [];
    if ($("#cdiv .c1").length > 0) {
        $("#cdiv .c1").each((i, elem) => {
            const div = $(elem);
            const divc3 = div.find("div.c3");
            const divc3a = divc3.find("a");
            const commenter = (divc3a.length >= 1) ? divc3a.eq(0).text() : undefined;
            const dateText = /\d{2} \w+ \d{4}, \d{2}:\d{2}/.exec(divc3.contents().eq(0).text())?.at(0) || "";
            const posted_time = new Date(dateText + " UTC");
            const comment_div = div.find("div.c6").html() || "";
            const is_uploader = div.find("div.c4").text().includes("Uploader Comment");
            let score;
            let comment_id;
            let votes;
            let is_my_comment;
            let voteable;
            let my_vote;
            if (is_uploader) {
                score = undefined;
                comment_id = undefined;
                votes = undefined;
                is_my_comment = false;
                voteable = false;
                my_vote = undefined;
            }
            else {
                score = parseInt(div.find(".c5 > span").text());
                comment_id = parseInt(div.find(".c6").attr("id").slice(8));
                const baseText = div.find(".c7").contents().eq(0).text();
                const base = baseText.match(/^Base \+\d+$/) ? parseInt(baseText.slice(5)) : parseInt(baseText.slice(5, -2));
                const voters = [];
                div.find(".c7 span").each((i, e) => {
                    const r = /(.*) ([+-]\d+)/.exec($(e).text());
                    if (r) {
                        voters.push({
                            voter: r.at(1) || "",
                            score: parseInt(r.at(2) || "0")
                        });
                    }
                });
                const lastLineText = div.find(".c7").contents().eq(-1).text();
                const r = /, and (\d+) more.../.exec(lastLineText);
                const remaining_voter_count = r ? parseInt(r.at(1) || "0") : 0;
                votes = {
                    base,
                    voters,
                    remaining_voter_count
                };
                if (div.find("div.c4").length === 0) {
                    // 不可投票的普通评论（自己评论过之后其他评论不可投票）
                    is_my_comment = false;
                    voteable = false;
                    my_vote = undefined;
                }
                else if (div.find("div.c4 a").text() === "Edit") {
                    // 自己的评论
                    is_my_comment = true;
                    voteable = false;
                    my_vote = undefined;
                }
                else {
                    // 可投票的评论
                    is_my_comment = false;
                    voteable = true;
                    if (div.find("div.c4 a").eq(0).attr("style")) {
                        my_vote = 1;
                    }
                    else if (div.find("div.c4 a").eq(1).attr("style")) {
                        my_vote = -1;
                    }
                }
            }
            comments.push({
                posted_time: posted_time.toISOString(),
                commenter,
                comment_id,
                is_uploader,
                comment_div,
                score,
                votes,
                is_my_comment,
                voteable,
                my_vote
            });
        });
    }
    return {
        gid,
        token,
        apiuid,
        apikey,
        english_title,
        japanese_title,
        thumbnail_url,
        category,
        uploader,
        disowned,
        posted_time: posted_time.toISOString(),
        parent_gid,
        parent_token,
        visible,
        invisible_cause,
        language,
        translated,
        rewrited,
        file_size,
        length,
        rating_count,
        average_rating,
        display_rating,
        is_my_rating,
        favorite_count,
        favorited,
        favcat,
        favcat_title,
        torrent_count,
        taglist,
        newer_versions,
        thumbnail_size,
        total_pages,
        current_page,
        num_of_images_on_each_page,
        images: { [current_page]: images },
        comments
    };
}
exports.parseGallery = parseGallery;
function parseMPV(html) {
    const $ = cheerio.load(html);
    let text = "";
    $("script").each((i, elem) => {
        if ($(elem).html()?.includes("var gid=")) {
            text = $(elem).html() || "";
        }
    });
    const gid = parseInt(/var gid=(\d*);/.exec(text)?.at(1) || "0");
    const mpvkey = /var mpvkey = "(\w*)";/.exec(text)?.at(1) || "";
    const gallery_url = /var gallery_url = "(.*)";/.exec(text)?.at(1) || "";
    const token = /\/g\/\d+\/(\w+)\//.exec(gallery_url)?.at(1) || "";
    const lengthText = /var pagecount = (\d*);/.exec(text)?.at(1) || "0";
    const length = parseInt(lengthText);
    const imageJSONText = text.slice(text.indexOf("["), text.indexOf("]") + 1);
    const imageJSON = JSON.parse(imageJSONText);
    return {
        gid,
        token,
        mpvkey,
        length,
        images: imageJSON.map((v, i) => ({
            page: i,
            key: v.k,
            name: v.n,
            thumbnail_url: v.t,
        }))
    };
}
exports.parseMPV = parseMPV;
function parseConfig(html) {
    const $ = cheerio.load(html);
    // 存储表单值的对象
    const formData = {};
    // 获取所有input元素（包括radio, checkbox）的值
    $('#outer > div:nth-child(3) form input').each((i, el) => {
        const e = $(el);
        const name = e.attr('name');
        if (!name)
            return;
        const type = e.attr('type');
        if (type === 'radio' || type === 'checkbox') {
            if (e.is(':checked')) {
                formData[name] = e.val();
            }
        }
        else {
            formData[name] = e.val();
        }
    });
    // 获取textarea的值
    $('#outer > div:nth-child(3) form textarea').each((i, el) => {
        const e = $(el);
        const name = e.attr('name');
        if (!name)
            return;
        formData[name] = e.val();
    });
    // 获取select的值
    $('#outer > div:nth-child(3) form select').each((i, el) => {
        const e = $(el);
        const name = e.attr('name');
        if (!name)
            return;
        formData[name] = e.find('option:selected').val();
    });
    return formData;
}
exports.parseConfig = parseConfig;
function parseFavcatFavnote(html) {
    let favorited = false;
    const favcat_titles = [];
    const $ = cheerio.load(html);
    const divs = $(".nosel > div");
    if (divs.length === 11)
        favorited = true;
    divs.slice(0, 10).each((i, el) => favcat_titles.push($(el).text().trim()));
    const selected_favcat = parseInt($(".nosel input[checked='checked']").val() || "0");
    const favnote = $("textarea").text();
    const favnote_used_info = $("textarea").parent().find('div').text();
    const r = /(\d+) \/ (\d+)/.exec(favnote_used_info);
    const num_of_favnote_slots = r ? parseInt(r[2]) : 0;
    const num_of_favnote_slots_used = r ? parseInt(r[1]) : 0;
    return {
        favcat_titles,
        favorited,
        selected_favcat,
        favnote, num_of_favnote_slots,
        num_of_favnote_slots_used
    };
}
exports.parseFavcatFavnote = parseFavcatFavnote;
function parsePageInfo(html) {
    const $ = cheerio.load(html);
    const imageUrl = $("#img").attr("src") || "";
    const imageDescription = $("#i4 > div:nth-child(1)").text();
    const splits = imageDescription.split(" :: ");
    const [xres, yres] = splits[1].split(" x ").map(v => parseInt(v));
    const size = { width: xres, height: yres };
    const fileSize = splits[2];
    const reloadKey = $("#loadfail").attr("onclick")?.match(/return nl\(\'(.*)\'\)/)?.at(1) || "";
    let scriptText = "";
    $("script").each((i, elem) => {
        if ($(elem).html()?.includes("var showkey=")) {
            scriptText = $(elem).html() || "";
        }
    });
    const showkey = scriptText.match(/var showkey="(\w*)";/)?.at(1) ?? "";
    let fullSizeUrl = undefined;
    let downloadButtonText = "";
    const lastA = $("#i6 > div a").eq(-1);
    const urlOfLastA = lastA.attr("href") || "";
    if (urlOfLastA.startsWith("https://e-hentai.org/fullimg/") || urlOfLastA.startsWith("https://exhentai.org/fullimg/")) {
        fullSizeUrl = urlOfLastA;
        downloadButtonText = lastA.text();
    }
    const regexResult = /Download original (\d+) x (\d+) (.*)/.exec(downloadButtonText);
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
        reloadKey,
        showkey
    };
}
exports.parsePageInfo = parsePageInfo;
function parseArchiverInfo(html) {
    const $ = cheerio.load(html);
    const url = $("form").attr("action") || "";
    const r = /gid=(\d+)&token=(\w+)/.exec(url);
    if (!r || r.length < 3)
        throw new Error("Invalid url");
    const gid = parseInt(r[1]);
    const token = r[2];
    const download_options = [];
    $("table td").each((i, elem) => {
        const td = $(elem);
        if (td.find("a").length === 0)
            return;
        const solution = /return do_hathdl\('(.*)'\)/.exec(td.find("a").attr("onclick") || "")?.at(1) || "";
        const size = td.find("p:nth-child(2)").text();
        const price = td.find("p:nth-child(3)").text();
        download_options.push({ solution, size, price });
    });
    return {
        gid,
        token,
        download_options
    };
}
exports.parseArchiverInfo = parseArchiverInfo;
/**
 * message 存在三种可能的值：
 * - 'You must have a H@H client assigned to your account to use this feature.'
 * - 'Your H@H client appears to be offline.'
 * - 'A 780x resolution download has been queued for client #48384'
 */
function parseArchiveResult(html) {
    const $ = cheerio.load(html);
    const message = $("p").eq(0).text();
    return { message };
}
exports.parseArchiveResult = parseArchiveResult;
function parseGalleryTorrentsInfo(html) {
    const $ = cheerio.load(html);
    const torrents = [];
    $("table").each((i, elem) => {
        const table = $(elem);
        const titleA = table.find("tr:nth-child(3) > td > a");
        const url = titleA.attr("href") || "";
        const title = titleA.text();
        const uploader = table.find("tr:nth-child(2) > td:nth-child(1)").contents().eq(1).text().trim();
        const tr1_tds = table.find("tr:nth-child(1) > td");
        const posted_time = new Date(tr1_tds.eq(0).find("span").eq(1).text().trim() + "Z");
        const size = tr1_tds.eq(1).contents().eq(1).text().trim();
        const seeds = parseInt(tr1_tds.eq(3).contents().eq(1).text().trim());
        const peers = parseInt(tr1_tds.eq(4).contents().eq(1).text().trim());
        const downloads = parseInt(tr1_tds.eq(5).contents().eq(1).text().trim());
        torrents.push({
            url,
            title,
            uploader,
            posted_time: posted_time.toISOString(),
            size,
            seeds,
            peers,
            downloads
        });
    });
    return torrents;
}
exports.parseGalleryTorrentsInfo = parseGalleryTorrentsInfo;
/**
 *
 * @param html
 */
function parseMyTags(html) {
    const $ = cheerio.load(html);
    const scriptText = $("#outer script").eq(0).text();
    let tagset = 0;
    // scriptText中可获取: apiuid, apikey, tagset_name, tagset_color
    const apiuid = parseInt(/var apiuid = (\d*);/.exec(scriptText)?.at(1) || "0");
    const apikey = /var apikey = "(\w*)";/.exec(scriptText)?.at(1) || "";
    const tagset_name = /var tagset_name = "([^"]*)";/.exec(scriptText)?.at(1) || "";
    let tagset_color = /var tagset_color = "([^"]*)";/.exec(scriptText)?.at(1) || ""; // 此时tagset_color是没有"#"前缀的
    if (tagset_color)
        tagset_color = "#" + tagset_color;
    const tagsets = [];
    $("#tagset_outer select option").each((i, el) => {
        const option = $(el);
        const value = parseInt(option.val());
        const name = option.text();
        const selected = option.prop("selected");
        if (selected)
            tagset = parseInt(option.val());
        tagsets.push({ value, name });
    });
    const enabled = $("#tagwatch_0").prop("checked");
    const tags = [];
    $("#usertags_outer > div").slice(1).each((i, el) => {
        const divs = $(el).children();
        const [a, b] = divs.eq(0).find("div").prop("title").split(":");
        const tagid = parseInt(divs.eq(0).find("div").prop("id").split("_")[1]);
        const watched = divs.eq(1).find("input").prop("checked");
        const hidden = divs.eq(2).find("input").prop("checked");
        const color = divs.eq(4).find("input").val();
        const weight = parseInt(divs.eq(5).find("input").val());
        tags.push({
            tagid,
            namespace: a,
            name: b,
            watched,
            hidden,
            color,
            weight
        });
    });
    return {
        tagset,
        apiuid,
        apikey,
        tagset_name,
        tagset_color,
        enabled,
        tagsets,
        tags
    };
}
exports.parseMyTags = parseMyTags;
function parseShowpageInfo(info) {
    const $i = cheerio.load(info.i);
    const size = {
        width: parseInt(info.x),
        height: parseInt(info.y)
    };
    const fileSize = $i("div").eq(0).text().split(" :: ")[2];
    const $i3 = cheerio.load(info.i3);
    const imageUrl = $i3("img").attr("src") || "";
    const $i6 = cheerio.load(info.i6);
    const reloadKey = $i6("#loadfail").attr("onclick")?.match(/return nl\(\'(.*)\'\)/)?.at(1) || "";
    let fullSizeUrl = undefined;
    let downloadButtonText = "";
    const lastA = $i6("div a").eq(-1);
    const urlOfLastA = lastA.attr("href") || "";
    if (urlOfLastA.startsWith("https://e-hentai.org/fullimg/") || urlOfLastA.startsWith("https://exhentai.org/fullimg/")) {
        fullSizeUrl = urlOfLastA;
        downloadButtonText = lastA.text();
    }
    const regexResult = /Download original (\d+) x (\d+) (.*)/.exec(downloadButtonText);
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
        reloadKey
    };
}
exports.parseShowpageInfo = parseShowpageInfo;
function parseEditableComment(html) {
    const $ = cheerio.load(html);
    const text = $("textarea").text();
    return text;
}
exports.parseEditableComment = parseEditableComment;
