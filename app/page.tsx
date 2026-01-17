'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'
import logo from '../assets/logo.png'
import learningRootsLogo from '../assets/partners/learning-roots.webp'
import kubeLogo from '../assets/partners/kube.webp'
import oakLogo from '../assets/partners/oak.png'
import design1 from '../assets/design1.png'
import design2 from '../assets/design2.png'
import bg2 from '../assets/bg2.png'
import bg1 from '../assets/bg1.png'

const partners = [
  {
    name: 'Learning Roots (LR Community Partner for Maryland USA)',
    url: 'https://www.learningroots.com/',
    logo: learningRootsLogo
  },
  {
    name: 'Kube Publishing',
    url: 'https://www.kubepublishing.com/',
    logo: kubeLogo
  },
  {
    name: 'Oak Books',
    url: 'https://oakcreativedesigns.com/',
    logo: oakLogo
  }
]

const testimonials = [
  {
    quote:
      'My 5-year-old keeps asking for story time now. We found books that speak to her faith in a gentle, joyful way.',
    name: 'Amina M.',
    role: 'Parent of a kindergartener'
  },
  {
    quote:
      'Our 4th graders were captivated by the biographies and activity kits. The fair felt thoughtful and well curated.',
    name: 'Mr. Hassan',
    role: 'Elementary School Librarian'
  },
  {
    quote:
      'I love the puzzles and the stories. The heroes are brave and kind. I read to my little brother too.',
    name: 'Zara, 9',
    role: 'Young Reader'
  },
  {
    quote:
      'As a teen, I wanted books that felt like real life. The selections here are thoughtful and inspiring.',
    name: 'Khalid, 14',
    role: 'Middle School Student'
  },
  {
    quote:
      'The Arabic flashcards and seerah sets made our homeschooling routine smoother and more meaningful.',
    name: 'Sana R.',
    role: 'Homeschooling Parent'
  },
  {
    quote:
      'I discovered books that helped me feel confident at the masjid and at school. It made a real difference.',
    name: 'Lina, 11',
    role: 'Young Reader'
  }
]

