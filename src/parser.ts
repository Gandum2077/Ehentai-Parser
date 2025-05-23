import * as cheerio from "cheerio";
import {
  TagNamespace,
  EHCategory,
  EHFrontPageList,
  EHWatchedList,
  EHPopularList,
  EHFavoritesList,
  EHListMinimalItem,
  EHListCompactItem,
  EHListExtendedItem,
  EHListThumbnailItem,
  EHGallery,
  EHTagListItem,
  EHMPV,
  EHArchive,
  EHListDisplayMode,
  EHTopList,
  EHUploadList,
  EHPage,
  EHMyTags,
  EHFavoriteInfo,
  EHGalleryTorrent,
  EHListUploadItem,
  EHImageLookupList,
} from "./types";

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
  "#e8e",
];

export function extractGidToken(url: string): { gid: number; token: string } {
  const patt = /https:\/\/e[-x]hentai\.org\/\w+\/(\d+)\/(\w+)\/?/;
  const r = patt.exec(url);
  if (!r || r.length < 3) {
    throw new Error("Invalid url");
  } else {
    return {
      gid: parseInt(r[1]),
      token: r[2],
    };
  }
}

function sortTaglist(
  unsorted: { namespace: TagNamespace; tag: string }[]
): EHTagListItem[] {
  const taglist: EHTagListItem[] = [];
  const namespaces = [...new Set(unsorted.map((x) => x.namespace))];
  for (const namespace of namespaces) {
    const tags = unsorted
      .filter((x) => x.namespace === namespace)
      .map((x) => x.tag);
    taglist.push({
      namespace,
      tags,
    });
  }
  return taglist;
}

export function parseList(
  html: string
):
  | EHFrontPageList
  | EHWatchedList
  | EHPopularList
  | EHFavoritesList
  | EHTopList
  | EHImageLookupList {
  const $ = cheerio.load(html);

  let type:
    | "front_page"
    | "watched"
    | "popular"
    | "favorites"
    | "toplist"
    | "image_lookup";
  let display_mode: EHListDisplayMode;
  const h1Text = $("h1").text();
  if (h1Text.includes("Hentai")) {
    if ($("#searchbox a").eq(0).text().includes("Show File Search")) {
      type = "image_lookup";
    } else {
      type = "front_page";
    }
  } else if (h1Text.includes("Watched")) {
    type = "watched";
  } else if (h1Text.includes("Popular")) {
    type = "popular";
  } else if (h1Text.includes("Favorites")) {
    type = "favorites";
  } else if (h1Text.includes("Toplists")) {
    type = "toplist";
  } else {
    throw new Error("ParseList Error: Unknown type");
  }
  // 获取显示模式
  if (type !== "toplist") {
    const val = $("option[value='e']").parent("select").val();
    // 结果可能是 m, p, l, e, t
    if (val === "m" || val === "p") {
      display_mode = "minimal";
    } else if (val === "l") {
      display_mode = "compact";
    } else if (val === "e") {
      display_mode = "extended";
    } else if (val === "t") {
      display_mode = "thumbnail";
    } else {
      // 如果没有搜索结果，那么也没有这个select，此参数将没有意义。简化处理，默认为compact
      display_mode = "compact";
    }
  } else {
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
        items,
      };
    }
    case "image_lookup": {
      const prev_page_available = Boolean($("#uprev").attr("href"));
      const next_page_available = Boolean($("#unext").attr("href"));
      const searchtext = $(".searchtext").text().replace(/,/g, "");
      const r = searchtext.match(/(\d+) result/);
      const total_item_count = r && r.length > 1 ? parseInt(r[1]) : 0;
      return {
        type,
        display_mode,
        prev_page_available,
        next_page_available,
        total_item_count,
        items,
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
        items,
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
        items,
      };
    }
    case "favorites": {
      const prev_page_available = Boolean($("#uprev").attr("href"));
      const next_page_available = Boolean($("#unext").attr("href"));
      const sort_order =
        $("select").eq(0).val() === "p" ? "published_time" : "favorited_time";
      let first_item_favorited_timestamp: number | undefined;
      let last_item_favorited_timestamp: number | undefined;
      if (sort_order === "favorited_time") {
        if (prev_page_available) {
          first_item_favorited_timestamp = parseInt(
            $("#uprev")
              .attr("href")
              ?.match(/prev=\d+-(\d+)/)
              ?.at(1) || "0"
          );
        }
        if (next_page_available) {
          last_item_favorited_timestamp = parseInt(
            $("#unext")
              .attr("href")
              ?.match(/next=\d+-(\d+)/)
              ?.at(1) || "0"
          );
        }
      }
      const favcat_infos: {
        count: number;
        title: string;
      }[] = [];
      $(".ido .nosel .fp")
        .slice(0, -1)
        .each((i, elem) => {
          const fp = $(elem);
          const count = parseInt(fp.find("div").eq(0).text()) || 0;
          const title = fp.find("div").eq(2).text();
          favcat_infos.push({
            count,
            title,
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
        favcat_infos,
      };
    }
    case "toplist": {
      const rangeText = $("h1 a").eq(1).text();
      let time_range: "all" | "past_month" | "past_year" | "yesterday";
      if (rangeText.includes("Yesterday")) {
        time_range = "yesterday";
      } else if (rangeText.includes("Past Year")) {
        time_range = "past_year";
      } else if (rangeText.includes("Past Month")) {
        time_range = "past_month";
      } else {
        time_range = "all";
      }
      const current_page = parseInt($("table.ptt .ptds").text()) - 1 || 0;
      const total_pages = parseInt($("table.ptt td").eq(-2).text()) || 200;
      return {
        type,
        time_range,
        current_page,
        total_pages,
        items: items as EHListCompactItem[],
      };
    }
    default:
      throw new Error("Unknown type");
  }
}

function _parseListItems($: cheerio.Root, displayMode: EHListDisplayMode) {
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

function _parseListMinimalItems($: cheerio.Root): EHListMinimalItem[] {
  const items: EHListMinimalItem[] = [];
  if ($("table.itg.gltm > tbody > tr").length <= 1) return items;
  // 两种情况：1.没有搜索结果 2.搜索结果被全部过滤掉了
  $("table.itg.gltm > tbody > tr")
    .slice(1)
    .each((i, elem) => {
      const tr = $(elem);
      const thumbnail_url = tr.find(".glthumb img").attr("src") || "";
      const category = tr
        .find(".glthumb > div:nth-child(2) > div:nth-child(1) > div")
        .eq(0)
        .text() as EHCategory;
      const postedDiv = tr
        .find(".glthumb > div:nth-child(2) > div:nth-child(1) > div")
        .eq(1);
      const posted_time = new Date(postedDiv.text() + "Z");
      const visible = postedDiv.find("s").length === 0;
      const favcat_title = postedDiv.attr("title");
      const favorited = Boolean(favcat_title);
      const favcatColor = postedDiv.attr("style")?.slice(13, 17);
      const favcat = favcatColor
        ? (_favcatColors.indexOf(favcatColor) as
            | 0
            | 1
            | 2
            | 3
            | 4
            | 5
            | 6
            | 7
            | 8
            | 9)
        : undefined;
      const starStyle = tr.find(".glthumb .ir").attr("style") || "";
      const r =
        /background-position:-?(\d{1,2})px -?(\d{1,2})px; ?opacity:[0-9.]*/g.exec(
          starStyle
        );
      const estimated_display_rating =
        r && r.length >= 3
          ? 5 - parseInt(r[1]) / 16 - Math.floor(parseInt(r[2]) / 21) * 0.5
          : 0;
      const is_my_rating = (
        tr.find(".glthumb .ir").attr("class") || ""
      ).includes("irb");
      const length = parseInt(tr.find(".glthumb .ir").next().text());
      const torrent_available = tr.find(".gldown a").length > 0;
      const title = tr.find(".glink").text();
      const url = tr.find(".glname a").attr("href") || "";
      const { gid, token } = extractGidToken(url);
      const taglistUnsorted: { namespace: TagNamespace; tag: string }[] = [];
      tr.find(".gltm .gt").each((i, el) => {
        const text = $(el).attr("title") || "";
        if (!text.includes(":")) return;
        const [a, b] = text.split(":");
        taglistUnsorted.push({
          namespace: (a || "temp") as TagNamespace,
          tag: b,
        });
      });

      // 只有favorites页面有favorited_time
      const favorited_time =
        tr.find(".glfm.glfav").length > 0
          ? new Date(tr.find(".glfm.glfav").text() + "Z")
          : undefined;
      // favorites页面没有uploader
      const uploader =
        !favorited_time && tr.find(".gl5m.glhide a").length > 0
          ? tr.find(".gl5m.glhide a").text()
          : undefined;
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
        favorited_time: favorited_time?.toISOString(),
      });
    });
  return items;
}

