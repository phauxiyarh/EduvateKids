'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { EventNavDropdown } from '../components/EventNavDropdown'
import { HeaderCart } from '../components/HeaderCart'
import { OPEN_COOKIE_PREFS } from '../components/CookieConsent'
import { BookStack, STACK_PALETTES } from '../components/BookStack'
import logo from '../../assets/logo.png'
import design1 from '../../assets/design1.png'
import design2 from '../../assets/design2.png'
import bg1 from '../../assets/bg1.png'

function useReveal<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') { el.classList.add('is-visible'); return }
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-visible'); observer.unobserve(e.target) } }),
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return ref
}

const steps = [
  { title: 'Register your child', text: 'Sign up in a minute and receive a unique reading code.', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
  { title: 'Choose great books', text: 'Pick Islamic stories, prophets & companions, Arabic readers, and more.', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
  { title: 'Log each book', text: 'Enter your code and log every book your child finishes (parent-verified).', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  { title: 'Earn your certificate', text: 'Reach your chosen level’s goal to earn its certificate, you can keep reading more books and log them.', icon: 'M8 21h8m-4-4v4m5-16v3a5 5 0 01-10 0V5a1 1 0 011-1h8a1 1 0 011 1zm0 0h3a2 2 0 01-2 4m-12-4H4a2 2 0 002 4', highlight: true },
  { title: 'Win the raffle draw', text: 'Meet your goal and you’re entered into your category’s raffle to win a $30 store credit.', icon: 'M5 5a2 2 0 00-2 2v2a2 2 0 010 4v2a2 2 0 002 2h14a2 2 0 002-2v-2a2 2 0 010-4V7a2 2 0 00-2-2H5z', highlight: true },
]

const tiers = [
  { name: 'Early Readers', tag: 'Seedlings', books: 4, stack: 'emerald' as const, blurb: 'Picture books, early readers, lots of pictures, short text. Usually ages 4+, but place your child where they read comfortably.', color: 'from-emerald-400 to-green-500', ring: 'from-emerald-300 via-emerald-500 to-green-600' },
  { name: 'Growing Readers', tag: 'Readers', books: 6, stack: 'violet' as const, blurb: 'Beginning chapter books, longer stories, reading more independently. Usually ages 7+, but go by where your child reads, not their age.', color: 'from-primary to-accentThree', ring: 'from-violet-400 via-primary to-fuchsia-500' },
  { name: 'Confident Readers', tag: 'Scholar', books: 10, stack: 'pink' as const, blurb: 'Full chapter books and longer novels, reading fluently on their own. Usually ages 11+, or any child reading at this level.', color: 'from-secondary to-primary', ring: 'from-pink-400 via-secondary to-primary' },
]

const prizes = [
  {
    text: '$30 store credit for each winner',
    sub: 'One prize per reading category.',
    tile: 'from-amber-400 to-orange-500',
    icon: (
      // Gift / store credit
      <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 12v7a1 1 0 01-1 1H5a1 1 0 01-1-1v-7M3 8h18v4H3zM12 8v12" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8S10.5 4 8.5 4 6 6 8 8h4zM12 8s1.5-4 3.5-4S18 6 16 8h-4z" />
      </svg>
    ),
  },
  {
    text: 'Winners chosen by raffle draw',
    sub: '1 winner per category, every qualifying reader has a chance.',
    tile: 'from-secondary to-pink-600',
    icon: (
      // Ticket / raffle
      <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 7a2 2 0 012-2h12a2 2 0 012 2v2a2 2 0 000 4v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2a2 2 0 000-4V7z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeDasharray="1.5 2.5" d="M13 5v14" />
      </svg>
    ),
  },
  {
    text: 'A certificate for every participant',
    sub: 'Awarded once the minimum book goal for your category is met.',
    tile: 'from-primary to-violet-600',
    icon: (
      // Certificate / scroll with award seal
      <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 3h9l3 3v7a2 2 0 01-2 2H6a2 2 0 01-2-2V5a2 2 0 012-2z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M14 3v3h3M7 8h6M7 11h4" />
        <circle cx="15" cy="17" r="2.6" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.4 19l-.9 2.4 2.5-1.2 2.5 1.2-.9-2.4" />
      </svg>
    ),
  },
]

const eligibleBooks = [
  {
    text: 'Islamic stories & picture books',
    tile: 'from-primary to-violet-600',
    icon: (
      // Open book
      <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.5C10.6 5.5 8.7 5 7 5c-1.3 0-2.6.3-3.7.8v11.4C4.4 16.7 5.7 16.5 7 16.5c1.7 0 3.6.5 5 1.5 1.4-1 3.3-1.5 5-1.5 1.3 0 2.6.2 3.7.7V5.8C19.6 5.3 18.3 5 17 5c-1.7 0-3.6.5-5 1.5z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.5V18" />
      </svg>
    ),
  },
  {
    text: 'Prophets & Companions',
    tile: 'from-emerald-400 to-green-600',
    icon: (
      // Mosque
      <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c1.8 1.6 3 3.3 3 5 0 1.7-1.3 2.7-3 2.7S9 9.7 9 8c0-1.7 1.2-3.4 3-5z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 21v-6a2 2 0 012-2h10a2 2 0 012 2v6M5 21h14M4 21V11m16 10V11M4 11c.8-.6 1.3-1.4 1.3-2.3M20 11c-.8-.6-1.3-1.4-1.3-2.3M10 21v-2.5a2 2 0 014 0V21" />
      </svg>
    ),
  },
  {
    text: "Qur'an & Tafsir for children",
    tile: 'from-amber-400 to-orange-500',
    icon: (
      // Scroll
      <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 5a2 2 0 012-2h9a2 2 0 012 2v11a3 3 0 01-3 3H8" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 19a3 3 0 01-3-3V5M6 5a2 2 0 00-2 2 2 2 0 002 2h2V5M9 8h6M9 11h6" />
      </svg>
    ),
  },
  {
    text: 'Arabic readers & Islamic history',
    tile: 'from-secondary to-pink-600',
    icon: (
      // Scholar cap / globe
      <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4l9 4-9 4-9-4 9-4z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 8v5M7 10.2V15c0 1.1 2.2 2.5 5 2.5s5-1.4 5-2.5v-4.8" />
      </svg>
    ),
  },
]

const summerFaqs = [
  {
    question: 'Can I begin to log the books I finish reading?',
    answer: 'Yes! As soon as you finish a book, you can log it. Just let your parent or guardian know first. They will help confirm that you truly read and understood the book, and then you can go ahead and log it together.'
  },
  {
    question: 'What do I need to log a book?',
    answer: 'You need your registration code. Share it with your parent and ask for their help to log the book together, since every book is parent verified. When you are ready, head to the Log a Book page using the code above.'
  },
  {
    question: 'What if I read a book outside the recommended list?',
    answer: 'We will do our best to consider all books that align with our values and the moral nurture we seek to share within the community. However, when a book is clearly outside this scope, we are unable to count it, so it will be marked invalid. To be safe, please choose from the recommended list so every book you read counts towards your goal and the raffle draw.'
  },
  {
    question: 'Can we buy a book we like online from Eduvate Kids so we can read it?',
    answer: 'Absolutely! While we are always happy to receive your purchase, you are not required to buy any of our books to take part. We currently deliver direct online purchases across the USA and hope to expand further, in-sha-Allah. Feel free to browse and place your order in our catalog.'
  },
  {
    question: 'Why is it important to take part in the reading?',
    answer: 'Reading nurtures the heart and the mind. Taking part helps your child build a lifelong love of reading that is rooted in faith and growing in knowledge, strengthens understanding and vocabulary, and connects them with beautiful Islamic stories and values. It is also a joyful shared habit for the whole family, and completing the goal earns a certificate and a place in the raffle draw.'
  },
  {
    question: 'How many books does my child need to read?',
    answer: 'It depends on the reading level chosen at registration. Early Readers aim for 4 books, Growing Readers aim for 6 books, and Confident Readers aim for 10 books. Only valid books from the recommended list count towards the goal.'
  },
  {
    question: 'Is there a deadline?',
    answer: 'The program runs until 31 August. There is no rush, but we encourage you to enjoy your reading and aim to finish as soon as you comfortably can.'
  },
  {
    question: 'Who can enter the raffle draw?',
    answer: 'Readers who meet their goal with valid books and reside in the USA or Nigeria are entered into the raffle draw. Everyone is welcome to register, read, and earn a certificate regardless of location.'
  },
  {
    question: 'I lost my registration code. What should I do?',
    answer: 'No problem. Ask your parent to check the welcome email sent at registration, as the code is shown there. If you still cannot find it, contact us and we will be happy to help.'
  },
]

export default function SummerReadsPage() {
  const stepsReveal = useReveal<HTMLDivElement>()
  const tiersReveal = useReveal<HTMLDivElement>()
  const prizeReveal = useReveal<HTMLDivElement>()
  const faqReveal = useReveal<HTMLDivElement>()
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  return (
    <div className="min-h-screen text-ink">
      <style jsx global>{`
        @keyframes ring-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes tier-glow {
          0%, 100% { opacity: 0.75; filter: blur(6px); }
          50% { opacity: 1; filter: blur(10px); }
        }
        .tier-ring::before,
        .tier-ring::after {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: 9999px;
          background: conic-gradient(
            from 0deg,
            rgba(255, 255, 255, 0) 0deg,
            rgba(255, 255, 255, 0.95) 70deg,
            rgba(255, 255, 255, 0) 150deg,
            rgba(255, 255, 255, 0) 360deg
          );
          animation: ring-spin 4s linear infinite;
        }
        /* Mask the spinning highlight into a thin ring shape */
        .tier-ring::before {
          -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 6px), #000 calc(100% - 5px));
          mask: radial-gradient(farthest-side, transparent calc(100% - 6px), #000 calc(100% - 5px));
        }
        /* Soft outer glow that pulses in sync */
        .tier-ring::after {
          animation: ring-spin 4s linear infinite, tier-glow 4s ease-in-out infinite;
          opacity: 0.7;
        }

        /* Summer hero decorations: gentle sun spin, floating drift, twinkling stars */
        @keyframes sr-sun-spin { to { transform: rotate(360deg); } }
        @keyframes sr-float-y {
          0%, 100% { transform: translateY(0) rotate(-4deg); }
          50% { transform: translateY(-14px) rotate(4deg); }
        }
        @keyframes sr-twinkle {
          0%, 100% { opacity: 0.25; transform: scale(0.85); }
          50% { opacity: 0.9; transform: scale(1.15); }
        }
        .sr-sun { animation: sr-sun-spin 26s linear infinite; }
        .sr-float { animation: sr-float-y 7s ease-in-out infinite; }
        .sr-float.delay { animation-delay: 1.6s; animation-duration: 9s; }
        .sr-twinkle { animation: sr-twinkle 3.2s ease-in-out infinite; }

        /* Prize card: each row slides up + fades in once the section reveals,
           the icon gives a little celebratory pop, and a soft sheen sweeps the card. */
        @keyframes sr-prize-in {
          0% { opacity: 0; transform: translateY(14px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes sr-icon-pop {
          0% { transform: scale(0.4) rotate(-12deg); }
          60% { transform: scale(1.14) rotate(6deg); }
          100% { transform: scale(1) rotate(0); }
        }
        @keyframes sr-sheen {
          0% { transform: translateX(-120%) skewX(-18deg); }
          100% { transform: translateX(220%) skewX(-18deg); }
        }
        .sr-prize { opacity: 0; }
        .reveal.is-visible .sr-prize { animation: sr-prize-in 620ms cubic-bezier(0.22, 1, 0.36, 1) both; }
        .reveal.is-visible .sr-prize .sr-prize-icon { animation: sr-icon-pop 720ms cubic-bezier(0.34, 1.56, 0.64, 1) both; animation-delay: inherit; }
        .sr-sheen {
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent);
          width: 45%;
        }
        .reveal.is-visible .sr-sheen { animation: sr-sheen 2.6s ease-in-out 0.6s 1 both; }

        /* Bold, animated goal number pill, a lively pulse to draw the eye. */
        @keyframes sr-numpulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.12); }
        }
        .sr-numpill { animation: sr-numpulse 2.4s ease-in-out infinite; }

        /* Neon border for the highlighted steps (certificate + raffle): a bright
           arc travels crisply AROUND a STATIONARY card edge. The element never
           rotates (rotating it would spin the whole masked frame); instead the
           conic gradient's start angle (--sr-angle) animates, so a bright sweep
           moves along a fixed border. The gradient is masked to just the ~2px
           perimeter via mask-composite, so the card face is never painted. */
        @property --sr-angle {
          syntax: '<angle>';
          initial-value: 0deg;
          inherits: false;
        }
        .sr-neon-ring {
          padding: 2px;
          background: conic-gradient(from var(--sr-angle),
            rgba(124,58,237,0.28) 0deg,
            rgba(124,58,237,0.28) 250deg,
            #a855f7 300deg,
            #22d3ee 335deg,
            #f5f9ff 350deg,
            #ec4899 360deg);
          -webkit-mask:
            linear-gradient(#000 0 0) content-box,
            linear-gradient(#000 0 0);
          -webkit-mask-composite: xor;
          mask:
            linear-gradient(#000 0 0) content-box,
            linear-gradient(#000 0 0);
          mask-composite: exclude;
          animation: sr-neon-sweep 3s linear infinite;
        }
        /* soft outer glow that pulses in time with the sweep */
        .sr-neon::after {
          content: '';
          position: absolute;
          inset: -5px;
          border-radius: 1.7rem;
          background: linear-gradient(120deg, #a855f7, #22d3ee, #ec4899);
          opacity: 0.28;
          filter: blur(14px);
          z-index: -1;
          animation: sr-neon-glow 3s ease-in-out infinite;
        }
        @keyframes sr-neon-sweep { to { --sr-angle: 360deg; } }
        @keyframes sr-neon-glow { 0%,100% { opacity: 0.28; } 50% { opacity: 0.55; } }
        /* Fallback for browsers without @property: fixed multi-colour border so
           the effect degrades to a static neon ring rather than a spinning box. */
        @supports not (background: conic-gradient(from var(--sr-angle), red, blue)) {
          .sr-neon-ring {
            background: linear-gradient(120deg, #a855f7, #22d3ee, #ec4899);
            animation: none;
          }
        }

        /* Steps marquee: scroll one full set (-50%) for a seamless circular loop.
           Pauses on hover so a reader can stop and read a card. */
        @keyframes sr-steps-scroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .sr-steps-track { animation: sr-steps-scroll 26s linear infinite; }
        .sr-steps-marquee:hover .sr-steps-track { animation-play-state: paused; }

        @media (prefers-reduced-motion: reduce) {
          .sr-sun, .sr-float, .sr-twinkle, .sr-numpill,
          .sr-neon-ring, .sr-neon::after, .sr-steps-track { animation: none !important; }
          .sr-prize, .reveal.is-visible .sr-prize,
          .reveal.is-visible .sr-prize .sr-prize-icon,
          .reveal.is-visible .sr-sheen { animation: none !important; opacity: 1 !important; }
        }
      `}</style>
      <header className="sticky top-0 z-50 border-b border-primary/10 bg-white/80 shadow-[0_8px_30px_rgba(124,58,237,0.06)]">
        <div className="pointer-events-none absolute inset-0 -z-10 backdrop-blur-xl" aria-hidden="true" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
        <div className="mx-auto flex w-11/12 max-w-6xl items-center justify-between gap-3 py-3">
          <Link className="group flex items-center gap-2 sm:gap-3 min-w-0" href="/">
            <Image src={logo} alt="Eduvate Kids logo" width={36} height={36} className="h-8 w-8 sm:h-9 sm:w-9 flex-shrink-0 transition-transform duration-500 group-hover:rotate-6" />
            <span className="flex flex-col min-w-0 leading-tight">
              <span className="font-display text-base sm:text-lg font-bold truncate">Eduvate Kids</span>
              <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.18em] text-primary/70 hidden sm:block">Summer Reads 2026</span>
            </span>
          </Link>
          <nav className="hidden flex-1 items-center justify-center gap-2 md:flex">
            <Link href="/" className="flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold text-primaryDark bg-primary/5 transition-all duration-300 ease-out hover:bg-primary/10 hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(124,58,237,0.14)]">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3v-6h6v6h3a1 1 0 001-1V10" /></svg>
              <span>Home</span>
            </Link>
            <Link href="/catalog" className="flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold text-primaryDark bg-primary/5 transition-all duration-300 ease-out hover:bg-primary/10 hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(124,58,237,0.14)]">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
              <span>Our Catalog</span>
            </Link>
            <Link href="/shelves" className="flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold text-primaryDark bg-primary/5 transition-all duration-300 ease-out hover:bg-primary/10 hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(124,58,237,0.14)]">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M6 5v10M10 7v8M14 4v11M18 8v7M3.5 15.5h17M5 15.5v3.5m14-3.5v3.5" /></svg>
              <span>Shelves</span>
            </Link>
            <EventNavDropdown active />
            <Link href="/contact-us" className="flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold text-primaryDark bg-primary/5 transition-all duration-300 ease-out hover:bg-primary/10 hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(124,58,237,0.14)]">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 3v-3z" /></svg>
              <span>Contact</span>
            </Link>
            <Link href="/faqs" className="flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold text-primaryDark bg-primary/5 transition-all duration-300 ease-out hover:bg-primary/10 hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(124,58,237,0.14)]">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <span>FAQs</span>
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            <HeaderCart />
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden pb-12 pt-16 sm:pt-24 bg-gradient-to-br from-amber-50 via-white to-emerald-50">
          <div className="hero-svg-bg absolute inset-0 z-0 opacity-15" style={{ backgroundImage: `url(${bg1.src})`, backgroundSize: '70% auto', backgroundRepeat: 'repeat' }} />
          {['left-10 top-16 h-24 w-24 opacity-25', 'right-16 top-24 h-32 w-32 opacity-20', 'left-1/4 bottom-10 h-20 w-20 opacity-25'].map((c, i) => (
            <Image key={i} src={i % 2 === 0 ? design1 : design2} alt="" width={160} height={160} className={`hero-drift ${i % 2 ? 'delay' : ''} pointer-events-none absolute z-0 hidden md:block ${c}`} />
          ))}

          {/* Summer-themed animated decorations */}
          {/* Sun: gentle rotate + glow, top-right */}
          <div className="sr-sun pointer-events-none absolute right-6 top-10 z-0 hidden sm:block text-amber-400/70" aria-hidden="true">
            <svg className="h-16 w-16 sm:h-20 sm:w-20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
              <circle cx="12" cy="12" r="4.5" fill="currentColor" fillOpacity="0.25" />
              <path strokeLinecap="round" d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1" />
            </svg>
          </div>
          {/* Floating open book, left */}
          <div className="sr-float pointer-events-none absolute left-8 top-40 z-0 hidden md:block text-primary/30" aria-hidden="true">
            <svg className="h-14 w-14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.5C10.5 5.3 8.5 4.8 6 4.8c-.9 0-1.7.1-2.5.3v13c.8-.2 1.6-.3 2.5-.3 2.5 0 4.5.5 6 1.7 1.5-1.2 3.5-1.7 6-1.7.9 0 1.7.1 2.5.3v-13c-.8-.2-1.6-.3-2.5-.3-2.5 0-4.5.5-6 1.7zM12 6.5v12.3" />
            </svg>
          </div>
          {/* Growing sprout (Seedling theme), bottom-left */}
          <div className="sr-float delay pointer-events-none absolute left-1/4 bottom-8 z-0 hidden md:block text-emerald-400/40" aria-hidden="true">
            <svg className="h-12 w-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 20v-6m0 0c0-3 2-5 5-5-.5 3-2 5-5 5zm0 0c0-3-2-5-5-5 .5 3 2 5 5 5z" />
            </svg>
          </div>
          {/* Twinkling stars */}
          {[
            'right-1/4 top-28 h-6 w-6',
            'left-1/3 top-16 h-4 w-4',
            'right-16 bottom-16 h-5 w-5',
          ].map((c, i) => (
            <div key={`star-${i}`} className={`sr-twinkle pointer-events-none absolute z-0 hidden sm:block text-secondary/40 ${c}`} style={{ animationDelay: `${i * 0.8}s` }} aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-full w-full"><path d="M12 2l2.2 6.6L21 9l-5 4 1.8 7L12 16.8 6.2 20 8 13 3 9l6.8-.4L12 2z" /></svg>
            </div>
          ))}
          <div className="reveal is-visible relative z-10 mx-auto w-11/12 max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-white/70 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-accentThree backdrop-blur">
              July 13 - August 31, 2026
            </span>
            <h1 className="mt-4 font-display text-3xl sm:text-5xl leading-tight">
              Eduvate Kids <span className="gradient-text">Summer Reads</span>
            </h1>
            <p className="mt-4 text-base sm:text-lg text-muted leading-relaxed">
              A joyful summer reading challenge for ages 4-18. Read Islamic and Arabic books,
              log your progress, and earn a certificate when you reach your goal, plus a chance of winning $30 store credit. Early, Growing, or Confident Readers.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Link href="/summer-reads/register" className="btn-shine inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-primary to-secondary px-6 py-3.5 text-sm font-semibold text-white shadow-[0_10px_28px_rgba(124,58,237,0.3)] transition-all duration-300 hover:-translate-y-0.5">
                Register Your Child
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
              </Link>
              <Link href="/summer-reads/log" className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-white/70 px-6 py-3.5 text-sm font-semibold text-primaryDark backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40">
                Log a Book
              </Link>
              <Link href="/catalog" className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-white/70 px-6 py-3.5 text-sm font-semibold text-primaryDark backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40">
                Browse Books
              </Link>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="relative py-14 sm:py-20 bg-white">
          <div ref={stepsReveal} className="reveal mx-auto w-11/12 max-w-7xl">
            <div className="text-center">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-accentThree">How It Works</p>
              <h2 className="mt-4 font-display text-2xl sm:text-4xl">Five simple steps</h2>
            </div>
            {/* Auto-scrolling marquee that loops continuously and pauses on hover.
               The steps are rendered twice so the track can translate -50% for a
               seamless circular repeat. Edges are masked so cards fade in/out. */}
            <div
              className="sr-steps-marquee mt-10 overflow-hidden"
              style={{ WebkitMaskImage: 'linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent)', maskImage: 'linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent)' }}
            >
              <div className="sr-steps-track flex w-max gap-6 py-2">
                {[...steps, ...steps].map((s, i) => {
                  const num = (i % steps.length) + 1
                  return s.highlight ? (
                    // Highlighted steps (certificate + raffle): animated neon border.
                    <div key={i} className="sr-neon relative w-[78vw] max-w-[300px] sm:w-[320px] flex-shrink-0 rounded-3xl p-[2px]" aria-hidden={i >= steps.length || undefined}>
                      <span className="sr-neon-ring absolute inset-0 rounded-3xl" style={{ animationDelay: `${-(num % steps.length) * 0.6}s` }} aria-hidden="true" />
                      <div className="relative h-full rounded-[calc(1.5rem-2px)] bg-white p-5 sm:p-6">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-secondary text-white shadow-md">
                          <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d={s.icon} /></svg>
                        </div>
                        <div className="mt-4 flex items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-primary to-secondary text-xs font-bold text-white">{num}</span>
                          <h3 className="font-display text-lg font-bold text-primaryDark">{s.title}</h3>
                        </div>
                        <p className="mt-2 text-sm text-muted leading-relaxed">{s.text}</p>
                      </div>
                    </div>
                  ) : (
                    <div key={i} className="w-[78vw] max-w-[300px] sm:w-[320px] flex-shrink-0 rounded-3xl bg-gradient-to-br from-white to-purple-50/40 p-5 sm:p-6 shadow-soft border border-primary/10" aria-hidden={i >= steps.length || undefined}>
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 text-primaryDark">
                        <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d={s.icon} /></svg>
                      </div>
                      <div className="mt-4 flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-primary to-secondary text-xs font-bold text-white">{num}</span>
                        <h3 className="font-display text-lg font-bold text-primaryDark">{s.title}</h3>
                      </div>
                      <p className="mt-2 text-sm text-muted leading-relaxed">{s.text}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </section>

        {/* Levels */}
        <section className="relative py-14 sm:py-20 bg-gradient-to-br from-emerald-50 via-white to-purple-50">
          <div ref={tiersReveal} className="reveal mx-auto w-11/12 max-w-5xl">
            <div className="text-center">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-accentThree">Reading Levels</p>
              <h2 className="mt-4 font-display text-2xl sm:text-4xl">Choose your reading level</h2>
              <p className="mt-3 text-muted">Pick one level as your summer goal at registration, it stays the same all season. Reach the goal to earn its certificate; reading extra books is always welcome. Every reader who meets their goal is entered into their category&apos;s raffle to win a $30 store credit (raffle open to USA &amp; Nigeria residents).</p>
            </div>
            <div className="reveal-stagger mt-10 grid gap-6 sm:grid-cols-3">
              {tiers.map((t) => (
                <div key={t.name} className="card-hover rounded-3xl bg-white p-6 text-center shadow-soft border border-primary/10 hover:-translate-y-1.5">
                  {/* 3D book stack that piles up on a loop, height reflects the goal */}
                  <div className="relative mx-auto h-32 w-32">
                    <BookStack count={t.books} palette={STACK_PALETTES[t.stack]} uid={t.stack} className="h-full w-full" loopSeconds={6} />
                    <span className={`sr-numpill pointer-events-none absolute -right-1 -top-1 flex h-12 w-12 flex-col items-center justify-center rounded-full bg-gradient-to-br ${t.color} font-display text-2xl font-extrabold leading-none text-white shadow-[0_8px_22px_rgba(0,0,0,0.22)] ring-2 ring-white`}>
                      {t.books}
                      <span className="text-[8px] font-bold uppercase tracking-wide text-white/85">books</span>
                    </span>
                  </div>
                  <h3 className="mt-4 font-display text-xl gradient-text">{t.name}</h3>
                  <p className="text-xs font-semibold uppercase tracking-wide text-accentThree">{t.tag}</p>
                  <p className="mt-2 text-sm font-semibold text-primaryDark">Goal: read {t.books} books</p>
                  <p className="mt-2 text-[13px] leading-snug text-muted">{t.blurb}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Prizes + eligible books */}
        <section className="relative py-14 sm:py-20 bg-white">
          <div ref={prizeReveal} className="reveal mx-auto grid w-11/12 max-w-5xl gap-8 md:grid-cols-2">
            <div className="sr-prizecard relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-50 to-orange-50 p-6 sm:p-8 shadow-soft border border-amber-200/60">
              {/* soft moving sheen across the prize card */}
              <span className="sr-sheen pointer-events-none absolute inset-0" aria-hidden="true" />
              <h3 className="relative font-display text-2xl gradient-text">Prizes</h3>
              <ul className="relative mt-5 space-y-4 text-sm">
                {prizes.map((p, i) => (
                  <li key={p.text} className="sr-prize flex items-start gap-3" style={{ animationDelay: `${i * 140}ms` }}>
                    <span className={`sr-prize-icon flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${p.tile} shadow-md`}>
                      {p.icon}
                    </span>
                    <span className="pt-0.5">
                      <span className="block font-semibold text-ink">{p.text}</span>
                      {p.sub && <span className="mt-0.5 block text-xs leading-snug text-muted">{p.sub}</span>}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="relative mt-5 text-xs text-muted">Winners are drawn by raffle after the program ends, one per reading category, and announced by email. The prize raffle draw is currently open only to residents of the USA and Nigeria. Every reader who meets their category&apos;s book goal keeps their certificate, wherever they live.</p>
            </div>
            <div className="rounded-3xl bg-gradient-to-br from-purple-50 to-pink-50 p-6 sm:p-8 shadow-soft border border-primary/10">
              <h3 className="font-display text-2xl gradient-text">Eligible Books</h3>
              <ul className="mt-4 space-y-3 text-sm">
                {eligibleBooks.map((b) => (
                  <li key={b.text} className="flex items-start gap-3">
                    <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${b.tile} shadow-sm`}>
                      {b.icon}
                    </span>
                    <span className="pt-1.5 text-muted">{b.text}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs text-muted">Books should be age-appropriate, fully read, and parent-verified when logged.</p>
              <Link href="/catalog" className="mt-5 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-primary to-secondary px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:-translate-y-0.5">
                Browse our books
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
              </Link>
            </div>
          </div>
          <div className="mt-10 text-center">
            <Link href="/summer-reads/register" className="btn-shine inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-primary to-secondary px-8 py-3.5 text-sm font-semibold text-white shadow-[0_10px_28px_rgba(124,58,237,0.3)] transition-all duration-300 hover:-translate-y-0.5">
              Register Your Child Now
            </Link>
          </div>
        </section>

        {/* Frequently Asked Questions */}
        <section className="relative py-14 sm:py-20 bg-gradient-to-br from-purple-50 via-white to-emerald-50">
          <div ref={faqReveal} className="reveal mx-auto w-11/12 max-w-3xl">
            <div className="text-center">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-accentThree">Good To Know</p>
              <h2 className="mt-4 font-display text-2xl sm:text-4xl">Summer Reads FAQs</h2>
              <p className="mt-3 text-muted">Everything you and your reader might want to ask about logging books, the recommended list, and the raffle.</p>
            </div>
            <div className="mt-10 space-y-3">
              {summerFaqs.map((faq, i) => {
                const isOpen = openFaq === i
                return (
                  <div key={i} className="overflow-hidden rounded-2xl border border-primary/10 bg-white shadow-soft transition-all duration-300 hover:border-primary/30">
                    <button
                      type="button"
                      onClick={() => setOpenFaq(isOpen ? null : i)}
                      className="flex w-full items-center justify-between gap-4 p-5 text-left"
                      aria-expanded={isOpen}
                      aria-controls={`sr-faq-panel-${i}`}
                      id={`sr-faq-button-${i}`}
                    >
                      <span className="font-semibold text-primaryDark">{faq.question}</span>
                      <svg
                        className={`h-5 w-5 flex-shrink-0 text-primary transition-transform duration-300 ${isOpen ? 'rotate-180' : 'rotate-0'}`}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    <div
                      id={`sr-faq-panel-${i}`}
                      role="region"
                      aria-labelledby={`sr-faq-button-${i}`}
                      className={`overflow-hidden transition-all duration-300 ${isOpen ? 'max-h-[600px]' : 'max-h-0'}`}
                    >
                      <p className="px-5 pb-5 leading-relaxed text-ink/80">{faq.answer}</p>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="mt-10 flex flex-wrap justify-center gap-4">
              <Link href="/summer-reads/log" className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-primary to-secondary px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:-translate-y-0.5">
                Log a Book
              </Link>
              <Link href="/contact-us" className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-white px-6 py-3 text-sm font-semibold text-primaryDark transition hover:-translate-y-0.5 hover:border-primary/40">
                Still have a question? Contact us
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative overflow-hidden bg-gradient-to-br from-[#16121f] via-[#1f1b2e] to-[#241d38] py-10 text-white">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
        <div className="mx-auto w-11/12 max-w-6xl">
          <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
            <Link href="/" className="flex items-center gap-3">
              <Image src={logo} alt="Eduvate Kids logo" width={36} height={36} />
              <span className="flex flex-col leading-tight">
                <span className="font-display text-lg font-bold">Eduvate Kids</span>
                <span className="font-display text-xs font-semibold italic text-emerald-300">Rooted in Faith. Growing in Knowledge.</span>
              </span>
            </Link>
            <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-white/70">
              <Link href="/" className="transition-colors hover:text-white">Home</Link>
              <Link href="/summer-reads/register" className="transition-colors hover:text-white">Register</Link>
              <Link href="/summer-reads/log" className="transition-colors hover:text-white">Log a Book</Link>
              <Link href="/catalog" className="transition-colors hover:text-white">Our Catalog</Link>
              <Link href="/accessibility" className="transition-colors hover:text-white">Accessibility</Link>
              <button type="button" onClick={() => { if (typeof window !== 'undefined') window.dispatchEvent(new Event(OPEN_COOKIE_PREFS)) }} className="transition-colors hover:text-white">Cookie Preferences</button>
            </div>
          </div>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 border-t border-white/10 pt-6 text-center text-sm text-white/50 sm:flex-row">
            <p>© 2026 Eduvate Kids. All rights reserved.</p>
            <Link href="/auth/login" aria-label="Admin Login" className="group inline-flex items-center justify-center rounded-full p-1.5 text-white/30 transition-all duration-300 hover:bg-white/5 hover:text-white/80">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l7 4v5c0 4.418-3.03 7.79-7 9-3.97-1.21-7-4.582-7-9V7l7-4z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.5 12l1.75 1.75L15 10" />
              </svg>
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
