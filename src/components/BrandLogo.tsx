import Image from "next/image";
import { SITE } from "@/config/site";

const ASPECT_RATIO = 938 / 358;

export default function BrandLogo({
  height = 36,
  className,
}: {
  height?: number;
  className?: string;
}) {
  // Otra marca (demo, otros clientes): sin su logo, se muestra el nombre como wordmark.
  if (SITE.brand !== "ShopUSA") {
    return (
      <span
        className={className}
        style={{ fontSize: Math.round(height * 0.62), fontWeight: 700, letterSpacing: "-0.02em", color: "var(--color-ink)", lineHeight: 1, whiteSpace: "nowrap" }}
      >
        {SITE.brand}
      </span>
    );
  }
  return (
    <Image
      src="/brand/logo.png"
      alt="ShopUSA Envíos"
      width={Math.round(height * ASPECT_RATIO)}
      height={height}
      className={className}
      priority
    />
  );
}
