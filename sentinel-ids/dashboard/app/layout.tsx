import "./globals.css";
import AuthGate from "@/components/AuthGate";
export const metadata = { title: "SentinelML SOC", description: "Real-time intrusion detection" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body><AuthGate>{children}</AuthGate></body></html>;
}
