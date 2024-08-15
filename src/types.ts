export type TagNamespace = "artist" | "character" | "cosplayer" | "female"
  | "group" | "language" | "male" | "mixed" | "other" | "parody" | "reclass" | "temp"

export type TagNamespaceAlternate = "a" | "c" | "cos" | "f" | "g" | "l" | "m" 
  | "x" | "o" | "p" | "r" | "char" | "circle" | "lang" | "series" | "temp"

export type EHQualifier = "tag" | "weak" | "title" | "uploader" | "uploaduid" | "gid" | "comment" | "favnote"

export type EHSearchedCategory = "Doujinshi" | "Manga" | "Artist CG" | "Game CG" | "Western"
  | "Non-H" | "Image Set" | "Cosplay" | "Asian Porn" | "Misc"

export type EHCategory = EHSearchedCategory | "Private"

export type EHListDisplayMode = "minimal" | "compact" | "extended" | "thumbnail"

export interface EHFrontPageList {
  type: "front_page";
  prev_page_available: boolean;
  next_page_available: boolean;
  total_item_count: number; // 全部数量
  filtered_count: number; // 当前页面被过滤的数量
  display_mode: EHListDisplayMode;
  items: EHListMinimalItem[] | EHListCompactItem[] | EHListExtendedItem[] | EHListThumbnailItem[];
}

export interface EHWatchedList {
  type: "watched";
  prev_page_available: boolean;
  next_page_available: boolean;
  filtered_count: number; // 当前页面被过滤的数量
  display_mode: EHListDisplayMode;
  items: EHListMinimalItem[] | EHListCompactItem[] | EHListExtendedItem[] | EHListThumbnailItem[];
}

export interface EHPopularList {
  type: "popular";
  filtered_count: number; // 当前页面被过滤的数量
  display_mode: EHListDisplayMode;
  items: EHListMinimalItem[] | EHListCompactItem[] | EHListExtendedItem[] | EHListThumbnailItem[];
}

export interface EHFavoritesList {
  type: "favorites";
  prev_page_available: boolean;
  next_page_available: boolean;
  sort_order: "favorited_time" | "published_time";
  display_mode: EHListDisplayMode;
  items: EHListMinimalItem[] | EHListCompactItem[] | EHListExtendedItem[] | EHListThumbnailItem[];
  favcat_infos: {
    count: number;
    title: string;
  }[];
}

export interface EHTopList {
  type: "toplist";
  time_range: "yesterday" | "past_month" | "past_year" | "all";
  current_page: number; // 从1开始
  total_page: number;
  items: EHListCompactItem[];
}

export interface EHUploadList {
  type: "upload";
  items: {
    folder_name: string;
    gid: number;
    token: string;
    url: string;
    title: string;
    added_time: string;
    length: number;
    public_category: EHCategory; // 上传时的分类，有可能和正式的分类不同
  }[];
}

interface EHItemBase {
  type: string;
  gid: number;
  token: string;
  url: string;
  title: string;
  thumbnail_url: string;
  category: EHCategory;
  posted_time: string;
  visible: boolean;
  estimated_display_rating: number;
  is_my_rating: boolean;
  length: number;
  torrent_available: boolean;
  favorited: boolean;
  favcat?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
  favcat_title?: string;
}

export interface EHListMinimalItem extends EHItemBase {
  // 同时作用于minimal和minimal+
  type: "minimal";
  uploader?: string;  // 上传者，在收藏页是直接不显示的，而非disowned
  disowned: boolean;
  favorited_time?: string;
  taglist: EHTagListItem[]; // 只显示你关注的标签
}

export interface EHListCompactItem extends EHItemBase {
  type: "compact";
  uploader?: string;  // 上传者，在收藏页是直接不显示的，而非disowned
  disowned: boolean;
  favorited_time?: string;
  taglist: EHTagListItem[]; // 会显示你关注的标签，和一些其他标签但是不全
}

export interface EHListExtendedItem extends EHItemBase {
  type: "extended";
  uploader?: string;
  disowned: boolean;
  favorited_time?: string;
  taglist: EHTagListItem[];
}

export interface EHListThumbnailItem extends EHItemBase {
  type: "thumbnail";
  // uploader?: string; // ThumbnailItem不显示uploader
  disowned: boolean; // ThumbnailItem不显示disowned，为保持兼容其值为false
  // favorited_time?: string; // ThumbnailItem不显示favorited_time
  taglist: EHTagListItem[]; // 只会显示你关注的标签
}

export interface EHGallery {
  gid: number;
  token: string;
  apiuid: number;
  apikey: string;
  archiver_or: string; // 用于打开归档页面的参数
  english_title: string;
  japanese_title: string;
  thumbnail_url: string;
  category: EHCategory;
  uploader?: string;
  disowned: boolean;
  posted_time: string;
  parent_gid?: number;
  parent_token?: string;
  visible: boolean;
  invisible_cause?: "expunged" | "replaced" | "private" | "unknown";
  language: string;
  translated: boolean;
  rewrited: boolean;
  file_size: string;
  length: number;
  rating_count: number;
  average_rating: number;
  display_rating: number;
  is_my_rating: boolean;
  favorite_count: number;
  favorited: boolean;
  favcat?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
  favcat_title?: string;

