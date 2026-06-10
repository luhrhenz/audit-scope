import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import Providers from "@/components/Providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AuditScope — Smart Contract Audit Scoping Tool",
  description: "Paste a Solidity contract and get a structured security audit scope report instantly.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>

        {/* Pendo agent — Novus analytics */}
        <Script id="pendo-agent" strategy="afterInteractive">{`
          (function(apiKey){
            (function(p,e,n,d,o){var v,w,x,y,z;o=p[d]=p[d]||{};o._q=o._q||[];
            v=['initialize','identify','updateOptions','pageLoad','track'];
            for(w=0,x=v.length;w<x;++w)(function(m){
              o[m]=o[m]||function(){o._q[m===v[0]?'unshift':'push']([m].concat([].slice.call(arguments,0)));};})(v[w]);
            y=e.createElement(n);y.async=!0;
            y.src='https://cdn.pendo.io/agent/static/'+apiKey+'/pendo.js';
            z=e.getElementsByTagName(n)[0];z.parentNode.insertBefore(y,z);
            })(window,document,'script','pendo');

            var vid;
            try {
              vid = localStorage.getItem('_as_vid');
              if (!vid) {
                vid = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
                localStorage.setItem('_as_vid', vid);
              }
            } catch(e) {
              vid = 'anon-' + Math.random().toString(36).slice(2);
            }

            pendo.initialize({
              visitor: { id: vid },
              account: { id: 'auditscope' }
            });
          })('b7070f3b-1ab5-40a3-bf3a-f1d2084da594');
        `}</Script>
      </body>
    </html>
  );
}
