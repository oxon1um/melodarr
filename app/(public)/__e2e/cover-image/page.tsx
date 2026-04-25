import { CoverImage } from "@/components/ui/cover-image";
import { buildSignedImageUrl } from "@/lib/images";

const DEFAULT_IMAGE_ORIGIN = "http://127.0.0.1:45731";
const LONG_REMOTE_IMAGE_PATH = "/cache/https://coverartarchive.org/release/fc4ca5a7-ac12-4a30-92db-6c44c971349a/42537485144-1200.jpg";

const getSmokeImageSource = async (): Promise<string | undefined> => {
  const imageOrigin = process.env.LIDARR_URL ?? DEFAULT_IMAGE_ORIGIN;
  return buildSignedImageUrl(`${imageOrigin}${LONG_REMOTE_IMAGE_PATH}`);
};

export default async function CoverImageSmokePage() {
  const imageSrc = await getSmokeImageSource();

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-text">Cover image smoke test</h1>
        <p className="text-sm text-muted">Uses the real CoverImage component with a signed proxy URL.</p>
      </div>

      <div className="relative h-64 w-64 overflow-hidden rounded-3xl border border-[var(--edge)] bg-panel">
        <CoverImage
          alt="Smoke test cover"
          src={imageSrc}
          sizes="16rem"
          className="h-full w-full"
          imageClassName="object-cover"
        />
      </div>
    </section>
  );
}
