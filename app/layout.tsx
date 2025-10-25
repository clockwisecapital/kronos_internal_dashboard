import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import Header from "@/components/layout/Header"
import TabNavigation from "@/components/layout/TabNavigation"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
})

export const metadata: Metadata = {
  title: "Clockwise Capital Dashboard",
  description: "Internal investment tracking and analytics dashboard",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`dark ${inter.variable}`}>
      <body className="min-h-screen bg-slate-900 text-white font-sans antialiased">
        <div className="flex flex-col h-screen bg-slate-900">
          <Header />
          <TabNavigation />
          <main className="flex-1 overflow-y-auto bg-slate-900">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}