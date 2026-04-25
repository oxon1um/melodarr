import type { ReactNode } from "react";
import Image from "next/image";

export const isSignedProxyImageSrc = (src: string): boolean => src.startsWith("/api/image?");

type Props = {
  alt: string;
  src?: string;
  sizes: string;
  className?: string;
  imageClassName?: string;
  fallback?: ReactNode;
  priority?: boolean;
};

export function CoverImage({
  alt,
  src,
  sizes,
  className,
  imageClassName,
  fallback,
  priority = false
}: Props) {
  const isSignedProxyImage = src ? isSignedProxyImageSrc(src) : false;

  return (
    <div className={className}>
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          priority={priority}
          sizes={sizes}
          unoptimized={isSignedProxyImage}
          className={imageClassName ?? "object-cover"}
        />
      ) : (
        fallback ?? <div className="flex h-full items-center justify-center text-xs text-muted">No cover</div>
      )}
    </div>
  );
}
