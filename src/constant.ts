import { EHQualifier, TagNamespace, TagNamespaceAlternate } from "./types";

export const tagNamespaces: TagNamespace[] = [
  "artist",
  "character",
  "cosplayer",
  "female",
  "group",
  "language",
  "location",
  "male",
  "mixed",
  "other",
  "parody",
  "reclass",
  "temp",
];

export const tagNamespaceAlternates: TagNamespaceAlternate[] = [
  "a",
  "c",
  "cos",
  "f",
  "g",
  "l",
  "loc",
  "m",
  "x",
  "o",
  "p",
  "r",
  "char",
  "circle",
  "lang",
  "series",
  "temp",
];

export const tagNamespaceMostUsedAlternateMap: Record<
  TagNamespace,
  TagNamespaceAlternate
> = {
  artist: "a",
  character: "c",
  cosplayer: "cos",
  female: "f",
  group: "g",
  language: "l",
  location: "loc",
  male: "m",
  mixed: "x",
  other: "o",
  parody: "p",
  reclass: "r",
  temp: "temp",
};

export const tagNamespaceAlternateMap: Record<
  TagNamespaceAlternate,
  TagNamespace
> = {
  a: "artist",
  c: "character",
  cos: "cosplayer",
  f: "female",
  g: "group",
  l: "language",
  loc: "location",
  m: "male",
  x: "mixed",
  o: "other",
  p: "parody",
  r: "reclass",
  char: "character",
  circle: "group",
  lang: "language",
  series: "parody",
  temp: "temp",
};

export const ehQualifiers: EHQualifier[] = [
  "tag",
  "weak",
  "title",
  "uploader",
  "uploaduid",
  "gid",
  "comment",
  "favnote",
];
