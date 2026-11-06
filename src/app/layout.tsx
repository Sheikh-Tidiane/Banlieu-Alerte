import type { Metadata, Viewport } from 'next';
import { Inter, Poppins } from 'next/font/google';
import { ServiceWorkerRegistration } from '@/components/offline/service-worker';
import { ToastProvider } from '@/components/ui/toast';
import { translate } from '@/i18n';
import './globals.css';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-poppins',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: translate('app.name'),
    template: `%s · ${translate('app.name')}`,
  },
  description: translate('app.description'),
  manifest: '/manifest.webmanifest',
  metadataBase: new URL(process.env.APP_URL ?? 'http://localhost:3000'),
  icons: {
    icon: [
      { url: '/brand/favicon.svg', type: 'image/svg+xml' },
      { url: '/brand/favicon.ico', sizes: '16x16 32x32 48x48' },
    ],
    apple: { url: '/brand/apple-touch-icon.png', sizes: '180x180' },
  },
  openGraph: {
    type: 'website',
    locale: 'fr_SN',
    siteName: translate('app.name'),
    images: [{ url: '/brand/og-image.png', width: 1200, height: 630, alt: translate('app.name') }],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Les métadonnées n'acceptent pas de variable CSS : valeur de --brand-green (globals.css).
  // eslint-disable-next-line no-restricted-syntax
  themeColor: '#1b5e20',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" className={`${poppins.variable} ${inter.variable}`}>
      <body className="min-h-dvh antialiased">
        <ToastProvider>{children}</ToastProvider>
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
