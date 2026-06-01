import type React from "react"
import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { Analytics } from "@vercel/analytics/next"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { LanguageProvider } from "@/contexts/language-context"
import { Suspense } from "react"
import "./globals.css"

export const metadata: Metadata = {
  title: "织彩 TexColor | 服装数字化柔性定制与 2D 智能试衣间",
  description:
    "织彩 (TexColor) 服装数字化柔性定制系统深度整合前端 2D 试衣看板与后端智能制造工序。支持 4 种经典款式与 17 种高精度数字化扫描面料拼装，实时 2D 拟真穿着效果预览，极速打样与配送。",
  generator: "v0.app",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh">
      <body className={`font-sans ${GeistSans.variable} ${GeistMono.variable} antialiased`}>
        <LanguageProvider>
          <div className="min-h-screen flex flex-col">
            <Suspense fallback={<div>Loading...</div>}>
              <Navbar />
            </Suspense>
            <main className="flex-1">{children}</main>
            <Suspense fallback={<div>Loading...</div>}>
              <Footer />
            </Suspense>
          </div>
        </LanguageProvider>
        <Analytics />
      </body>
    </html>
  )
}
