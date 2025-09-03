import './globals.css';

import AuthProvider from './providers/AuthProvider';
import { GoogleMapsProvider } from './utils/GoogleMapsLoader';
import { Inter } from 'next/font/google';

const inter = Inter({ 
  subsets: ['latin'],
  display: 'swap'
});

export const metadata = {
  title: 'Smart EV - Electric Vehicle Route Planner',
  description: 'Plan your electric vehicle journey with Smart EV. Find optimal routes with charging stations along the way.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        {/* Preload Google Maps resources */}
        <link rel="preconnect" href="https://maps.googleapis.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://maps.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className={inter.className}>
        <AuthProvider>
          <GoogleMapsProvider>{children}</GoogleMapsProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
