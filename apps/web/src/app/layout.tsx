import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'TakePicker — AI Retake Detection & Parallel Video Render Engine',
  description: 'Ingest raw talking-head footage, cluster repeated takes, pick the best delivery, and fan-out render a clean cut.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
