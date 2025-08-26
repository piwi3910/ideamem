import './globals.css';
import DashboardLayout from '@/components/DashboardLayout';
import { QueryProvider } from '@/providers/QueryProvider';

// Auto-initialize workers on app startup
import '@/lib/startup';

export const metadata = {
  title: 'IdeaMem - Semantic Memory System',
  description: 'Intelligent code and documentation indexing with vector search',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon-16.svg', type: 'image/svg+xml', sizes: '16x16' },
    ],
    apple: { url: '/apple-touch-icon.svg', type: 'image/svg+xml' },
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 antialiased">
        <QueryProvider>
          <DashboardLayout>
            {children}
          </DashboardLayout>
        </QueryProvider>
      </body>
    </html>
  );
}
