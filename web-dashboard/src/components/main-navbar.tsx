"use client"

import Link from "next/link"
import { ModeToggle } from "@/components/mode-toggle"

export function Navbar() {
    return (
        <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container mx-auto px-6 lg:px-16 flex h-16 items-center justify-between">
                <div className="flex items-center gap-6 md:gap-10">
                    <Link href="/" className="flex items-center space-x-2">
                        <span className="inline-block font-bold text-xl drop-shadow-sm">
                            Novadis <span className="text-primary font-extrabold tracking-tighter">SCAN</span>
                        </span>
                    </Link>
                </div>
                <div className="flex items-center gap-2">
                    <ModeToggle />
                </div>
            </div>
        </nav>
    )
}
