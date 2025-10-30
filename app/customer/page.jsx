import Image from 'next/image';

export default function CstomerPage() {
return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center py-10 bg-gradient-to-b from-gray-400 to-gray-900">
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