  taglist: EHTagListItem[];
  newer_versions: {
    url: string;
    title: string;
    posted_time: string;
  }[];
  thumbnail_size: "normal" | "large";
  total_pages: number;
  current_page: number; // 从0开始
  num_of_images_on_each_page?: number; // large有4种可能：20、50、100、200；normal有4种可能：40、100、200、400，如果只有一页则没有这个字段
  images: Record<number, {
    page: number; // 从1开始
    name: string;
    page_url: string;
    thumbnail_url: string;
  }[]>;
  comments: {
    posted_time: string;
    comment_div: string;
    commenter?: string;
    comment_id?: number;
    is_uploader: boolean;
    score?: number;
    votes?: {
      base: number;
      voters: {
        voter: string;
        score: number;
      }[];
      remaining_voter_count: number;
    };
    is_my_comment?: boolean;
    voteable?: boolean;
    my_vote?: 1 | -1;
  }[];
}

export interface EHTagListItem {
  namespace: TagNamespace;
  tags: string[];
}

export interface EHMPV {
  gid: number;
  token: string;
  mpvkey: string;
  length: number;
  images: {
    page: number;
    key: string;
    name: string;
    thumbnail_url: string;
  }[];
}

export interface EHPage {
  imageUrl: string;
  size: {
    width: number;
    height: number;
  };
  fileSize: string;
  fullSizeUrl: string;
  fullSize: {
    width: number;
    height: number;
  };
  fullFileSize: string;
  reloadKey: string;
}

export interface EHFavoriteInfo {
  favcat_titles: string[];
  favorited: boolean;
  selected_favcat: number;
  favnote: string;
  num_of_favnote_slots: number;
  num_of_favnote_slots_used: number;
}

export interface EHArchive {
  gid: number;
  token: string;
  or: string;
  download_options: {
    solution: string;
    size: string;
    price: string;
  }[]
}

export interface EHGalleryTorrent {
  title: string;
  url: string;
  posted_time: string;
  size: string;
  seeds: number;
  peers: number;
  downloads: number;
  uploader: string;
}

export interface EHMyTags {
  tagset: number;
  apiuid: number;
  apikey: string;
  tagset_name: string;
  tagset_color: string;
  enabled: boolean;
  tagsets: {
    value: number;
    name: string;
  }[];
  tags: {
    tagid: number;
    namespace: TagNamespace;
    name: string;
    watched: boolean;
    hidden: boolean;
    color?: string;
    weight: number;
  }[]
}

export interface EHSearchTerm {
  namespace?: TagNamespace;
  qualifier?: EHQualifier; // 可用于以下修饰词：tag, weak, title, uploader, uploaduid, gid, comment, favnote
  // 其中weak是特殊的，可以和namespace一起使用，其他的不能和namespace一起使用
  term: string; // 搜索的关键词
  dollar: boolean; // $ 表示精确搜索，如果没有这个符号，则会搜索以此term开头的所有tag
  subtract: boolean; // - 表示排除。
  tilde: boolean; // ~ 表示或。与其他~符号的term之间是或的关系
}

export interface EHSearchOptions {
  searchTerms?: EHSearchTerm[]
  filteredCategories?: EHSearchedCategory[];
  browseExpungedGalleries?: boolean;
  requireGalleryTorrent?: boolean;
  minimumPages?: number;
  maximumPages?: number;
  minimumRating?: number;
  disableLanguageFilters?: boolean;
  disableUploaderFilters?: boolean;
  disableTagFilters?: boolean;
  range?: number; // 范围是1-99的整数，它和下面的搜索参数都不兼容
  minimumGid?: number; // 对应搜索参数prev，从表现来看就是往前翻页
  maximumGid?: number; // 对应搜索参数next，从表现来看就是往后翻页
  jump?: {
    value: number;
    unit: "d" | "w" | "m" | "y";
  }; // 必须和prev或next一起使用，基点是prev或next的图库的日期
  seek?: string; // 2024-03-04
}

export interface EHPopularSearchOptions {
  disableLanguageFilters?: boolean;
  disableUploaderFilters?: boolean;
  disableTagFilters?: boolean;
}

export interface EHFavoriteSearchOptions {
  searchTerms?: EHSearchTerm[]
  favcat?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
  range?: number; // 范围是1-99的整数，它和下面的搜索参数都不兼容
  minimumGid?: number; // 对应搜索参数prev，从表现来看就是往前翻页
  maximumGid?: number; // 对应搜索参数next，从表现来看就是往后翻页
  jump?: {
    value: number;
    unit: "d" | "w" | "m" | "y";
  }; // 如果和prev或next一起使用，基点是prev或next的图库的日期
  seek?: string; // 2024-03-04
}

export interface EHTopListSearchOptions {
  timeRange: "yesterday" | "past_month" | "past_year" | "all";
  page?: number;
}

export interface EHSearchParams {
  f_cats?: number;
  f_search?: string;
  // advsearch?: 1; advsearch的实际作用是显示高级搜索的选项，因此这里不需要
  f_sh?: "on"; // Browse Expunged Galleries
  f_sto?: "on"; // Require Gallery Torrent
  f_spf?: number; // Minimum Pages
  f_spt?: number; // Maximum Pages
  f_srdd?: number; // Minimum Rating
  f_sfl?: "on"; // Disable custom filters for: Language
  f_sfu?: "on"; // Disable custom filters for: Uploader
  f_sft?: "on"; // Disable custom filters for: Tags
  range?: number // range 1-99
  prev?: number; // gid must be greater than prev
  next?: number; // gid must be smaller than next
  jump?: string; // 1d 1w 1m 1y
  seek?: string; // 2024-03-04
}

export interface EHFavoriteSearchParams {
  f_search?: string;
  favcat?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
  range?: number // range 1-99
  prev?: number; // gid must be greater than prev
  next?: number; // gid must be smaller than next
  jump?: string; // 1d 1w 1m 1y
  seek?: string; // 2024-03-04
}
