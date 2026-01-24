'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import logo from '../assets/logo.png'
import catalogQR from '../assets/catalog.png'
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
        <div className="mx-auto flex w-11/12 max-w-6xl items-center justify-between gap-6 py-2">
          <a className="flex items-center gap-3" href="#top">
            <Image
              src={logo}
              alt="Eduvate Kids logo"
              width={16}
              height={16}
            />
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
          </nav>
          <Link
            className="flex items-center gap-2 rounded-full border border-primary/30 bg-white px-5 py-2 text-sm font-semibold text-primaryDark shadow-sm transition hover:-translate-y-0.5"
            href="/auth/login"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            Admin Login
          </Link>
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
                <Link
                  className="rounded-full border border-primary px-6 py-3 font-semibold text-primaryDark"
                  href="/dashboard"
                >
                  View Dashboard
                </Link>
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

        <section id="about" className="relative py-20 bg-gradient-to-br from-purple-50 via-white to-pink-50">
          <div
            className="hero-svg-bg absolute inset-0 opacity-10"
            style={{
              backgroundImage: `url(${bg1.src})`,
              backgroundSize: '65% auto',
              backgroundRepeat: 'repeat'
            }}
          />
          {[
            'left-10 top-12 h-24 w-24 opacity-25',
            'right-16 top-16 h-32 w-32 opacity-20',
            'left-1/4 bottom-20 h-20 w-20 opacity-30',
            'right-1/3 bottom-12 h-28 w-28 opacity-25'
          ].map((classes, index) => (
            <Image
              key={`about-design-${index}`}
              src={index % 2 === 0 ? design1 : design2}
              alt=""
              width={160}
              height={160}
              priority={index === 0}
              className={`hero-drift ${index % 2 === 0 ? '' : 'delay'} pointer-events-none absolute z-0 ${classes}`}
            />
          ))}
          <div className="relative z-10 mx-auto w-11/12 max-w-6xl">
            <div className="text-center">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-accentThree">
                Our Story
              </p>
              <h2 className="mt-4 font-display text-4xl">About Eduvate Kids</h2>
              <p className="mt-3 text-lg text-muted max-w-2xl mx-auto">
                From a small table of books at community events to a trusted Islamic bookstore
                for Muslim families across North America.
              </p>
            </div>

            <div className="mt-12 grid gap-8 md:grid-cols-2 items-center">
              <div className="space-y-6">
                <div className="rounded-2xl bg-white p-6 shadow-soft">
                  <h3 className="font-display text-2xl gradient-text">Our Journey</h3>
                  <p className="mt-3 text-muted leading-relaxed">
                    Eduvate Kids began with a passion for Islamic education and grew into
                    a beloved resource for families, educators, and communities. Today we
                    curate stories, crafts, and learning tools that help children connect
                    with faith through joyful discovery.
                  </p>
                  <ul className="mt-4 space-y-2 text-sm">
                    {[
                      'Curated, age-appropriate Islamic content',
                      'Community partnerships with schools & masajid',
                      'Reliable inventory with seasonal event readiness',
                      'Warm customer service with educational guidance'
                    ].map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <span className="text-primary">✦</span>
                        <span className="text-muted">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-xl bg-gradient-to-r from-primary/10 to-secondary/10 p-4 text-center">
                  <p className="text-sm font-semibold text-primaryDark">
                    🌟 Trusted by thousands of families · 📚 400+ curated titles · 🎪 50+ events annually
                  </p>
                </div>
              </div>

              <div className="flex justify-center">
                <div className="space-y-4 w-full">
                  <div className="animate-float rounded-3xl bg-white p-8 shadow-soft border-2 border-primary/10">
                    <div className="text-center">
                      <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 text-3xl mb-4">
                        🏪
                      </div>
                      <h4 className="font-display text-xl gradient-text">Our Experience</h4>
                      <p className="mt-3 text-sm text-muted">
                        A welcoming, kid-friendly space where faith and curiosity meet.
                        Every title and activity is selected to inspire confident learning
                        and joyful family moments.
                      </p>
                      <div className="mt-5 flex flex-wrap justify-center gap-2">
                        {['Trusted', 'Family-Centered', 'Educational'].map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full bg-gradient-to-r from-primary/10 to-secondary/10 px-4 py-2 text-xs font-semibold text-primaryDark"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="relative py-20 bg-gradient-to-br from-blue-50 via-white to-indigo-50">
          <div
            className="hero-svg-bg absolute inset-0 opacity-10"
            style={{
              backgroundImage: `url(${bg2.src})`,
              backgroundSize: '65% auto',
              backgroundRepeat: 'repeat'
            }}
          />
          {[
            'left-16 top-12 h-24 w-24 opacity-25',
            'right-20 top-16 h-32 w-32 opacity-20',
            'left-1/4 bottom-20 h-20 w-20 opacity-30',
            'right-1/3 bottom-12 h-28 w-28 opacity-25'
          ].map((classes, index) => (
            <Image
              key={`mission-design-${index}`}
              src={index % 2 === 0 ? design2 : design1}
              alt=""
              width={160}
              height={160}
              className={`hero-drift ${index % 2 === 0 ? '' : 'delay'} pointer-events-none absolute z-0 ${classes}`}
            />
          ))}
          <div className="relative z-10 mx-auto w-11/12 max-w-6xl">
            <div className="text-center">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-accentThree">
                Our Purpose
              </p>
              <h2 className="mt-4 font-display text-4xl">Mission & Vision</h2>
              <p className="mt-3 text-lg text-muted max-w-2xl mx-auto">
                Building the most trusted Islamic bookstore experience in North America,
                rooted in faith, learning, and community.
              </p>
            </div>

            <div className="mt-12 grid gap-8 md:grid-cols-2">
              <div className="animate-float rounded-3xl bg-white p-8 shadow-soft border-2 border-primary/10">
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 text-3xl">
                    🎯
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                    Our Mission
                  </p>
                </div>
                <h3 className="font-display text-2xl gradient-text">
                  Inspire lifelong faith through stories and learning
                </h3>
                <p className="mt-4 text-muted leading-relaxed">
                  We provide high-quality Islamic books, activities, and gifts that nurture
                  identity, curiosity, and love of knowledge in children and families.
                </p>
                <ul className="mt-4 space-y-2 text-sm">
                  {[
                    'Curate meaningful Islamic content',
                    'Support faith-based education',
                    'Create joyful learning experiences',
                    'Build strong community connections'
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="text-primary">✦</span>
                      <span className="text-muted">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="animate-float rounded-3xl bg-white p-8 shadow-soft border-2 border-secondary/10">
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-secondary/20 to-secondary/10 text-3xl">
                    🌟
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary">
                    Our Vision
                  </p>
                </div>
                <h3 className="font-display text-2xl gradient-text">
                  A connected community of readers, learners, and leaders
                </h3>
                <p className="mt-4 text-muted leading-relaxed">
                  We partner with schools, masajid, and families to make faith-centered
                  learning accessible, engaging, and joyful everywhere.
                </p>
                <ul className="mt-4 space-y-2 text-sm">
                  {[
                    'Expand our reach nationwide',
                    'Empower educators & parents',
                    'Foster reading communities',
                    'Celebrate Islamic excellence'
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="text-secondary">✦</span>
                      <span className="text-muted">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mt-8 rounded-xl bg-gradient-to-r from-primary/10 to-secondary/10 p-6 text-center">
              <p className="text-sm font-semibold text-primaryDark">
                💡 Faith-Centered · 📖 Knowledge-Driven · 🤝 Community-Focused · 🌱 Growth-Oriented
              </p>
            </div>
          </div>
        </section>

        <section className="relative py-20 bg-gradient-to-br from-amber-50 via-white to-orange-50">
          <div
            className="hero-svg-bg absolute inset-0 opacity-10"
            style={{
              backgroundImage: `url(${bg1.src})`,
              backgroundSize: '65% auto',
              backgroundRepeat: 'repeat'
            }}
          />
          {[
            'left-10 top-12 h-24 w-24 opacity-25',
            'right-16 top-16 h-32 w-32 opacity-20',
            'left-1/4 bottom-20 h-20 w-20 opacity-30',
            'right-1/3 bottom-12 h-28 w-28 opacity-25'
          ].map((classes, index) => (
            <Image
              key={`testimonial-design-${index}`}
              src={index % 2 === 0 ? design1 : design2}
              alt=""
              width={160}
              height={160}
              className={`hero-drift ${index % 2 === 0 ? '' : 'delay'} pointer-events-none absolute z-0 ${classes}`}
            />
          ))}
          <div className="relative z-10 mx-auto w-11/12 max-w-6xl">
            <div className="text-center">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-accentThree">
                Community Love
              </p>
              <h2 className="mt-4 font-display text-4xl">Testimonials</h2>
              <p className="mt-3 text-lg text-muted max-w-2xl mx-auto">
                Trusted by parents, educators, and young readers who see faith and learning
                come together with joy.
              </p>
            </div>

            <div className="mt-12 grid gap-8 md:grid-cols-2 items-center">
              <div className="space-y-6">
                <div className="animate-float rounded-3xl bg-white p-8 shadow-soft border-2 border-primary/10">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-accentThree/20 to-primary/20 text-2xl">
                      ⭐
                    </div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accentThree">
                      Parent Favorite
                    </p>
                  </div>
                  <p className="text-muted leading-relaxed">
                    "It feels like a boutique with heart. The curation is thoughtful,
                    and the kids are always excited to explore new books!"
                  </p>
                </div>

                <div className="rounded-2xl bg-white p-6 shadow-soft">
                  <h3 className="font-display text-xl gradient-text">Why Families Love Us</h3>
                  <ul className="mt-4 space-y-3 text-sm">
                    {[
                      'Carefully selected Islamic content',
                      'Age-appropriate recommendations',
                      'Engaging learning materials',
                      'Warm, knowledgeable service'
                    ].map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <span className="text-primary">✦</span>
                        <span className="text-muted">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="flex justify-center">
                <div className="w-full">
                  <div className="animate-float rounded-3xl bg-white p-8 shadow-soft border-2 border-secondary/10">
                    <div className="relative min-h-[240px] overflow-hidden">
                      {testimonials.map((testimonial, index) => (
                        <div
                          key={testimonial.name}
                          className={`absolute inset-0 transition-all duration-500 ${
                            index === activeTestimonial
                              ? 'translate-x-0 opacity-100'
                              : 'translate-x-6 opacity-0'
                          }`}
                        >
                          <div className="text-4xl mb-4 text-primary/20">"</div>
                          <p className="text-muted leading-relaxed italic">{testimonial.quote}</p>
                          <div className="mt-6 flex items-center gap-3">
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 font-semibold text-primaryDark">
                              {testimonial.name.charAt(0)}
                            </div>
                            <div>
                              <div className="font-semibold text-primaryDark">{testimonial.name}</div>
                              <div className="text-xs text-muted">{testimonial.role}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-8 flex items-center justify-between border-t border-black/5 pt-6">
                      <div className="flex gap-2">
                        {testimonials.map((_, index) => (
                          <button
                            key={`dot-${index}`}
                            className={`h-2 w-2 rounded-full transition ${
                              index === activeTestimonial ? 'bg-primary w-6' : 'bg-primary/20'
                            }`}
                            onClick={() => setActiveTestimonial(index)}
                            type="button"
                            aria-label={`Go to testimonial ${index + 1}`}
                          />
                        ))}
                      </div>
                      <div className="flex gap-2 text-xs font-semibold">
                        <button
                          className="rounded-full border border-primary/30 bg-primary/5 px-4 py-2 text-primaryDark transition hover:bg-primary/10"
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
                          className="rounded-full border border-primary/30 bg-primary/5 px-4 py-2 text-primaryDark transition hover:bg-primary/10"
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

                  <div className="mt-6 rounded-xl bg-gradient-to-r from-primary/10 to-secondary/10 p-4 text-center">
                    <p className="text-sm font-semibold text-primaryDark">
                      ⭐⭐⭐⭐⭐ Rated 5 stars by our community
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="relative py-20 bg-gradient-to-br from-emerald-50 via-white to-blue-50">
          <div
            className="hero-svg-bg absolute inset-0 opacity-10"
            style={{
              backgroundImage: `url(${bg1.src})`,
              backgroundSize: '65% auto',
              backgroundRepeat: 'repeat'
            }}
          />
          {[
            'left-10 top-12 h-24 w-24 opacity-25',
            'right-16 top-16 h-32 w-32 opacity-20',
            'left-1/4 bottom-20 h-20 w-20 opacity-30',
            'right-1/3 bottom-12 h-28 w-28 opacity-25'
          ].map((classes, index) => (
            <Image
              key={`catalog-design-${index}`}
              src={design2}
              alt=""
              width={160}
              height={160}
              className={`hero-drift ${index % 2 === 0 ? '' : 'delay'} pointer-events-none absolute z-0 ${classes}`}
            />
          ))}
          <div className="relative z-10 mx-auto w-11/12 max-w-6xl">
            <div className="text-center">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-accentThree">
                Browse Our Collection
              </p>
              <h2 className="mt-4 font-display text-4xl">View Our Digital Catalog</h2>
              <p className="mt-3 text-lg text-muted max-w-2xl mx-auto">
                Scan the QR code or click below to explore our complete collection of Islamic books,
                learning kits, and educational materials for all ages.
              </p>
            </div>

            <div className="mt-12 grid gap-8 md:grid-cols-2 items-center">
              <div className="flex justify-center">
                <div className="animate-float rounded-3xl bg-white p-8 shadow-soft border-2 border-primary/10">
                  <Image
                    src={catalogQR}
                    alt="Catalog QR Code"
                    width={280}
                    height={280}
                    className="rounded-2xl"
                  />
                  <p className="mt-4 text-center text-sm font-semibold text-muted">
                    Scan to view catalog
                  </p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="rounded-2xl bg-white p-6 shadow-soft">
                  <h3 className="font-display text-2xl gradient-text">Explore Our Catalog</h3>
                  <p className="mt-3 text-muted">
                    Browse through hundreds of carefully curated titles, from picture books
                    to chapter series, Islamic studies to STEM learning. Find the perfect
                    resource for your family, classroom, or library.
                  </p>
                  <ul className="mt-4 space-y-2 text-sm">
                    {[
                      'Age-appropriate Islamic literature',
                      'Educational kits and activities',
                      'Arabic learning resources',
                      'Character-building stories'
                    ].map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <span className="text-primary">✦</span>
                        <span className="text-muted">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <a
                  href="https://wa.me/c/16674377777"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-3 rounded-full bg-gradient-to-r from-green-500 to-green-600 px-8 py-4 font-semibold text-white shadow-soft transition hover:-translate-y-1 hover:shadow-lg"
                >
                  <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                  </svg>
                  View Catalog on WhatsApp
                </a>

                <div className="rounded-xl bg-gradient-to-r from-primary/10 to-secondary/10 p-4 text-center">
                  <p className="text-sm font-semibold text-primaryDark">
                    📚 Updated Weekly · 📦 Ready for Events · 🎁 Gift Wrapping Available
                  </p>
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
              <h2 className="font-display text-3xl">Publishers</h2>
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

      </main>

      <footer className="relative overflow-hidden bg-gradient-to-br from-[#1a1628] via-[#1f1b2e] to-[#251f3a] py-16 text-white">
        <div className="absolute inset-0 opacity-5">
          <div className="absolute left-1/4 top-1/4 h-96 w-96 rounded-full bg-primary blur-3xl" />
          <div className="absolute right-1/4 bottom-1/4 h-96 w-96 rounded-full bg-secondary blur-3xl" />
        </div>
        <div className="relative z-10 mx-auto w-11/12 max-w-6xl">
          <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <div className="flex items-center gap-3">
                <Image
                  src={logo}
                  alt="Eduvate Kids logo"
                  width={18}
                  height={18}
                  style={{ width: 'auto', height: 'auto' }}
                  className="drop-shadow-lg"
                />
                <div>
                  <h3 className="font-display text-xl font-bold">Eduvate Kids</h3>
                  <p className="text-sm text-white/60">Islamic Bookstore</p>
                </div>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-white/70">
                Curating Islamic children's literature and learning tools for families, educators, and communities across North America.
              </p>
              <div className="mt-6 flex gap-3">
                <a
                  href="https://wa.me/c/16674377777"
                  target="_blank"
                  rel="noreferrer"
                  className="group flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 backdrop-blur transition hover:bg-green-500 hover:scale-110"
                  aria-label="WhatsApp"
                >
                  <svg className="h-5 w-5 transition group-hover:scale-110" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                  </svg>
                </a>
                <a
                  href="https://www.instagram.com/eduvatekids?utm_source=ig_web_button_share_sheet&igsh=ZDNlZDc0MzIxNw=="
                  target="_blank"
                  rel="noreferrer"
                  className="group flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 backdrop-blur transition hover:bg-pink-500 hover:scale-110"
                  aria-label="Instagram"
                >
                  <svg className="h-5 w-5 transition group-hover:scale-110" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                  </svg>
                </a>
                <a
                  href="#"
                  className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/5 backdrop-blur opacity-40 cursor-not-allowed"
                  aria-label="TikTok (Coming Soon)"
                  title="Coming Soon"
                >
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
                  </svg>
                </a>
              </div>
            </div>

            <div>
              <h4 className="font-display text-lg font-semibold">Explore</h4>
              <div className="mt-4 space-y-3 text-sm">
                <a className="block text-white/70 transition hover:text-white hover:translate-x-1" href="#about">
                  About Us
                </a>
                <a className="block text-white/70 transition hover:text-white hover:translate-x-1" href="#partners">
                  Publishers
                </a>
                <Link className="block text-white/70 transition hover:text-white hover:translate-x-1" href="/dashboard">
                  Dashboard
                </Link>
                <Link className="block text-white/70 transition hover:text-white hover:translate-x-1" href="/contact-us">
                  Contact Us
                </Link>
              </div>
            </div>

            <div>
              <h4 className="font-display text-lg font-semibold">Resources</h4>
              <div className="mt-4 space-y-3 text-sm">
                <Link className="block text-white/70 transition hover:text-white hover:translate-x-1" href="/faqs">
                  FAQs
                </Link>
                <Link className="block text-white/70 transition hover:text-white hover:translate-x-1" href="/policies">
                  Policies & Terms
                </Link>
                <a className="block text-white/70 transition hover:text-white hover:translate-x-1" href="https://wa.me/c/16674377777" target="_blank" rel="noreferrer">
                  Digital Catalog
                </a>
                <Link className="block text-white/70 transition hover:text-white hover:translate-x-1" href="/auth/login">
                  Admin Login
                </Link>
              </div>
            </div>

            <div>
              <h4 className="font-display text-lg font-semibold">Location</h4>
              <div className="mt-4 space-y-3 text-sm text-white/70">
                <p className="flex items-start gap-2">
                  <span className="text-primary">📍</span>
                  <span>Maryland, USA</span>
                </p>
                <Link
                  href="/book-event"
                  className="group mt-4 block rounded-xl bg-gradient-to-r from-accentThree/20 to-primary/20 backdrop-blur p-5 border border-accentThree/30 transition hover:from-accentThree/30 hover:to-primary/30 hover:border-accentThree/50 hover:-translate-y-0.5"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-white flex items-center gap-2">
                        <span className="text-lg">🎪</span>
                        Book an Event
                      </p>
                      <p className="mt-1 text-xs text-white/70">
                        School fairs, masjid events & more
                      </p>
                    </div>
                    <svg className="h-5 w-5 text-white/70 group-hover:text-white group-hover:translate-x-1 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>
              </div>
            </div>
          </div>

          <div className="mt-12 border-t border-white/10 pt-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-white/50">
              <p>&copy; 2026 Eduvate Kids. All rights reserved.</p>
              <div className="flex flex-wrap gap-6">
                <Link href="/policies" className="hover:text-white transition">
                  Privacy Policy
                </Link>
                <Link href="/policies" className="hover:text-white transition">
                  Terms of Service
                </Link>
                <Link href="/faqs" className="hover:text-white transition">
                  Help Center
                </Link>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
