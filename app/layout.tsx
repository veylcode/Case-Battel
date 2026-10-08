import type { Metadata } from "next";
import "./globals.css";
import { LanguageProvider } from "./ui/language";

export const metadata: Metadata = {
  title: "CASE BATTLE • Кейсы, апгрейды и контракты",
  description:
    "Открывай кейсы, собирай коллекцию и улучшай предметы в симуляторе CASE BATTLE.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className="antialiased"><LanguageProvider>{children}</LanguageProvider></body>
    </html>
  );
}
