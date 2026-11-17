import "./globals.css";
import { Toaster } from "sonner";
import { LocaleProvider } from "./i18n-provider";

export const metadata = {
  title: "Roveko · CKB Markets",
  description: "Inspect and manage CKB-backed claim markets on Pudge testnet.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <LocaleProvider>
          {children}
          <Toaster position="bottom-right" theme="dark" richColors />
        </LocaleProvider>
      </body>
    </html>
  );
}
