export type ImageAsset = {
  coverType?: string;
  remoteUrl?: string;
  url?: string;
  optimizedUrl?: string;
};

const pickFirstMatchingImage = (
  images: ImageAsset[],
  preferredTypes: string[],
  key: keyof Pick<ImageAsset, "optimizedUrl" | "remoteUrl" | "url">
) => preferredTypes.map((type) => images.find((item) => item.coverType === type)?.[key]).find(Boolean);

export const pickPreferredImageUrl = (
  images: ImageAsset[] | undefined,
  preferredTypes: string[]
): string | undefined => {
  if (!images || images.length === 0) {
    return undefined;
  }

  return (
    pickFirstMatchingImage(images, preferredTypes, "optimizedUrl") ??
    pickFirstMatchingImage(images, preferredTypes, "remoteUrl") ??
    pickFirstMatchingImage(images, preferredTypes, "url") ??
    images[0]?.optimizedUrl ??
    images[0]?.remoteUrl ??
    images[0]?.url
  );
};
