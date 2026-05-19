import Image from "next/image";

import { FixedThemeToggle } from "@/components/fixed-theme-toggle";
import { cn } from "@/lib/utils";

const AUTH_HERO_IMAGE =
  "https://images.pexels.com/photos/34254270/pexels-photo-34254270.jpeg";

export function AuthPageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen flex-1 grid-cols-1 bg-background lg:grid-cols-2">
      <div className="relative order-1 flex flex-col justify-center px-6 py-12 sm:px-10 lg:order-1 lg:px-16 xl:px-24">
        <a
          href="#auth-main"
          className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-4 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-foreground focus:shadow-lg focus:ring-2 focus:ring-[#0A4266] focus:ring-offset-2 focus:outline-none dark:focus:ring-[#7AB8D9]"
        >
          Skip to main content
        </a>
        <FixedThemeToggle fixed={false} />
        <main id="auth-main" className="w-full" tabIndex={-1}>
          {children}
        </main>
      </div>
      <div
        className={cn(
          "relative order-2 min-h-56 w-full sm:min-h-72 lg:order-2 lg:min-h-screen",
          "dark:after:pointer-events-none dark:after:absolute dark:after:inset-0 dark:after:z-[1] dark:after:bg-black/35 dark:after:content-['']"
        )}
        aria-hidden
      >
        <Image
          src={AUTH_HERO_IMAGE}
          alt=""
          fill
          priority
          className="object-cover object-center"
          sizes="(max-width: 1024px) 100vw, 50vw"
        />
      </div>
    </div>
  );
}
