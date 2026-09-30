import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'The Four — Find Your Four',
  description: 'Find your Four. Create your Four. Share your Four. Watch THE FOUR.'
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
