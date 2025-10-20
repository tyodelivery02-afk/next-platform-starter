import Image from 'next/image';
import Link from 'next/link';
import netlifyLogo from 'public/images/tachikoma/tachikoma.png';

const navItems = [
    { linkText: 'Home', href: '/' , color: 'bg-green-500' },
];

export function Header() {
    return (
        <nav className="flex flex-wrap items-center gap-4 pt-2 pb-4 sm:pt-4 md:pb-6">
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
        </nav>
    );
}
