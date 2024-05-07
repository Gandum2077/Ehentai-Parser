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
exports.parsePageInfo = exports.parseFavcatFavnote = exports.parseConfig = exports.parseMPV = exports.parseGallery = exports.parseList = void 0;
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
function parseList(html) {
    const $ = cheerio.load(html);
    if ($("option[selected='selected'][value='e']").length === 0)
        throw new Error("display mode is not extended");
    let type;
    const h1Text = $("h1").text();
    if (h1Text.includes("entai.org")) {
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
    else {
        throw new Error("Unknown type");
    }
    const prev_page_available = Boolean($("#uprev").attr("href"));
    const next_page_available = Boolean($("#unext").attr("href"));
    const items = _parseListItems($);
    switch (type) {
        case "front_page": {
            const total_item_count = $(".searchtext").length > 0
                ? parseInt($(".searchtext").text().slice(6).replaceAll(",", "")) || 0
                : 0;
            return {
                type,
                prev_page_available,
                next_page_available,
                total_item_count,
                items
            };
        }
        case "watched": {
            return {
                type,
                prev_page_available,
                next_page_available,
                items
            };
        }
        case "popular": {
            return {
                type,
                items
            };
        }
        case "favorites": {
            const sort_order = $("select").eq(0).val() === "p" ? "published_time" : "favorited_time";
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
                items,
                favcat_infos
            };
        }
        default:
            throw new Error("Unknown type");
    }
}
exports.parseList = parseList;
function _parseListItems($) {
    const items = [];
    if ($("table.itg.glte td").length <= 1)
        return items; // 两种情况：1.没有搜索结果 2.搜索结果被全部过滤掉了
    $("table.itg.glte > tbody > tr").each((i, elem) => {
        const tr = $(elem);
        const thumbnail_url = tr.find(".gl1e img").attr("src") || "";
        const gl3eDivs = tr.find(".gl3e > div");
        const category = gl3eDivs.eq(0).text();
        const postedDiv = gl3eDivs.eq(1);
        const posted_time = new Date(postedDiv.text() + " GMT+0000");
        const visible = postedDiv.find("s").length === 0;
        const favcat_title = postedDiv.attr("title")?.toLocaleLowerCase();
        const favorited = Boolean(favcat_title);
        const favcatColor = postedDiv.attr("style")?.slice(13, 17);
        const favcat = favcatColor ? _favcatColors.indexOf(favcatColor) : undefined;
        const starStyle = gl3eDivs.eq(2).attr("style") || "";
        const r = /background-position:-?(\d{1,2})px -?(\d{1,2})px; ?opacity:[0-9.]*/g.exec(starStyle);
        const estimated_display_rating = (r && r.length >= 3) ? (5 - parseInt(r[1]) / 16 - Math.floor(parseInt(r[2]) / 21) * 0.5) : 0;
        const is_my_rating = (gl3eDivs.eq(2).attr("class") || "").includes("irb");
        const uploader = gl3eDivs.eq(3).find("a") ? gl3eDivs.eq(3).find("a").text() : undefined;
        const length = parseInt(gl3eDivs.eq(4).text());
        const torrent_available = gl3eDivs.find(".gldown a").length > 0;
        const favoritd_time = (gl3eDivs.length > 6) ? new Date(gl3eDivs.eq(6).find("p").eq(1).text() + " GMT+0000") : undefined;
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
            length,
            torrent_available,
            favorited,
            favcat,
            favcat_title,
            taglist,
            favoritd_time: favoritd_time?.toISOString()
        });
    });
    return items;
}
function parseGallery(html) {
    const $ = cheerio.load(html);
    const scriptText = $("script").eq(1).text();
    const gid = parseInt(/var gid = (\d*);/.exec(scriptText)?.at(1) || "0");
    const token = /var token = "(\w*)";/.exec(scriptText)?.at(1) || "";
    const apiuid = parseInt(/var apiuid = (\d*);/.exec(scriptText)?.at(1) || "0");
    const apikey = /var apikey = "(\w*)";/.exec(scriptText)?.at(1) || "";
    const average_rating = parseInt(/var average_rating = (.*);/.exec(scriptText)?.at(1) || "0");
    const display_rating = parseInt(/var display_rating = (.*);/.exec(scriptText)?.at(1) || "0");
    // metadata
    const english_title = $("#gn").text();
    const japanese_title = $("#gj").text();
    const thumbnail_url = /\((.*)\)/g.exec($("#gd1 > div").attr("style") || "")?.at(1) || "";
    const category = $("#gdc").text();
    const uploader = ($("#gdn a").length > 0) ? $("#gdn a").text() : undefined;
    const posted_time = new Date($("#gdd tr:nth-of-type(1) td:nth-of-type(2)").text() + " GMT+0000");
    const parentElement = $("#gdd tr:nth-of-type(2) td:nth-of-type(2)");
    const parent_url = (parentElement.text() !== "None") ? parentElement.find("a").attr("href") : undefined;
    const visible = $("#gdd tr:nth-of-type(3) td:nth-of-type(2)").text() === "Yes";
    const languageElement = $("#gdd tr:nth-of-type(4) td:nth-of-type(2)");
    const language = languageElement.contents().eq(0).text().trim();
    const translated = languageElement.find("span").length > 0;
    const file_size = $("#gdd tr:nth-of-type(5) td:nth-of-type(2)").text();
    const length = parseInt($("#gdd tr:nth-of-type(6) td:nth-of-type(2)").text().slice(0, -6));
    const rating_count = parseInt($("#rating_count").text());
    const ratingImageClassAttr = $("#rating_image").attr("class") || "";
    const is_my_rating = ratingImageClassAttr.includes("irb");
    const favorite_count = parseInt($("#gdd tr:nth-of-type(7) td:nth-of-type(2)").text().slice(0, -6));
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
            tr.find("td").eq(1).find("a").each((i, e) => tags.push($(e).text()));
            taglist.push({
                namespace,
                tags
            });
        });
    }
    // newer versions
    const newer_versions = [];
    const divgnd = $("div#gnd");
    if (divgnd.length > 0) {
        const urlArray = [];
        const titleArray = [];
        const postedTimeTextArray = [];
        divgnd.contents().slice(1).each((i, e) => {
            if (i % 3 === 0) {
                urlArray.push($(e).attr("href") || "");
                titleArray.push($(e).text());
            }
            else if (i % 3 === 1) {
                postedTimeTextArray.push($(e).text().slice(8) + " GMT+0000");
            }
        });
        for (let i = 0; i < urlArray.length; i++) {
            newer_versions.push({
                url: urlArray[i],
                title: titleArray[i],
                posted_time: new Date(postedTimeTextArray[i]).toISOString()
            });
        }
    }
    // image
    const images = [];
    let thumbnail_size;
    // 分为两种情况，大图和小图
    // 大图
    if ($("div#gdt div.gdtl").length > 0) {
        thumbnail_size = "large";
        $("div#gdt div.gdtl").each((i, elem) => {
            const img = $(elem).find("img");
            const title = img.attr("title") || "";
            const r = /Page (\d+): (.*)/.exec(title);
            const page = parseInt(r?.at(1) || "0");
            const name = r?.at(2) || "";
            const thumbnail_url = img.attr("src") || "";
            const page_url = $(elem).find("a").attr("href") || "";
            images.push({
                page,
                name,
                page_url,
                thumbnail_url
            });
        });
    }
    else {
        // 小图
        thumbnail_size = "normal";
        $("div#gdt div.gdtm").each((i, elem) => {
            const img = $(elem).find("img");
            const title = img.attr("title") || "";
            const r = /Page (\d+): (.*)/.exec(title);
            const page = parseInt(r?.at(1) || "0");
            const name = r?.at(2) || "";
            const page_url = $(elem).find("a").attr("href") || "";
            const style = $(elem).find("div").attr("style") || "";
            const r2 = /transparent url\((.*)\)/.exec(style);
            const thumbnail_url = r2?.at(1) || ""; // 小图情况下，thumbnail_url是20合1的图，需要自行裁剪出需要的那部分
            images.push({
                page,
                name,
                page_url,
                thumbnail_url
            });
        });
    }
    // comments
    const comments = [];
    if ($("#cdiv .c1").length > 0) {
        $("#cdiv .c1").each((i, elem) => {
            const div = $(elem);
            const divc3 = div.find("div.c3");
            const divc3a = divc3.find("a");
            const commenter = (divc3a.length === 1) ? divc3a.text() : undefined;
            const dateText = /\d{2} \w+ \d{4}, \d{2}:\d{2}/.exec(divc3.contents().eq(0).text())?.at(0) || "";
            const posted_time = new Date(dateText + " GMT+0000");
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
        posted_time: posted_time.toISOString(),
        parent_url,
        visible,
        language,
        translated,
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
        taglist,
        newer_versions,
        thumbnail_size,
        images,
        comments
    };
}
exports.parseGallery = parseGallery;
function parseMPV(html) {
    const $ = cheerio.load(html);
    const text = $("script").eq(1).text();
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
        images: imageJSON.map(v => ({
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
    const favcat = [];
    const divs = $(".nosel > div");
    if (divs.length === 11)
        favorited = true;
    divs.slice(0, 10).each((i, el) => favcat_titles.push($(el).text().trim()));
    const selected_favcat = parseInt($(".nosel input[checked='checked']").val() || "0");
    const favnote = $("textarea").text();
    return { favcat_titles, favorited, selected_favcat, favnote };
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
    const fullSizeUrl = $("#i6 > div:nth-child(3) a").attr("href") || "";
    const downloadButtonText = $("#i6 > div:nth-child(3)").text();
    const reloadParamKey = $("#loadfail").attr("onclick")?.match(/return nl\(\'(.*)\'\)/)?.at(1) || "";
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
        reloadParamKey
    };
}
exports.parsePageInfo = parsePageInfo;
