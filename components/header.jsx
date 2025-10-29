import Image from 'next/image';
import Link from 'next/link';
import { House, Calendar, CheckSquare,Pen,Headset,CurrencyJpy } from "phosphor-react";

const navItems = [
    { icon: <House size={70} />, href: '/', color: 'text-black', laber: `HOME` },
    { icon: <CheckSquare size={70} />, href: '/taskCheckSheet', color: 'text-black', laber: `TASK` },
    { icon: <Calendar size={70} />, href: '/fcatmaker', color: 'text-black', laber: `FCST作成` },
    {
        icon: <svg xmlns="http://www.w3.org/2000/svg" width="70" height="70" fill="#000000" viewBox="0 0 256 256">
            <path d="M88,224a16,16,0,1,1-16-16A16,16,0,0,1,88,224Zm128-16a16,16,0,1,0,16,16A16,16,0,0,0,216,208Zm24-32H56V75.31A15.86,15.86,0,0,0,51.31,64L29.66,42.34A8,8,0,0,0,18.34,53.66L40,75.31V176H32a8,8,0,0,0,0,16H240a8,8,0,0,0,0-16Z"></path></svg>
        , href: '/momotrolley', color: 'text-black', laber: `桃カゴ`
    },
    { icon: <Pen size={70} />, href: '/', color: 'text-black', laber: `FCST記入` },
    { icon: <Headset size={70} />, href: '/', color: 'text-black', laber: `メール` },
    { icon: <CurrencyJpy size={70} />, href: '/', color: 'text-black', laber: `賠償` },
    
];

export function Header() {
    return (
        <nav className="flex flex-wrap items-center gap-4 pt-3 pb-0 bg-gray-400">
            <Image
                src="/images/witch-flying.svg"
                alt='main'
                width={130}
                height={130}
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
                                <span className='font-medium'>{item.laber}</span>
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
        </nav>
    );
}
