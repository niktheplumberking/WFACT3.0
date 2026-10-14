/**
 * One media slot (track-b-starter 1.5.0, Build-quality Package 3). With an image the owner supplied (content/media.json,
 * verified by the build): a sized, lazy, layout-stable picture that settles in gently. Without one: a branded placeholder
 * card in the brand's own tints, its aspect reserved, a quiet corner mark and the visible words "Image to come: <note>",
 * marked data-placeholder so the launch check and the Cockpit can list it. Never an external placeholder service.
 */
import { imageForSlot, type Media } from "@/lib/content";

const ratio = (a: Media["aspect"]) => a.replace(":", " / ");

export function MediaFrame({ media, slot, className = "", priority = false }: { media: Media; slot: string; className?: string; priority?: boolean }) {
  const img = imageForSlot(slot);
  if (img) {
    return (
      <figure className={`media ${className}`} style={{ aspectRatio: ratio(media.aspect) }} data-reveal="media">
        {/* A plain <img>: a static export has no image server; width/height reserve the space. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={img.src} alt={media.alt} width={img.width} height={img.height} loading={priority ? "eager" : "lazy"} decoding="async" {...(priority ? { fetchPriority: "high" as const } : {})} />
      </figure>
    );
  }
  return (
    <figure className={`media media-placeholder ${className}`} style={{ aspectRatio: ratio(media.aspect) }} data-placeholder={slot} data-reveal="media" role="img" aria-label={`Image to come: ${media.note}`}>
      <span className="media-mark" aria-hidden="true" />
      <figcaption>
        <span className="media-label">Image to come</span>
        <span className="media-note">{media.note}</span>
      </figcaption>
    </figure>
  );
}
