"use client";

import { CreditCard, Droplets, Home, MoveRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { BrandLogo } from "@/components/brand-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

type IntroSlide = {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
};

const CLIENT_INTRO_SLIDES: IntroSlide[] = [
  {
    title: "Manage water bills",
    description:
      "Track monthly usage, view your bill history, and stay ahead of due dates from one simple screen.",
    icon: Droplets,
  },
  {
    title: "Easy rent tracking and payment",
    description:
      "See rent status in real time and pay securely through M-Pesa without leaving the app.",
    icon: CreditCard,
  },
  {
    title: "Stay connected with your home",
    description:
      "Receive alerts, meter updates, and support messages so you are always in control of your utilities.",
    icon: Home,
  },
];

export function ClientIntroPager() {
  const router = useRouter();
  const [activeIndex, setActiveIndex] = useState(0);
  const isLastSlide = activeIndex === CLIENT_INTRO_SLIDES.length - 1;
  const activeSlide = CLIENT_INTRO_SLIDES[activeIndex];
  const ActiveIcon = activeSlide.icon;

  const handleNext = () => {
    if (isLastSlide) {
      router.push("/auth/login");
      return;
    }

    setActiveIndex((index) => Math.min(index + 1, CLIENT_INTRO_SLIDES.length - 1));
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-8 dark:bg-slate-950">
      <section className="relative w-full max-w-sm overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
        <div className="absolute top-0 right-0 h-36 w-36 rounded-full bg-[#2147f4]/15 blur-2xl" />
        <div className="absolute bottom-20 -left-8 h-32 w-32 rounded-full bg-[#0A4266]/10 blur-2xl" />

        <div className="relative z-10 flex min-h-[700px] flex-col px-6 py-7">
          <div className="flex items-center justify-between gap-2">
            <BrandLogo variant="compact" />
            <div className="flex items-center gap-2">
              <ThemeToggle className="size-9 min-h-9 min-w-9 rounded-full [&_svg]:size-4" />
              <Link
                href="/auth/login"
                className="text-xs font-medium text-muted-foreground underline decoration-2 underline-offset-3"
              >
                Skip
              </Link>
            </div>
          </div>

          <div className="mt-14 flex flex-1 flex-col">
            <div className="mx-auto flex h-44 w-44 items-center justify-center rounded-full bg-[#2147f4] text-white shadow-lg shadow-[#2147f4]/30">
              <ActiveIcon className="size-20" />
            </div>

            <div className="mt-12 text-center">
              <h1 className="text-2xl leading-tight font-semibold text-foreground">
                {activeSlide.title}
              </h1>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {activeSlide.description}
              </p>
            </div>
          </div>

          <div className="mt-8">
            <div className="mb-7 flex items-center justify-center gap-2.5">
              {CLIENT_INTRO_SLIDES.map((_, index) => (
                <span
                  key={index}
                  className={cn(
                    "h-2 rounded-full transition-all",
                    index === activeIndex ? "w-7 bg-[#2147f4]" : "w-2 bg-slate-300 dark:bg-slate-700"
                  )}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={handleNext}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#2147f4] px-6 text-sm font-semibold text-white transition hover:bg-[#1738cc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2147f4] focus-visible:ring-offset-2"
            >
              {isLastSlide ? "Continue to login" : "Next"}
              <MoveRight className="size-4" aria-hidden />
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
