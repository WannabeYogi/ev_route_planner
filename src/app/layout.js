import './globals.css';

import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'Smart EV - Electric Vehicle Route Planner',
  description: 'Plan your electric vehicle journey with Smart EV. Find optimal routes with charging stations along the way.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
