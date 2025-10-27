import Image from 'next/image';
import Link from 'next/link';
import { House,Truck,CheckSquare } from "phosphor-react";

const navItems = [
    { icon: <House size={70} />, href: '/', color: 'text-black' ,laber:`HOME`},
    { icon: <CheckSquare size={70} />, href: '/taskCheckSheet', color: 'text-black'  ,laber:`TASK`},
    { icon: <Truck size={70} />, href: '/fcatmaker', color: 'text-black'  ,laber:`FCST`},
];

export function Header() {
    return (
        <nav className="flex flex-wrap items-center gap-4 pt-2 pb-4 sm:pt-4 md:pb-6 bg-gray-400">
            <Image
                src="/images/witch-flying.svg"
                alt='main'
                width={150}
                height={150}
                className="fly-animation"
                style={{ objectFit: "contain" }}
            />
            {!!navItems?.length && (
                <ul className="flex flex-wrap gap-x-4 gap-y-1">
                    {navItems.map((item, index) => (
                        <li key={index}>
                            <Link
                                href={item.href}
                                className={`flex flex-col items-center px-1.5 py-1 sm:px-3 sm:py-2 ${item.color || 'text-black'} hover:geay-80 no-underline`}
                            >
                                {item.icon}
                                <span>{item.laber}</span>
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
        </nav>
    );
}
