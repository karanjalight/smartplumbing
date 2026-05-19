"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";
import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Marketing motion primitives.
 *
 * Goals:
 *   - Subtle, premium reveal animations (no bouncing, no parallax abuse).
 *   - Respect `prefers-reduced-motion` (WCAG 2.3.3).
 *   - Reusable variants for staggered children.
 */

const SPRING = { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const };

export const fadeUpVariants: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: SPRING },
};

export const fadeInVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.6, ease: "easeOut" } },
};

export const staggerContainer = (delay = 0.08, stagger = 0.08): Variants => ({
  hidden: {},
  visible: {
    transition: { staggerChildren: stagger, delayChildren: delay },
  },
});

type FadeUpProps = React.HTMLAttributes<HTMLDivElement> & {
  as?: "div" | "section" | "header" | "article" | "li";
  delay?: number;
  once?: boolean;
  amount?: number;
};

/** Single element fade-up that animates when it enters the viewport. */
export function FadeUp({
  as = "div",
  delay = 0,
  once = true,
  amount = 0.25,
  className,
  children,
  ...rest
}: FadeUpProps) {
  const prefersReduced = useReducedMotion();
  const MotionTag = motion[as] as typeof motion.div;

  if (prefersReduced) {
    const Tag = as as React.ElementType;
    return (
      <Tag className={className} {...rest}>
        {children}
      </Tag>
    );
  }

  return (
    <MotionTag
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once, amount }}
      variants={fadeUpVariants}
      transition={{ ...SPRING, delay }}
      {...(rest as React.ComponentProps<typeof motion.div>)}
    >
      {children}
    </MotionTag>
  );
}

type StaggerGroupProps = React.HTMLAttributes<HTMLDivElement> & {
  as?: "div" | "ul" | "ol" | "section";
  delay?: number;
  stagger?: number;
  once?: boolean;
  amount?: number;
};

/** Container that staggers any direct `<FadeChild>` children. */
export function StaggerGroup({
  as = "div",
  delay = 0.05,
  stagger = 0.08,
  once = true,
  amount = 0.2,
  className,
  children,
  ...rest
}: StaggerGroupProps) {
  const prefersReduced = useReducedMotion();
  const MotionTag = motion[as] as typeof motion.div;

  if (prefersReduced) {
    const Tag = as as React.ElementType;
    return (
      <Tag className={className} {...rest}>
        {children}
      </Tag>
    );
  }

  return (
    <MotionTag
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once, amount }}
      variants={staggerContainer(delay, stagger)}
      {...(rest as React.ComponentProps<typeof motion.div>)}
    >
      {children}
    </MotionTag>
  );
}

type FadeChildProps = React.HTMLAttributes<HTMLDivElement> & {
  as?: "div" | "li" | "article" | "section";
};

/** Direct child of `<StaggerGroup>`. Inherits parent's stagger timing. */
export function FadeChild({
  as = "div",
  className,
  children,
  ...rest
}: FadeChildProps) {
  const prefersReduced = useReducedMotion();
  const MotionTag = motion[as] as typeof motion.div;

  if (prefersReduced) {
    const Tag = as as React.ElementType;
    return (
      <Tag className={className} {...rest}>
        {children}
      </Tag>
    );
  }

  return (
    <MotionTag
      className={className}
      variants={fadeUpVariants}
      {...(rest as React.ComponentProps<typeof motion.div>)}
    >
      {children}
    </MotionTag>
  );
}

/**
 * Floating element that gently drifts on the Y axis. Used for the hero's
 * floating analytic cards. Disabled under `prefers-reduced-motion`.
 */
export function Floating({
  children,
  className,
  delay = 0,
  range = 8,
  duration = 5,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  range?: number;
  duration?: number;
}) {
  const prefersReduced = useReducedMotion();

  if (prefersReduced) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={cn(className)}
      animate={{ y: [0, -range, 0] }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    >
      {children}
    </motion.div>
  );
}
