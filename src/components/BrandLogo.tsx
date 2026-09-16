import Image from "next/image";

const ASPECT_RATIO = 938 / 358;

export default function BrandLogo({
  height = 36,
  className,
}: {
  height?: number;
  className?: string;
}) {
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
