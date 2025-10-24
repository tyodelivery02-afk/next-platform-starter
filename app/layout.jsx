// app/layout.jsx
import '../styles/globals.css';
import AuthWrapper from '../components/authWrapper';

export const metadata = {
  title: {
    template: '%s | Netlify',
    default: 'Netlify Starter',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="min-h-screen">
      <head>
        <link rel="icon" href="/favicon.svg" sizes="any" />
      </head>
      <body className="antialiased text-white">
        <div className="flex flex-col min-h-screen bg-transparent">
          <AuthWrapper>
            {/* AuthWrapper 内部会判断登录状态 */}
            {children}
          </AuthWrapper>
        </div>
      </body>
    </html>
  );
}
