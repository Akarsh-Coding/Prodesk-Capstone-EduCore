import './globals.css';

export const metadata = {
  title: 'EduCore',
  description: 'Learning management system',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
