import Image from "next/image";

interface LogoProps {
  variant?: "mark" | "full";
  size?: number;
  className?: string;
}

/** The official Galeyar logo — single source of truth so every screen (header, login, splash) stays in sync. */
export function Logo({ variant = "mark", size = 40, className }: LogoProps) {
  const src = variant === "full" ? "/brand/logo-full.png" : "/icons/icon-512.png";
  return (
    <Image
      src={src}
      alt="گله‌یار"
      width={size}
      height={size}
      className={className}
      priority
      unoptimized
    />
  );
}