function _parseListCompactItems($: cheerio.Root): EHListCompactItem[] {
  const items: EHListCompactItem[] = [];
  if ($("table.itg.gltc > tbody > tr").length <= 1) return items;
  // 两种情况：1.没有搜索结果 2.搜索结果被全部过滤掉了
  $("table.itg.gltc > tbody > tr")
    .slice(1)
    .each((i, elem) => {
      const tr = $(elem);
      const thumbnail_url = tr.find(".glthumb img").attr("src") || "";
      const category = tr
        .find(".glthumb > div:nth-child(2) > div:nth-child(1) > div")
        .eq(0)
        .text() as EHCategory;
      const postedDiv = tr
        .find(".glthumb > div:nth-child(2) > div:nth-child(1) > div")
        .eq(1);
      const posted_time = new Date(postedDiv.text() + "Z");
      const visible = postedDiv.find("s").length === 0;
      const favcat_title = postedDiv.attr("title");
      const favorited = Boolean(favcat_title);
      const favcatColor = postedDiv.attr("style")?.slice(13, 17);
      const favcat = favcatColor
        ? (_favcatColors.indexOf(favcatColor) as
            | 0
            | 1
            | 2
            | 3
            | 4
            | 5
            | 6
            | 7
            | 8
            | 9)
        : undefined;
      const starStyle = tr.find(".glthumb .ir").attr("style") || "";
      const r =
        /background-position:-?(\d{1,2})px -?(\d{1,2})px; ?opacity:[0-9.]*/g.exec(
          starStyle
        );
      const estimated_display_rating =
        r && r.length >= 3
          ? 5 - parseInt(r[1]) / 16 - Math.floor(parseInt(r[2]) / 21) * 0.5
          : 0;
      const is_my_rating = (
        tr.find(".glthumb .ir").attr("class") || ""
      ).includes("irb");
      const length = parseInt(tr.find(".glthumb .ir").next().text());
      const torrent_available = tr.find(".gldown a").length > 0;
      const title = tr.find(".glink").text();
      const url = tr.find(".glname a").attr("href") || "";
      const { gid, token } = extractGidToken(url);
      const taglistUnsorted: { namespace: TagNamespace; tag: string }[] = [];
      tr.find(".glink")
        .next()
        .find(".gt")
        .each((i, el) => {
          const text = $(el).attr("title") || "";
          if (!text.includes(":")) return;
          const [a, b] = text.split(":");
          taglistUnsorted.push({
            namespace: (a || "temp") as TagNamespace,
            tag: b,
          });
        });
      // 只有favorites页面有favorited_time
      const favorited_time =
        tr.find(".glfav").length > 0
          ? new Date(
              tr.find(".glfav p").eq(0).text() +
                " " +
                tr.find(".glfav p").eq(1).text() +
                "Z"
            )
          : undefined;
      // favorites页面没有uploader
      const uploader =
        !favorited_time && tr.find(".glhide a").length > 0
          ? tr.find(".glhide a").text()
          : undefined;
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
        favorited_time: favorited_time?.toISOString(),
      });
    });
  return items;
}

