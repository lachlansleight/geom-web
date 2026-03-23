import Link from "next/link";

const Header = (): JSX.Element => {
    return (
        <div className="fixed top-0 left-0 w-screen h-8 bg-neutral-400 flex justify-start items-center px-8 gap-4">
            <Link href="/">
                <span className="text-neutral-800">A Realtime Site</span>
            </Link>
        </div>
    );
};

export default Header;
