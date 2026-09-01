import { AppTopbar } from "@/components/app-topbar";
import { appMetadata } from "@/lib/app-metadata";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata = appMetadata;

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ko">
      <body>
        <AppTopbar />
        {children}
      </body>
    </html>
  );
}