function _parseListExtendedItems($: cheerio.Root): EHListExtendedItem[] {
  const items: EHListExtendedItem[] = [];
  if ($("table.itg.glte td").length <= 1) return items;
  // 两种情况：1.没有搜索结果 2.搜索结果被全部过滤掉了
  $("table.itg.glte > tbody > tr").each((i, elem) => {
    const tr = $(elem);
    const thumbnail_url = tr.find(".gl1e img").attr("src") || "";
    const gl3eDivs = tr.find(".gl3e > div");
    const category = gl3eDivs.eq(0).text() as EHCategory;
    const postedDiv = gl3eDivs.eq(1);
    const posted_time = new Date(postedDiv.text() + "Z");
    const visible = postedDiv.find("s").length === 0;
    const favcat_title = postedDiv.attr("title");
    const favorited = Boolean(favcat_title);
    const favcatColor = postedDiv.attr("style")?.slice(13, 17);
    const favcat = favcatColor
      ? (_favcatColors.indexOf(favcatColor) as
          | 0
          | 1
          | 2
          | 3
          | 4
          | 5
          | 6
          | 7
          | 8
          | 9)
      : undefined;
    const starStyle = gl3eDivs.eq(2).attr("style") || "";
    const r =
      /background-position:-?(\d{1,2})px -?(\d{1,2})px; ?opacity:[0-9.]*/g.exec(
        starStyle
      );
    const estimated_display_rating =
      r && r.length >= 3
        ? 5 - parseInt(r[1]) / 16 - Math.floor(parseInt(r[2]) / 21) * 0.5
        : 0;
    const is_my_rating = (gl3eDivs.eq(2).attr("class") || "").includes("irb");
    const uploader = gl3eDivs.eq(3).find("a")
      ? gl3eDivs.eq(3).find("a").text()
      : undefined;
    const disowned = !Boolean(uploader);
    const length = parseInt(gl3eDivs.eq(4).text());
    const torrent_available = gl3eDivs.find(".gldown a").length > 0;
    const favorited_time =
      gl3eDivs.length > 6
        ? new Date(gl3eDivs.eq(6).find("p").eq(1).text() + "Z")
        : undefined;
    const title = tr.find(".glink").text();
    const url = tr.find(".gl2e > div > a").attr("href") || "";
    const taglist: EHTagListItem[] = [];
    tr.find(".gl2e > div > a table tr").each((i, el) => {
      const tr = $(el);
      const namespace = tr.find("td").eq(0).text().slice(0, -1) as TagNamespace;
      const tags: string[] = [];
      tr.find("td")
        .eq(1)
        .find("div")
        .each((i, e) => tags.push($(e).text()));
      taglist.push({
        namespace,
        tags,
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
      favorited_time: favorited_time?.toISOString(),
    });
  });
  return items;
}

function _parseListThumbnailItems($: cheerio.Root): EHListThumbnailItem[] {
  const items: EHListThumbnailItem[] = [];
  if ($("div.itg.gld > div").length <= 0) return items;
  // 两种情况：1.没有搜索结果 2.搜索结果被全部过滤掉了
  $("div.itg.gld > div").each((i, elem) => {
    const div = $(elem);
    const thumbnail_url = div.find(".gl3t img").attr("src") || "";
    const category = div.find(".gl5t .cs").text() as EHCategory;
    const postedDiv = div.find(".gl5t .cs").next();
    const posted_time = new Date(postedDiv.text() + "Z");
    const visible = postedDiv.find("s").length === 0;
    const favcat_title = postedDiv.attr("title");
    const favorited = Boolean(favcat_title);
    const favcatColor = postedDiv.attr("style")?.slice(13, 17);
    const favcat = favcatColor
      ? (_favcatColors.indexOf(favcatColor) as
          | 0
          | 1
          | 2
          | 3
          | 4
          | 5
          | 6
          | 7
          | 8
          | 9)
      : undefined;
    const starStyle = div.find(".ir").attr("style") || "";
    const r =
      /background-position:-?(\d{1,2})px -?(\d{1,2})px; ?opacity:[0-9.]*/g.exec(
        starStyle
      );
    const estimated_display_rating =
      r && r.length >= 3
        ? 5 - parseInt(r[1]) / 16 - Math.floor(parseInt(r[2]) / 21) * 0.5
        : 0;
    const is_my_rating = (div.find(".ir").attr("class") || "").includes("irb");
    const length = parseInt(div.find(".ir").next().text());
    const torrent_available = div.find(".gldown a").length > 0;
    const title = div.find(".glname a").text();
    const url = div.find(".glname a").attr("href") || "";
    const { gid, token } = extractGidToken(url);
    const taglistUnsorted: { namespace: TagNamespace; tag: string }[] = [];
    div.find(".gl6t .gt").each((i, el) => {
      const text = $(el).attr("title") || "";
      if (!text.includes(":")) return;
      const [a, b] = text.split(":");
      taglistUnsorted.push({
        namespace: (a || "temp") as TagNamespace,
        tag: b,
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
      taglist: sortTaglist(taglistUnsorted),
    });
  });
  return items;
}

export function parseMyUpload(html: string): EHUploadList {
  const $ = cheerio.load(html);

  let scriptText = "";
  $("script").each((i, elem) => {
    if ($(elem).html()?.includes("var apiuid = ")) {
      scriptText = $(elem).html() || "";
    }
  });
  const apiuid = parseInt(/var apiuid = (\d*);/.exec(scriptText)?.at(1) || "0");
  const apikey = /var apikey = "(\w*)";/.exec(scriptText)?.at(1) || "";

  const folders: EHUploadList["folders"] = [];
  $("form div.s")
    .eq(-1)
    .find("table > tbody > tr")
    .each((i, elem) => {
      const tr = $(elem);

      if (tr.attr("class")?.includes("gtr")) {
        const name = tr.find("span").eq(0).text();
        const count = parseInt(tr.find("strong").eq(0).text());
        const fid = parseInt(
          tr.find("a").attr("id")?.split("_")?.at(-1) || "-1"
        );
        const collapsed = tr.find("a").text().includes("+");
        folders.push({
          name,
          fid,
          count,
          collapsed,
          items: [] as EHListUploadItem[],
        });
      } else {
        // 通过此链接来判断是否为已发布图库
        const managegalleryUrl = tr.find(".gtc1 a").attr("href");
        if (!managegalleryUrl || managegalleryUrl.includes("ulgid")) return;

        const title = tr.find(".gtc1 a").text();
        const url = tr.find(".gtc5 a").eq(0).attr("href") || "";
        const { gid, token } = extractGidToken(url);
        const added_time = new Date(tr.find(".gtc2").text() + "Z");
        const length = parseInt(tr.find(".gtc3").text());
        let public_category: EHCategory;
        const public_category_text = tr.find(".gtc4").text();
        if (public_category_text === "-") {
          public_category = "Private";
        } else {
          public_category = public_category_text as EHCategory;
        }
        folders.at(-1)!.items.push({
          type: "upload",
          gid,
          token,
          url,
          title,
          added_time: added_time.toISOString(),
          length,
          public_category,
        });
      }
    });

  return {
    type: "upload",
    apiuid,
    apikey,
    folders,
  };
}

/**
 *
 * @param info
 * @param info.c1
 */
export function parseUncollapseInfo(info: {
  state: "p" | "u";
  fid: number;
  rows: {
    c1: string; // html a标签，里面包含标题
    c2: string; // 上传时间: 2025-02-19 21:23
    c3: string; // 页数: 46
    c4: string; // 类别: Doujinshi -代表Private
    c5: string; // 和后面管理按钮有关的html，里面有gid和token
    c6: string; // 和后面checkbox有关的html
  }[];
}): EHListUploadItem[] {
  return info.rows.map((row) => {
    const title = cheerio.load(row.c1)("a").text();
    const url =
      cheerio
        .load(row.c5.slice(1, row.c5.indexOf("]")))("a")
        .attr("href") || "";
    const { gid, token } = extractGidToken(url);

    const added_time = new Date(row.c2 + "Z");
    const length = parseInt(row.c3);

    let public_category: EHCategory;
    const public_category_text = row.c4;
    if (public_category_text === "-") {
      public_category = "Private";
    } else {
      public_category = public_category_text as EHCategory;
    }
    return {
      type: "upload" as "upload",
      gid,
      token,
      url,
      title,
      added_time: added_time.toISOString(),
      length,
      public_category,
    };
  });
}

export function parseGallery(html: string): EHGallery {
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
  const average_rating = parseFloat(
    /var average_rating = (.*);/.exec(scriptText)?.at(1) || "0"
  );
  const display_rating = parseFloat(
    /var display_rating = (.*);/.exec(scriptText)?.at(1) || "0"
  );
  // metadata
  const english_title = $("#gn").text();
  const japanese_title = $("#gj").text();
  const thumbnail_url =
    /\((.*)\)/g.exec($("#gd1 > div").attr("style") || "")?.at(1) || "";
  const category = $("#gdc").text() as EHCategory;
  const uploader = $("#gdn a").length > 0 ? $("#gdn a").text() : undefined;
  const disowned = !Boolean(uploader);
  const posted_time = new Date(
    $("#gdd tr:nth-of-type(1) td:nth-of-type(2)").text() + "Z"
  );
  const parentElement = $("#gdd tr:nth-of-type(2) td:nth-of-type(2)");
  const parent_url =
    parentElement.text() !== "None"
      ? parentElement.find("a").attr("href")
      : undefined;
  let parent_gid: number | undefined = undefined;
  let parent_token: string | undefined = undefined;
  if (parent_url) {
    const r = extractGidToken(parent_url);
    parent_gid = r.gid;
    parent_token = r.token;
  }
  const visible_text = $("#gdd tr:nth-of-type(3) td:nth-of-type(2)").text();
  const visible = visible_text === "Yes";
  let invisible_cause: EHGallery["invisible_cause"];
  const invisible_cause_tmp = /\((.*)\)/
    .exec(visible_text)
    ?.at(1)
    ?.toLowerCase();
  if (visible) {
    invisible_cause = undefined;
  } else if (
    invisible_cause_tmp === "expunged" ||
    invisible_cause_tmp === "replaced" ||
    invisible_cause_tmp === "private"
  ) {
    invisible_cause = invisible_cause_tmp;
  } else {
    invisible_cause = "unknown";
  }
  const languageElement = $("#gdd tr:nth-of-type(4) td:nth-of-type(2)");
  const language = languageElement.contents().eq(0).text().trim().toLowerCase();
  const translated =
    languageElement.find("span").length > 0 &&
    languageElement.find("span").text().trim() === "TR";
  const rewrited =
    languageElement.find("span").length > 0 &&
    languageElement.find("span").text().trim() === "RW";

  const file_size = $("#gdd tr:nth-of-type(5) td:nth-of-type(2)").text();
  const length = parseInt(
    $("#gdd tr:nth-of-type(6) td:nth-of-type(2)").text().slice(0, -6)
  );

  const rating_count = parseInt($("#rating_count").text());
  const ratingImageClassAttr = $("#rating_image").attr("class") || "";
  const is_my_rating = ratingImageClassAttr.includes("irb");

  const torrent_count = parseInt(
    /\d+/.exec($("#gd5 > p:nth-child(3)").text())?.at(0) || "0"
  );

  let favorite_count: number;
  const favorite_count_text = $(
    "#gdd tr:nth-of-type(7) td:nth-of-type(2)"
  ).text();
  if (favorite_count_text === "Never") {
    favorite_count = 0;
  } else if (favorite_count_text === "Once") {
    favorite_count = 1;
  } else {
    favorite_count = parseInt(
      $("#gdd tr:nth-of-type(7) td:nth-of-type(2)").text().slice(0, -6)
    );
  }
  let favorited: boolean;
  let favcat: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | undefined;
  let favcat_title: string | undefined;
  const favElement = $("#fav .i");
  if (favElement.length === 0) {
    favorited = false;
    favcat = undefined;
    favcat_title = undefined;
  } else {
    favorited = true;
    favcat_title = favElement.attr("title");
    const style = favElement.attr("style") || "";
    favcat = Math.floor(
      parseInt(/background-position:0px -(\d+)px/.exec(style)?.at(1) || "0") /
        19
    ) as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
  }

  // taglist
  const taglist: EHTagListItem[] = [];
  if ($("#taglist").length > 0) {
    $("#taglist tr").each((i, elem) => {
      const tr = $(elem);
      const namespace = tr.find("td").eq(0).text().slice(0, -1) as TagNamespace;
      const tags: string[] = [];
      tr.find("td")
        .eq(1)
        .find("a")
        .each((i, e) => {
          let text = $(e).text();
          if (text.includes("|")) text = text.split("|")[0].trim();
          tags.push(text);
        });
      taglist.push({
        namespace,
        tags,
      });
    });
  }
  // newer versions
  const newer_versions: EHGallery["newer_versions"] = [];
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
      posted_time: new Date(timeStr.slice(8) + "Z").toISOString(),
    });
  });

  // image
  const images: {
    page: number; // 从0开始
    name: string;
    imgkey: string;
    thumbnail_url: string;
    frame: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  }[] = [];
  let thumbnail_size: "normal" | "large" =
    $("div#gdt.gt200").length > 0 ? "large" : "normal";
  // 2024-11-5更新：大小图共用一套代码
  $("#gdt a").each((i, elem) => {
    const div = $(elem).find("div[title]");
    const r = /Page (\d+): (.*)/.exec(div.attr("title") || "");
    const page = parseInt(r?.at(1) || "1") - 1;
    const name = r?.at(2) || "";

    const r2 =
      /width:(\d+)(px)?;height:(\d+)(px)?;background:transparent url\(([^(]+)\) -?(\d+)(px)? -?(\d+)(px)? no-repeat/.exec(
        div.attr("style") || ""
      );
    const frame = {
      x: parseInt(r2?.at(6) ?? "0"),
      y: parseInt(r2?.at(8) ?? "0"),
      width: parseInt(r2?.at(1) ?? "200"),
      height: parseInt(r2?.at(3) ?? "1"),
    };
    const thumbnail_url = r2?.at(5) ?? "";

    const page_url = $(elem).attr("href") || "";
    const imgkey = /hentai.org\/s\/(\w+)\/\d+-\d+/.exec(page_url)?.at(1) || "";
    images.push({
      page,
      name,
      imgkey,
      thumbnail_url,
      frame,
    });
  });
  const total_pages = parseInt($(".gtb table.ptt td").eq(-2).text());
  const current_page = parseInt($(".gtb table.ptt td.ptds").text()) - 1;
  let num_of_images_on_each_page: number | undefined = undefined;
  // 如果只有1页，就没有这个字段
  if (thumbnail_size === "normal" && total_pages > 1) {
    // normal有4种可能：40、100、200、400
    if (total_pages * 40 >= length) {
      num_of_images_on_each_page = 40;
    } else if (total_pages * 100 >= length) {
      num_of_images_on_each_page = 100;
    } else if (total_pages * 200 >= length) {
      num_of_images_on_each_page = 200;
    } else {
      num_of_images_on_each_page = 400;
    }
  } else if (thumbnail_size === "large" && total_pages > 1) {
    // large有4种可能：20、50、100、200
    if (total_pages * 20 >= length) {
      num_of_images_on_each_page = 20;
    } else if (total_pages * 50 >= length) {
      num_of_images_on_each_page = 50;
    } else if (total_pages * 100 >= length) {
      num_of_images_on_each_page = 100;
    } else {
      num_of_images_on_each_page = 200;
    }
  }
  // comments
  const comments: EHGallery["comments"] = [];
  if ($("#cdiv .c1").length > 0) {
    $("#cdiv .c1").each((i, elem) => {
      const div = $(elem);
      const divc3 = div.find("div.c3");
      const divc3a = divc3.find("a");
      const commenter = divc3a.length >= 1 ? divc3a.eq(0).text() : undefined;
      const dateText =
        /\d{2} \w+ \d{4}, \d{2}:\d{2}/
          .exec(divc3.contents().eq(0).text())
          ?.at(0) || "";
      const posted_time = new Date(dateText + " UTC");
      const comment_div = div.find("div.c6").html() || "";
      const is_uploader = div
        .find("div.c4")
        .text()
        .includes("Uploader Comment");
      let score: number | undefined;
      let comment_id: number | undefined;
      let votes:
        | {
            base: number;
            voters: {
              voter: string;
              score: number;
            }[];
            remaining_voter_count: number;
          }
        | undefined;
      let is_my_comment: boolean;
      let voteable: boolean;
      let my_vote: 1 | -1 | undefined;
      if (is_uploader) {
        score = undefined;
        comment_id = undefined;
        votes = undefined;
        is_my_comment = false;
        voteable = false;
        my_vote = undefined;
      } else {
        score = parseInt(div.find(".c5 > span").text());
        comment_id = parseInt(div.find(".c6").attr("id")!.slice(8));
        const baseText = div.find(".c7").contents().eq(0).text();
        const base = baseText.match(/^Base \+\d+$/)
          ? parseInt(baseText.slice(5))
          : parseInt(baseText.slice(5, -2));
        const voters: { voter: string; score: number }[] = [];
        div.find(".c7 span").each((i, e) => {
          const r = /(.*) ([+-]\d+)/.exec($(e).text());
          if (r) {
            voters.push({
              voter: r.at(1) || "",
              score: parseInt(r.at(2) || "0"),
            });
          }
        });
        const lastLineText = div.find(".c7").contents().eq(-1).text();
        const r = /, and (\d+) more.../.exec(lastLineText);
        const remaining_voter_count = r ? parseInt(r.at(1) || "0") : 0;
        votes = {
          base,
          voters,
          remaining_voter_count,
        };
        if (div.find("div.c4").length === 0) {
          // 不可投票的普通评论（自己评论过之后其他评论不可投票）
          is_my_comment = false;
          voteable = false;
          my_vote = undefined;
        } else if (div.find("div.c4 a").text() === "Edit") {
          // 自己的评论
          is_my_comment = true;
          voteable = false;
          my_vote = undefined;
        } else {
          // 可投票的评论
          is_my_comment = false;
          voteable = true;
          if (div.find("div.c4 a").eq(0).attr("style")) {
            my_vote = 1;
          } else if (div.find("div.c4 a").eq(1).attr("style")) {
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
        my_vote,
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
    comments,
  };
}

export function parseMPV(html: string): EHMPV {
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
  const imageJSON: { n: string; k: string; t: string }[] =
    JSON.parse(imageJSONText);

  const frames: { x: number; y: number; width: number; height: number }[] = [];
  $("#pane_thumbs a > div").each((i, elem) => {
    const style = $(elem).attr("style") || "";
    const r = /width:(\d+)px;height:(\d+)px;/.exec(style);
    const width = parseInt(r?.at(1) ?? "200");
    const height = parseInt(r?.at(2) ?? "1");
    const t = imageJSON[i].t;
    const r2 = /\(([^(]+)\) -?(\d+)(px)? -?(\d+)(px)?/.exec(t);
    const x = parseInt(r2?.at(2) ?? "0");
    const y = parseInt(r2?.at(4) ?? "0");
    frames.push({ x, y, width, height });
  });
  return {
    gid,
    token,
    mpvkey,
    length,
    images: imageJSON.map((v, i) => ({
      page: i,
      name: v.n,
      imgkey: v.k,
      thumbnail_url: /\(([^(]+)\)/.exec(v.t)?.at(1) || "",
      frame: frames[i],
    })),
  };
}

export function parseConfig(html: string): { [key: string]: string } {
  const $ = cheerio.load(html);

  // 存储表单值的对象
  const formData: { [key: string]: string } = {};

  // 获取所有input元素（包括radio, checkbox）的值
  $("#outer > div:nth-child(3) form input").each((i, el) => {
    const e = $(el);
    const name = e.attr("name");
    if (!name) return;
    const type = e.attr("type");
    if (type === "radio" || type === "checkbox") {
      if (e.is(":checked")) {
        formData[name] = e.val();
      }
    } else {
      formData[name] = e.val();
    }
  });

  // 获取textarea的值
  $("#outer > div:nth-child(3) form textarea").each((i, el) => {
    const e = $(el);
    const name = e.attr("name");
    if (!name) return;
    formData[name] = e.val();
  });

  // 获取select的值
  $("#outer > div:nth-child(3) form select").each((i, el) => {
    const e = $(el);
    const name = e.attr("name");
    if (!name) return;
    formData[name] = e.find("option:selected").val();
  });

  return formData;
}

export function parseFavcatFavnote(html: string): EHFavoriteInfo {
  let favorited: boolean = false;
  const favcat_titles: string[] = [];

  const $ = cheerio.load(html);
  const divs = $(".nosel > div");
  if (divs.length === 11) favorited = true;
  divs.slice(0, 10).each((i, el) => favcat_titles.push($(el).text().trim()));
  const selected_favcat = parseInt(
    $(".nosel input[checked='checked']").val() || "0"
  );
  const favnote = $("textarea").text();
  const favnote_used_info = $("textarea").parent().find("div").text();
  const r = /(\d+) \/ (\d+)/.exec(favnote_used_info);
  const num_of_favnote_slots = r ? parseInt(r[2]) : 0;
  const num_of_favnote_slots_used = r ? parseInt(r[1]) : 0;
  return {
    favcat_titles,
    favorited,
    selected_favcat,
    favnote,
    num_of_favnote_slots,
    num_of_favnote_slots_used,
  };
}

export function parsePageInfo(html: string): EHPage {
  const $ = cheerio.load(html);
  const imageUrl = $("#img").attr("src") || "";
  const imageDescription = $("#i4 > div:nth-child(1)").text();
  const splits = imageDescription.split(" :: ");
  const [xres, yres] = splits[1].split(" x ").map((v) => parseInt(v));
  const size = { width: xres, height: yres };
  const fileSize = splits[2];
  const reloadKey =
    $("#loadfail")
      .attr("onclick")
      ?.match(/return nl\(\'(.*)\'\)/)
      ?.at(1) || "";
  let scriptText = "";
  $("script").each((i, elem) => {
    if ($(elem).html()?.includes("var showkey=")) {
      scriptText = $(elem).html() || "";
    }
  });
  const showkey = scriptText.match(/var showkey="(\w*)";/)?.at(1) ?? "";

  let fullSizeUrl: string | undefined = undefined;
  let downloadButtonText: string = "";
  const lastA = $("#i6 > div a").eq(-1);
  const urlOfLastA = lastA.attr("href") || "";
  if (
    urlOfLastA.startsWith("https://e-hentai.org/fullimg/") ||
    urlOfLastA.startsWith("https://exhentai.org/fullimg/")
  ) {
    fullSizeUrl = urlOfLastA;
    downloadButtonText = lastA.text();
  }
  const regexResult = /Download original (\d+) x (\d+) (.*)/.exec(
    downloadButtonText
  );
  let fullSize: { width: number; height: number };
  let fullFileSize: string;
  if (regexResult && regexResult.length === 4) {
    fullSize = {
      width: parseInt(regexResult[1]),
      height: parseInt(regexResult[2]),
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
    reloadKey,
    showkey,
  };
}

export function parseArchiverInfo(html: string): EHArchive {
  const $ = cheerio.load(html);
  const url = $("form").attr("action") || "";
  const r = /gid=(\d+)&token=(\w+)/.exec(url);
  if (!r || r.length < 3) throw new Error("Invalid url");
  const gid = parseInt(r[1]);
  const token = r[2];

  let credits = -1;
  let gp = -1;
  const pElem = $("#db > p").eq(1);
  if (pElem.length > 0) {
    gp = parseInt(
      /[,\d]+/
        .exec(pElem.contents().eq(0).text())
        ?.at(0)
        ?.replaceAll(",", "") ?? "-1"
    );
    credits = parseInt(
      /[,\d]+/
        .exec(pElem.contents().eq(2).text())
        ?.at(0)
        ?.replaceAll(",", "") ?? "-1"
    );
  }

  const _parseCost = (text: string) => {
    if (text.trim().toLowerCase().startsWith("free")) {
      return 0;
    } else {
      return parseInt(/[,\d]+/.exec(text)?.at(0)?.replaceAll(",", "") ?? "-1");
    }
  };

  const archiveElems = $("#db > div > div");
  const originalArchiveElems = archiveElems.eq(0);
  const originalCost = _parseCost(
    originalArchiveElems.find("div > strong").text()
  );
  const originalSize = originalArchiveElems.find("p > strong").text();

  const resampleArchiveElems = archiveElems.eq(1);
  const resampleCost = _parseCost(
    resampleArchiveElems.find("div > strong").text()
  );
  const resampleSize = resampleArchiveElems.find("p > strong").text();

  const hath_download_options: EHArchive["hath_download_options"] = [];
  $("table td").each((i, elem) => {
    const td = $(elem);
    if (td.find("a").length === 0) return;
    const solutionText =
      /return do_hathdl\('(.*)'\)/
        .exec(td.find("a").attr("onclick") || "")
        ?.at(1) || "";
    const original = solutionText === "org";

    const size = td.find("p:nth-child(2)").text();
    const cost = _parseCost(td.find("p:nth-child(3)").text());
    if (original) {
      hath_download_options.push({ original: true, size, cost });
    } else {
      const solution = parseInt(solutionText);
      hath_download_options.push({ original: false, solution, size, cost });
    }
  });
  return {
    gid,
    token,
    credits,
    original_archive_option: {
      cost: originalCost,
      size: originalSize,
    },
    resample_archive_option: {
      cost: resampleCost,
      size: resampleSize,
    },
    gp,
    hath_download_options,
  };
}

/**
 * message 存在三种可能的值：
 * - 'You must have a H@H client assigned to your account to use this feature.'
 * - 'Your H@H client appears to be offline.'
 * - 'A 780x resolution download has been queued for client #48384'
 */
export function parseArchiveResult(html: string): {
  message: string;
} {
  const $ = cheerio.load(html);
  const message = $("p").eq(0).text();
  return { message };
}

export function parseArchiveDownloadInfo(html: string): { hath_url: string } {
  const $ = cheerio.load(html);
  const hath_url = $("#continue > a").attr("href") || "";
  return { hath_url };
}

export function parseGalleryTorrentsInfo(html: string): EHGalleryTorrent[] {
  const $ = cheerio.load(html);
  const torrents: EHGalleryTorrent[] = [];
  $("table").each((i, elem) => {
    const table = $(elem);
    const titleA = table.find("tr:nth-child(3) > td > a");
    const url = titleA.attr("href") || "";
    const title = titleA.text();
    const uploader = table
      .find("tr:nth-child(2) > td:nth-child(1)")
      .contents()
      .eq(1)
      .text()
      .trim();
    const tr1_tds = table.find("tr:nth-child(1) > td");
    const posted_time = new Date(
      tr1_tds.eq(0).find("span").eq(1).text().trim() + "Z"
    );
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
      downloads,
    });
  });
  return torrents;
}

/**
 *
 * @param html
 */
export function parseMyTags(html: string): EHMyTags {
  const $ = cheerio.load(html);
  let scriptText = "";
  $("script").each((i, elem) => {
    if ($(elem).html()?.includes("var apiuid")) {
      scriptText = $(elem).html() || "";
    }
  });
  let tagset: number = 0;
  // scriptText中可获取: apiuid, apikey, tagset_name, tagset_color
  const apiuid = parseInt(/var apiuid = (\d*);/.exec(scriptText)?.at(1) || "0");
  const apikey = /var apikey = "(\w*)";/.exec(scriptText)?.at(1) || "";
  const tagset_name =
    /var tagset_name = "([^"]*)";/.exec(scriptText)?.at(1) || "";
  let tagset_color =
    /var tagset_color = "([^"]*)";/.exec(scriptText)?.at(1) || "";
  // 此时tagset_color是没有"#"前缀的
  if (tagset_color) tagset_color = "#" + tagset_color;
  const tagsets: {
    value: number;
    name: string;
  }[] = [];
  $("#tagset_outer select option").each((i, el) => {
    const option = $(el);
    const value = parseInt(option.val());
    const name = option.text();
    const selected = option.prop("selected");
    if (selected) tagset = parseInt(option.val());
    tagsets.push({ value, name });
  });
  const enabled = $("#tagwatch_0").prop("checked");
  const tags: EHMyTags["tags"] = [];
  $("#usertags_outer > div")
    .slice(1)
    .each((i, el) => {
      const divs = $(el).children();
      const [a, b] = divs.eq(0).find("div").prop("title").split(":");
      const tagid = parseInt(divs.eq(0).find("div").prop("id").split("_")[1]);
      const watched = divs.eq(1).find("input").prop("checked");
      const hidden = divs.eq(2).find("input").prop("checked");
      const color = divs.eq(4).find("input").val();
      const weight = parseInt(divs.eq(5).find("input").val());
      tags.push({
        tagid,
        namespace: a as TagNamespace,
        name: b as string,
        watched,
        hidden,
        color,
        weight,
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
    tags,
  };
}

export function parseShowpageInfo(info: {
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
}) {
  const $i = cheerio.load(info.i);
  const size = {
    width: parseInt(info.x),
    height: parseInt(info.y),
  };
  const fileSize = $i("div").eq(0).text().split(" :: ")[2];
  const $i3 = cheerio.load(info.i3);
  const imageUrl = $i3("img").attr("src") || "";
  const $i6 = cheerio.load(info.i6);
  const reloadKey =
    $i6("#loadfail")
      .attr("onclick")
      ?.match(/return nl\(\'(.*)\'\)/)
      ?.at(1) || "";
  let fullSizeUrl: string | undefined = undefined;
  let downloadButtonText: string = "";
  const lastA = $i6("div a").eq(-1);
  const urlOfLastA = lastA.attr("href") || "";
  if (
    urlOfLastA.startsWith("https://e-hentai.org/fullimg/") ||
    urlOfLastA.startsWith("https://exhentai.org/fullimg/")
  ) {
    fullSizeUrl = urlOfLastA;
    downloadButtonText = lastA.text();
  }

  const regexResult = /Download original (\d+) x (\d+) (.*)/.exec(
    downloadButtonText
  );
  let fullSize: { width: number; height: number };
  let fullFileSize: string;
  if (regexResult && regexResult.length === 4) {
    fullSize = {
      width: parseInt(regexResult[1]),
      height: parseInt(regexResult[2]),
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
    reloadKey,
  };
}

export function parseEditableComment(html: string) {
  const $ = cheerio.load(html);
  const text = $("textarea").text();
  return text;
}

export function parseCopyrightPage(
  html: string
): { unavailable: true; copyrightOwner?: string } | { unavailable: false } {
  const $ = cheerio.load(html);
  const text = $(".d p")
    .first()
    .contents()
    .filter((i, elem) => elem.type === "text")
    .first()
    .text()
    .trim();
  if (text.includes("unavailable due to a copyright claim")) {
    const copyrightOwner = text.split(" by ").at(1)?.split(".").at(0);
    return { unavailable: true, copyrightOwner };
  } else {
    return { unavailable: false };
  }
}

export function parseGpexchange(html: string) {
  const $ = cheerio.load(html);
  const credits = parseInt(
    /[,\d]+/
      .exec($("#buyform").parent().next().text())
      ?.at(0)
      ?.replaceAll(",", "") ?? "-1"
  );
  const kgp = parseInt(
    /[,\d]+/
      .exec($("#sellform").parent().next().text())
      ?.at(0)
      ?.replaceAll(",", "") ?? "-1"
  );
  return { credits, kgp };
}

export function parseOverview(html: string):
  | {
      unlocked: true;
      used: number;
      total: number;
      restCost: number;
    }
  | { unlocked: false } {
  const $ = cheerio.load(html);
  const unlocked =
    $('.stuffbox > .homebox > form > p > input[value="Reset Quota"]').length >
    0;
  if (unlocked) {
    const used = parseInt(
      $(".stuffbox > .homebox > p > strong:nth-child(1)")
        .eq(0)
        .text()
        .replaceAll(",", "")
    );
    const total = parseInt(
      $(".stuffbox > .homebox > p > strong:nth-child(2)")
        .eq(0)
        .text()
        .replaceAll(",", "")
    );
    const restCost = parseInt(
      $(".stuffbox > .homebox > p:nth-child(3) > strong")
        .eq(0)
        .text()
        .replaceAll(",", "")
    );
    return {
      unlocked: true,
      used,
      total,
      restCost,
    };
  } else {
    return { unlocked: false };
  }
}
