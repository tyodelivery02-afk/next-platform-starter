import Image from 'next/image';

export default function CstomerPage() {
return (
    <main className="bg-style">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-250">
            <Image
                src="/images/working.png"
                alt='working'
                width={500}
                height={500}
                style={{ objectFit: "contain" }}
            />
        </div>
    </main>
);
}