export default function HomePage() {
  const [activeTestimonial, setActiveTestimonial] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveTestimonial((prev) => (prev + 1) % testimonials.length)
    }, 4500)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="min-h-screen text-ink">
      <header className="sticky top-0 z-20 border-b border-black/10 bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-11/12 max-w-6xl items-center justify-between gap-6 py-4">
          <a className="flex items-center gap-3" href="#top">
            <Image src={logo} alt="Eduvate Kids logo" width={52} height={52} />
            <span className="flex flex-col">
              <span className="font-display text-lg font-bold">Eduvate Kids</span>
              <span className="text-sm text-muted">Islamic Bookstore</span>
            </span>
          </a>
          <nav className="hidden items-center gap-5 text-sm font-semibold text-muted md:flex">
            <a className="hover:text-primaryDark" href="#about">
              About
            </a>
            <a className="hover:text-primaryDark" href="#dashboard">
              Dashboard
            </a>
            <a className="hover:text-primaryDark" href="#partners">
              Partners
            </a>
            <a className="hover:text-primaryDark" href="#contact">
              Contact
            </a>
          </nav>
          <a
            className="rounded-full border border-primary/30 bg-white px-5 py-2 text-sm font-semibold text-primaryDark shadow-sm transition hover:-translate-y-0.5"
            href="/auth/login"
          >
            Admin Login
          </a>
        </div>
      </header>

      <main id="top">
        <section className="relative overflow-hidden pb-16 pt-40">
          <div
            className="hero-svg-bg absolute inset-0 z-0"
            style={{
              backgroundImage: `url(${bg2.src})`,
              backgroundSize: '75% auto',
              backgroundRepeat: 'repeat'
            }}
          />
          <div className="pattern-grid absolute inset-0 z-0 opacity-60" />
          <Image
            src={design2}
            alt=""
            width={420}
            height={420}
            className="hero-drift pointer-events-none absolute left-6 top-10 z-10 h-48 w-48 opacity-30"
          />
          <Image
            src={design2}
            alt=""
            width={520}
            height={520}
            className="hero-drift delay pointer-events-none absolute left-32 top-44 z-10 h-64 w-64 opacity-25"
          />
          <Image
            src={design2}
            alt=""
            width={600}
            height={600}
            className="hero-drift slow pointer-events-none absolute right-10 top-16 z-10 h-72 w-72 opacity-25"
          />
          <Image
            src={design2}
            alt=""
            width={360}
            height={360}
            className="hero-drift delay pointer-events-none absolute right-20 top-64 z-10 h-40 w-40 opacity-30"
          />
          <div className="hero-glow pointer-events-none absolute right-[-120px] top-24 z-0 h-72 w-72 rounded-full" />
          <div className="hero-glow pointer-events-none absolute left-[-140px] top-52 z-0 h-80 w-80 rounded-full" />
          <div className="relative z-20 mx-auto grid w-11/12 max-w-6xl items-center gap-12 md:grid-cols-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-accentThree">
                Maryland, USA
              </p>
              <h1 className="mt-4 font-display text-4xl leading-tight md:text-5xl">
                A leading Muslim bookstore for families, schools, and communities.
              </h1>
              <p className="mt-3 text-lg font-semibold gradient-text">
                Curated stories that inspire faith, curiosity, and character.
              </p>
              <p className="mt-4 text-lg text-muted">
                Eduvate Kids curates Islamic children&apos;s literature, crafts, and
                learning tools with a modern retail experience. We serve families,
                educators, and community events with thoughtful recommendations,
                reliable inventory, and warm service.
              </p>
              <div className="mt-6 flex flex-wrap gap-4">
                <a
                  className="rounded-full hero-gradient px-6 py-3 font-semibold text-white shadow-soft transition hover:-translate-y-0.5"
                  href="#modules"
                >
                  Explore Modules
                </a>
                <a
                  className="rounded-full border border-primary px-6 py-3 font-semibold text-primaryDark"
                  href="/dashboard"
                >
                  View Dashboard
                </a>
              </div>
              <div className="mt-6 text-sm text-muted">
                Curated Islamic titles · Books, crafts, and puzzles · Events & school fairs
              </div>
            </div>

            <div className="glass-card rounded-2xl p-8 shadow-soft">
              <div className="flex items-center justify-between text-sm font-semibold">
                <span>Why Reading Matters</span>
                <span className="rounded-full bg-primary/10 px-3 py-1 text-xs text-primaryDark">
                  Faith · Language · Character
                </span>
              </div>
              <div className="relative mt-6 rounded-2xl bg-cream p-5 shadow-soft">
                <p className="text-sm text-muted">
                  Reading nurtures empathy, strengthens language, and helps
                  children connect to faith through stories. A few pages a day
                  builds confidence, curiosity, and lifelong learning habits.
                </p>
                <div className="mt-4 grid gap-3 text-xs">
                  {[
                    'Builds Islamic identity through stories.',
                    'Expands vocabulary and comprehension.',
                    'Creates family moments and shared reflection.'
                  ].map((item) => (
                    <div key={item} className="flex items-start gap-2">
                      <span className="text-primary">✦</span>
                      <span className="text-muted">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-8 grid grid-cols-3 gap-4 text-center">
                {[['400+', 'Curated Titles'], ['50+', 'Learning Kits'], ['10+', 'Events Monthly']].map(
                  ([value, label]) => (
                    <div key={label} className="rounded-2xl bg-white/80 px-3 py-2 shadow-soft">
                      <h3 className="text-xl font-semibold text-primaryDark">{value}</h3>
                      <p className="text-xs text-muted">{label}</p>
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        </section>

        <section id="about" className="relative py-16">
          <div className="relative z-10 mx-auto grid w-11/12 max-w-6xl gap-10 md:grid-cols-2">
            <div>
              <h2 className="font-display text-3xl">About Eduvate Kids</h2>
              <p className="mt-4 text-muted">
                Eduvate Kids began as a small table of books at community events
                and grew into a trusted bookstore for Muslim families. Today we
                curate stories, crafts, and learning tools that help children
                connect with faith through joyful discovery.
              </p>
              <ul className="mt-6 space-y-3 text-sm">
                {[
                  'Curated, age-appropriate Islamic content.',
                  'Community partnerships with schools and masajid.',
                  'Reliable inventory with seasonal event readiness.',
                  'Warm customer service with educational guidance.'
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="text-primary">✦</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl bg-gradient-to-br from-primary/10 to-accentTwo/15 p-8 shadow-soft">
              <h3 className="font-display text-xl">Our Experience</h3>
              <p className="mt-3 text-muted">
                A welcoming, kid-friendly space where faith and curiosity meet.
                Every title and activity is selected to inspire confident
                learning and joyful family moments.
              </p>
              <div className="mt-6 grid gap-4">
                <div className="animate-float rounded-2xl bg-white p-4 shadow-soft">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accentThree">
                    In-Store Moments
                  </p>
                  <p className="mt-2 text-sm text-muted">
                    Thoughtful curation, warm guidance, and meaningful gifts for
                    every family milestone.
                  </p>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap gap-2 text-sm">
                {['Trusted', 'Family-Centered', 'Educational'].map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-white px-3 py-1 text-xs font-semibold"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="relative bg-white py-16">
          <div
            className="hero-svg-bg absolute inset-0 opacity-20"
            style={{
              backgroundImage: `url(${bg1.src})`,
              backgroundSize: '75% auto',
              backgroundRepeat: 'repeat'
            }}
          />
          {[
            'left-6 top-8 h-20 w-20 opacity-30',
            'right-10 top-10 h-28 w-28 opacity-25',
            'left-1/3 bottom-6 h-24 w-24 opacity-20',
            'right-1/4 bottom-12 h-32 w-32 opacity-25',
            'left-20 bottom-16 h-16 w-16 opacity-30'
          ].map((classes, index) => (
            <Image
              key={`mission-design-${index}`}
              src={design1}
              alt=""
              width={180}
              height={180}
              className={`hero-drift pointer-events-none absolute z-10 ${classes}`}
            />
          ))}
          <div className="mx-auto w-11/12 max-w-6xl text-center">
            <h2 className="font-display text-3xl">Mission & Vision</h2>
            <p className="mt-3 text-muted">
              We&apos;re building the most trusted Muslim bookstore experience in
              North America, rooted in faith, learning, and community.
            </p>
            <div className="mt-10 grid gap-6 md:grid-cols-2">
              <div className="animate-float rounded-2xl bg-cream p-6 text-left shadow-soft">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                  Mission
                </p>
                <h3 className="mt-3 font-display text-xl">
                  Inspire lifelong faith through stories and learning.
                </h3>
                <p className="mt-2 text-sm text-muted">
                  We provide high-quality Islamic books, activities, and gifts
                  that nurture identity, curiosity, and love of knowledge.
                </p>
              </div>
              <div className="animate-float rounded-2xl bg-cream p-6 text-left shadow-soft">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary">
                  Vision
                </p>
                <h3 className="mt-3 font-display text-xl">
                  A connected community of readers, learners, and leaders.
                </h3>
                <p className="mt-2 text-sm text-muted">
                  We partner with schools, masajid, and families to make
                  faith-centered learning accessible and joyful everywhere.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="relative py-16 bg-emerald-50/80">
          <div className="mx-auto grid w-11/12 max-w-6xl items-center gap-10 md:grid-cols-2">
            <div>
              <h2 className="font-display text-3xl">Testimonials</h2>
              <p className="mt-3 text-muted">
                Trusted by parents, educators, and young readers who see faith
                and learning come together with joy.
              </p>
              <div className="mt-6 space-y-4">
                <div className="animate-float rounded-2xl bg-white p-5 shadow-soft">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accentThree">
                    Parent Favorite
                  </p>
                  <p className="mt-2 text-sm text-muted">
                    “It feels like a boutique with heart. The curation is thoughtful,
                    and the kids are always excited.”
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded-2xl bg-white p-6 shadow-soft">
              <div className="relative min-h-[200px] overflow-hidden">
                {testimonials.map((testimonial, index) => (
                  <div
                    key={testimonial.name}
                    className={`absolute inset-0 transition-all duration-500 ${
                      index === activeTestimonial
                        ? 'translate-x-0 opacity-100'
                        : 'translate-x-6 opacity-0'
                    }`}
                  >
                    <p className="text-sm text-muted">“{testimonial.quote}”</p>
                    <div className="mt-4 text-sm font-semibold">
                      {testimonial.name}
                      <span className="ml-2 text-xs text-muted">· {testimonial.role}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 flex items-center justify-between">
                <div className="flex gap-2">
                  {testimonials.map((_, index) => (
                    <button
                      key={`dot-${index}`}
                      className={`h-2 w-2 rounded-full ${
                        index === activeTestimonial ? 'bg-primary' : 'bg-primary/20'
                      }`}
                      onClick={() => setActiveTestimonial(index)}
                      type="button"
                      aria-label={`Go to testimonial ${index + 1}`}
                    />
                  ))}
                </div>
                <div className="flex gap-2 text-xs font-semibold">
                  <button
                    className="rounded-full border border-primary/30 px-3 py-1 text-primaryDark"
                    onClick={() =>
                      setActiveTestimonial(
                        (activeTestimonial - 1 + testimonials.length) % testimonials.length
                      )
                    }
                    type="button"
                  >
                    Prev
                  </button>
                  <button
                    className="rounded-full border border-primary/30 px-3 py-1 text-primaryDark"
                    onClick={() =>
                      setActiveTestimonial((activeTestimonial + 1) % testimonials.length)
                    }
                    type="button"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="partners" className="relative bg-white py-16">
          <div
            className="hero-svg-bg absolute inset-0 opacity-5"
            style={{ backgroundImage: `url(${bg2.src})` }}
          />
          <div className="mx-auto w-11/12 max-w-6xl">
            <div className="text-center">
              <h2 className="font-display text-3xl">Trusted Partners</h2>
              <p className="mt-2 text-muted">
                Proud to collaborate with trusted publishers and educators.
              </p>
            </div>
            <div className="partner-slider mt-10">
              <div className="partner-track">
                {[...partners, ...partners].map((partner, index) => (
                  <a
                    key={`${partner.name}-${index}`}
                    className="partner-card"
                    href={partner.url}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={partner.name}
                  >
                    <Image
                      src={partner.logo}
                      alt={`${partner.name} logo`}
                      width={220}
                      height={120}
                      className="partner-logo"
                    />
                  </a>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="contact" className="relative py-16">
          <div
            className="hero-svg-bg absolute inset-0 opacity-10"
            style={{
              backgroundImage: `url(${bg2.src})`,
              backgroundSize: '70% auto',
              backgroundRepeat: 'repeat'
            }}
          />
          <div className="relative z-10 mx-auto grid w-11/12 max-w-6xl gap-8 rounded-xl bg-white p-10 shadow-soft md:grid-cols-2">
            <div>
              <h2 className="font-display text-3xl">Contact Us</h2>
              <p className="mt-3 text-muted">
                Reach out for curated recommendations, school partnerships, or
                event support. We&apos;re here to help your community discover
                meaningful Islamic learning.
              </p>
              <div className="mt-4 space-y-2 text-sm font-semibold text-muted">
                <p>Maryland, USA</p>
                <p>Book fairs · Community events · Local schools</p>
              </div>
            </div>
            <form className="grid gap-4 text-sm">
              <label className="grid gap-1">
                Name
                <input
                  className="rounded-xl border border-black/10 px-4 py-3"
                  type="text"
                  placeholder="Your name"
                />
              </label>
              <label className="grid gap-1">
                Email
                <input
                  className="rounded-xl border border-black/10 px-4 py-3"
                  type="email"
                  placeholder="your@email.com"
                />
              </label>
              <label className="grid gap-1">
                Project Notes
                <textarea
                  className="min-h-[120px] rounded-xl border border-black/10 px-4 py-3"
                  placeholder="Tell us about your timeline"
                />
              </label>
              <button
                className="rounded-full bg-gradient-to-r from-primary to-secondary px-6 py-3 font-semibold text-white"
                type="button"
              >
                Request a Demo
              </button>
            </form>
          </div>
        </section>
      </main>

      <footer className="bg-[#1f1b2e] py-12 text-white">
        <div className="mx-auto grid w-11/12 max-w-6xl gap-8 md:grid-cols-3">
          <div>
            <Image src={logo} alt="Eduvate Kids logo" width={60} height={60} />
            <p className="mt-3 text-sm text-white/80">Bookstore for Muslim Families</p>
          </div>
          <div className="text-sm">
            <h4 className="font-display text-lg">Platform</h4>
            <a className="mt-2 block text-white/70" href="#dashboard">
              Dashboard
            </a>
            <a className="mt-2 block text-white/70" href="#partners">
              Partners
            </a>
          </div>
          <div className="text-sm">
            <h4 className="font-display text-lg">Implementation</h4>
            <a className="mt-2 block text-white/70" href="#about">
              Overview
            </a>
            <a className="mt-2 block text-white/70" href="#contact">
              Start Project
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
