"use client";

import { motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import { useEffect, useState } from "react";

import type { MarketingImage } from "@/lib/marketing-images";
import { cn } from "@/lib/utils";

/**
 * Full-bleed background carousel for the hero: crossfades between images with a
 * slow Ken Burns zoom, auto-advances, and honours prefers-reduced-motion (holds
 * on the first frame, no zoom). Indicators let visitors jump between frames.
 */
export function HeroCarousel({
  images,
  intervalMs = 6500,
}: {
  images: MarketingImage[];
  intervalMs?: number;
}) {
  const [active, setActive] = useState(0);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (reduce || images.length <= 1) return;
    const timer = setInterval(
      () => setActive((a) => (a + 1) % images.length),
      intervalMs
    );
    return () => clearInterval(timer);
  }, [images.length, intervalMs, reduce]);

  return (
    <>
      <div className="absolute inset-0 -z-10 overflow-hidden bg-[#04141f]">
        {images.map((img, i) => {
          const isActive = i === active;
          return (
            <motion.div
              key={img.src}
              className="absolute inset-0"
              initial={false}
              animate={{ opacity: isActive ? 1 : 0 }}
              transition={{ duration: 1.2, ease: "easeInOut" }}
              aria-hidden={!isActive}
            >
              <motion.div
                className="absolute inset-0"
                initial={false}
                animate={{ scale: reduce ? 1.06 : isActive ? 1.14 : 1.04 }}
                transition={{
                  duration: reduce ? 0 : intervalMs / 1000 + 1.2,
                  ease: "linear",
                }}
              >
                <Image
                  src={img.src}
                  alt={img.alt}
                  fill
                  priority={i === 0}
                  sizes="100vw"
                  className="object-cover object-center"
                />
              </motion.div>
            </motion.div>
          );
        })}
      </div>

      <div
        className="absolute bottom-6 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 lg:bottom-8"
        role="tablist"
        aria-label="Hero image"
      >
        {images.map((img, i) => (
          <button
            key={img.src}
            type="button"
            role="tab"
            aria-selected={i === active}
            aria-label={`Show image ${i + 1} of ${images.length}`}
            onClick={() => setActive(i)}
            className="group py-2"
          >
            <span
              className={cn(
                "block h-1.5 rounded-full transition-all duration-300",
                i === active
                  ? "w-9 bg-white"
                  : "w-4 bg-white/40 group-hover:bg-white/70"
              )}
            />
          </button>
        ))}
      </div>
    </>
  );
}
