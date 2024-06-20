export type TagNamespace = "artist" | "character" | "cosplayer" | "female"
  | "group" | "language" | "male" | "mixed" | "other" | "parody" | "reclass"

export type EHQualifier = "tag" | "weak" | "title" | "uploader" | "uploaduid" | "gid" | "comment" | "favnote"

export type EHCategory = "Doujinshi" | "Manga" | "Artist CG" | "Game CG" | "Western"
  | "Non-H" | "Image Set" | "Cosplay" | "Asian Porn" | "Misc"

export interface EHFrontPageList {
  type: "front_page";
  prev_page_available: boolean;
  next_page_available: boolean;
  total_item_count: number;
  items: EHListItem[];
}

export interface EHWatchedList {
  type: "watched";
  prev_page_available: boolean;
  next_page_available: boolean;
  items: EHListItem[];
}

export interface EHPopularList {
  type: "popular";
  items: EHListItem[];
}

export interface EHFavoritesList {
  type: "favorites";
  prev_page_available: boolean;
  next_page_available: boolean;
  sort_order: "favorited_time" | "published_time";
  items: EHListItem[];
  favcat_infos: {
    count: number;
    title: string;
  }[];
}

export interface EHListItem {
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
  uploader?: string;
  length: number;
  torrent_available: boolean;
  favorited: boolean;
  favcat?: number;
  favcat_title?: string;
  favoritd_time?: string;
  taglist: EHTagListItem[];
}

export interface EHGallery {
  gid: number;
  token: string;
  apiuid: number;
  apikey: string;
  archiver_or: string;
  english_title: string;
  japanese_title: string;
  thumbnail_url: string;
  category: EHCategory;
  uploader?: string;
  posted_time: string;
  parent_url?: string;
  visible: boolean;
  language: string;
  translated: boolean;
  file_size: string;
  length: number;
  rating_count: number;
  average_rating: number;
  display_rating: number;
  is_my_rating: boolean;
  favorite_count: number;
  favorited: boolean;
  favcat?: number;
  favcat_title?: string;

  taglist: EHTagListItem[];
  newer_versions: EHGalleryNewerVersion[];
  thumbnail_size: "normal" | "large";
  images: EHGalleryImageItem[];
  comments: EHGalleryCommentItem[];
}

export interface EHTagListItem {
  namespace: TagNamespace;
  tags: string[];
}

export interface EHGalleryNewerVersion {
  url: string;
  title: string;
  posted_time: string;
}

export interface EHGalleryImageItem {
  page: number;
  name: string;
  page_url: string;
  thumbnail_url: string;
}

export interface EHGalleryCommentItem {
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
  my_vote?: number;
}

export interface EHMPV {
  gid: number;
  token: string;
  mpvkey: string;
  length: number;
  images: EHMPVImageItem[];
}

export interface EHMPVImageItem {
  key: string;
  name: string;
  thumbnail_url: string;
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

export interface SearchOptions {
  searchTerms?: {
    namespace?: TagNamespace | EHQualifier;
    term: string;
    exact: boolean;
    exclude: boolean;
    or: boolean;
  }[]
  filteredCategories?: EHCategory[];
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
  seek?: Date; // 必须和prev或next一起使用
}

export interface FavoriteSearchOptions {
  searchTerms?: {
    namespace?: TagNamespace | EHQualifier;
    term: string;
    exact: boolean;
    exclude: boolean;
    or: boolean;
  }[]
  favcat?: number;
  range?: number; // 范围是1-99的整数，它和下面的搜索参数都不兼容
  minimumGid?: number; // 对应搜索参数prev，从表现来看就是往前翻页
  maximumGid?: number; // 对应搜索参数next，从表现来看就是往后翻页
  jump?: {
    value: number;
    unit: "d" | "w" | "m" | "y";
  }; // 必须和prev或next一起使用，基点是prev或next的图库的日期
  seek?: Date; // 必须和prev或next一起使用
}

export interface SearchParams {
  f_cats?: number;
  f_search?: string;
  advsearch?: 1;
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

export interface FavoriteSearchParams {
  f_search?: string;
  favcat?: number;
  range?: number // range 1-99
  prev?: number; // gid must be greater than prev
  next?: number; // gid must be smaller than next
  jump?: string; // 1d 1w 1m 1y
  seek?: string; // 2024-03-04
}
