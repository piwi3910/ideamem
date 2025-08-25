import './globals.css';
import DashboardLayout from '@/components/DashboardLayout';

export const metadata = {
  title: 'IdeaMem - Semantic Memory System',
  description: 'Intelligent code and documentation indexing with vector search',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 antialiased">
        <DashboardLayout>
          {children}
        </DashboardLayout>
      </body>
    </html>
  );
}
