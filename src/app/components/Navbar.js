'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';

export default function Navbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  return (
    <nav className="fixed top-0 left-0 right-0 bg-white border-b border-gray-200 z-50">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6">
        <div className="flex h-16 items-center justify-between">
          {/* Left side */}
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2">
              <Image
                src="/navbar_logo.png"
                alt="Smart EV Logo"
                width={32}
                height={32}
                className="w-8 h-8"
                priority
              />
              <span className="text-xl font-bold">Smart EV</span>
            </Link>

            <div className="hidden md:flex items-center gap-8">
              <Link href="/learn" className="text-gray-600 hover:text-black">
                Learn More
              </Link>
              <Link href="/business" className="text-gray-600 hover:text-black">
                Business
              </Link>
              <Link href="/about" className="text-gray-600 hover:text-black">
                About
              </Link>
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-6">
            <div className="hidden md:flex items-center gap-6">
              <Link href="/help" className="text-gray-600 hover:text-black text-sm font-medium">
                Help
              </Link>
              <Link href="/login" className="text-gray-600 hover:text-black text-sm font-medium">
                Log in
              </Link>
              <Link 
                href="/signup" 
                className="bg-black text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
              >
                Sign up
              </Link>
            </div>

            {/* Mobile menu button */}
            <button
              className="md:hidden p-2 rounded-lg hover:bg-gray-100"
              onClick={toggleMobileMenu}
              aria-label="Toggle mobile menu"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                {isMobileMenuOpen ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200">
            <div className="py-2 space-y-1">
              <Link
                href="/learn"
                className="block px-4 py-2 text-base font-medium text-gray-600 hover:text-black hover:bg-gray-50"
              >
                Learn More
              </Link>
              <Link
                href="/business"
                className="block px-4 py-2 text-base font-medium text-gray-600 hover:text-black hover:bg-gray-50"
              >
                Business
              </Link>
              <Link
                href="/about"
                className="block px-4 py-2 text-base font-medium text-gray-600 hover:text-black hover:bg-gray-50"
              >
                About
              </Link>
              <Link
                href="/help"
                className="block px-4 py-2 text-base font-medium text-gray-600 hover:text-black hover:bg-gray-50"
              >
                Help
              </Link>
              <Link
                href="/login"
                className="block px-4 py-2 text-base font-medium text-gray-600 hover:text-black hover:bg-gray-50"
              >
                Log in
              </Link>
              <Link
                href="/signup"
                className="block px-4 py-3 text-base font-medium text-white bg-black hover:bg-gray-800 transition-colors"
              >
                Sign up
              </Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
} 