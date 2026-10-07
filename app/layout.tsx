import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Where Is My Money? | Collections Control",
  description: "Safe fictional accounts-receivable planning and delivery control.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
