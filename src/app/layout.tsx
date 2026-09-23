import "./globals.css"
import { AuthProvider } from "@/hooks/useAuth"

export const metadata = { 
  title: "Maintenance Hub - YFPO", 
  description: "Professional maintenance job card system",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1"
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#0a0a0a] text-zinc-100 min-h-screen antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}
