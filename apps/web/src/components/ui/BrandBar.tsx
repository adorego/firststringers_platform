import Image from "next/image";

export function BrandBar() {
  return (
    <div className="flex items-center px-6 pt-4 pb-2">
      <Image
        src="/images/fs-logo.png"
        alt="First Stringers"
        width={1125}
        height={350}
        priority
        className="h-[18px] w-auto"
      />
    </div>
  );
}
