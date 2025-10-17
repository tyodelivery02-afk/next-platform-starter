import Image from 'next/image';
import Link from 'next/link';
import netlifyLogo from 'public/netlify-logo.svg';
import githubLogo from 'public/images/github-mark-white.svg';

const navItems = [
    { linkText: 'Home', href: '/' , color: 'bg-green-500' },
/*     { linkText: 'Revalidation', href: '/revalidation' , color: 'bg-green-500' },
    { linkText: 'Image CDN', href: '/image-cdn' , color: 'bg-green-500' },
    { linkText: 'Edge Function', href: '/edge' , color: 'bg-green-500' },
    { linkText: 'Blobs', href: '/blobs' , color: 'bg-green-500' },
    { linkText: 'Classics', href: '/classics' , color: 'bg-green-500' } */
];

export function Header() {
    return (
        <nav className="flex flex-wrap items-center gap-4 pt-6 pb-12 sm:pt-12 md:pb-24">
            <Link href="/">
                <Image src={netlifyLogo} alt="Netlify logo" />
            </Link>
            {!!navItems?.length && (
                <ul className="flex flex-wrap gap-x-4 gap-y-1">
                    {navItems.map((item, index) => (
                        <li key={index}>
                            <Link href={item.href} className={`inline-flex px-1.5 py-1 sm:px-3 sm:py-2 ${item.color || 'text-black'} hover:opacity-80`}>
                                {item.linkText}
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
            <Link
                href="https://github.com/netlify-templates/next-platform-starter"
                target="_blank"
                rel="noopener noreferrer"
                className="hidden lg:inline-flex lg:ml-auto"
            >
                <Image src={githubLogo} alt="GitHub logo" className="w-7" />
            </Link>
        </nav>
    );
}
