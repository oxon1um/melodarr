type ReleaseLike = {
  title: string;
  releaseDate?: string;
  secondaryTypes?: string[];
  releaseStatuses?: string[];
};

export type ReleaseSort = "newest" | "oldest" | "az" | "za";

export const RELEASE_SORT_OPTIONS: Array<{ value: ReleaseSort; label: string }> = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "az", label: "Alphabetical A-Z" },
  { value: "za", label: "Alphabetical Z-A" }
];

const normalizeText = (value?: string | null) => value?.trim().toLowerCase() ?? "";

const getReleaseTimestamp = (releaseDate?: string) => {
  if (!releaseDate) {
    return Number.NaN;
  }

  const timestamp = Date.parse(releaseDate);
  return Number.isFinite(timestamp) ? timestamp : Number.NaN;
};

const compareByTitle = (left: string, right: string) =>
  left.localeCompare(right, undefined, { sensitivity: "base", numeric: true });

const noisySinglePattern =
  /\b(remix|mix|edit|radio|demo|promo|promotional|interview|dub|club|version|acoustic|instrumental|live)\b/i;

export const sortReleases = <T extends ReleaseLike>(releases: T[], sort: ReleaseSort): T[] => {
  return [...releases].sort((left, right) => {
    const leftTimestamp = getReleaseTimestamp(left.releaseDate);
    const rightTimestamp = getReleaseTimestamp(right.releaseDate);
    const leftHasDate = Number.isFinite(leftTimestamp);
    const rightHasDate = Number.isFinite(rightTimestamp);

    if (sort === "newest" || sort === "oldest") {
      if (leftHasDate && rightHasDate && leftTimestamp !== rightTimestamp) {
        return sort === "newest" ? rightTimestamp - leftTimestamp : leftTimestamp - rightTimestamp;
      }

      if (leftHasDate !== rightHasDate) {
        return leftHasDate ? -1 : 1;
      }
    }

    const titleComparison = compareByTitle(left.title, right.title);
    if (titleComparison !== 0) {
      return sort === "za" ? -titleComparison : titleComparison;
    }

    return 0;
  });
};

export const isNoisySingle = (release: ReleaseLike): boolean => {
  const secondaryTypes = (release.secondaryTypes ?? []).map((value) => normalizeText(value));
  const releaseStatuses = (release.releaseStatuses ?? []).map((value) => normalizeText(value));
  const normalizedTitle = normalizeText(release.title);

  if (secondaryTypes.some((value) => ["remix", "live", "demo", "dj mix", "mixtape/street"].includes(value))) {
    return true;
  }

  if (releaseStatuses.includes("promotion")) {
    return true;
  }

  return noisySinglePattern.test(normalizedTitle);
};

export const filterNoisySingles = <T extends ReleaseLike>(releases: T[], hideNoisySingles: boolean): T[] =>
  hideNoisySingles ? releases.filter((release) => !isNoisySingle(release)) : releases;
