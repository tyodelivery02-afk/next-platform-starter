import Image from 'next/image';
import Link from 'next/link';
import { House } from "phosphor-react";

const navItems = [
    { icon: <House size={90} />, href: '/', color: 'text-white' },
];

export function Header() {
    return (
        <nav className="flex flex-wrap items-center gap-4 pt-2 pb-4 sm:pt-4 md:pb-6 bg-gray-400">
            <Image
                src="/images/tachikoma/tachikoma.png"
                alt='main'
                width={200}
                height={200}
                style={{ objectFit: "contain" }}
            />
            {!!navItems?.length && (
                <ul className="flex flex-wrap gap-x-4 gap-y-1">
                    {navItems.map((item, index) => (
                        <li key={index}>
                            <Link
                                href={item.href}
                                className={`flex flex-col items-center px-1.5 py-1 sm:px-3 sm:py-2 ${item.color || 'text-black'} hover:opacity-80 no-underline`}
                            >
                                {item.icon}
                                <span className="mt-1 text-sm">HOME</span>
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
        </nav>
    );
}
