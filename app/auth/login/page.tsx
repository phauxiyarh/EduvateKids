import bg4 from '../../../assets/bg4.png'

export default function AdminLoginPage() {
  return (
    <div className="relative min-h-screen text-ink">
      <div
        className="hero-svg-bg absolute inset-0 opacity-45"
        style={{
          backgroundImage: `url(${bg4.src})`,
          backgroundSize: '75% auto',
          backgroundRepeat: 'repeat'
        }}
      />
      <main className="relative z-10 mx-auto flex min-h-screen w-11/12 max-w-5xl items-center justify-center py-16">
        <div className="grid w-full gap-10 rounded-3xl bg-white p-10 shadow-soft md:grid-cols-[1.1fr_0.9fr]">
          <section>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-accentThree">
              Admin Portal
            </p>
            <h1 className="mt-4 font-display text-3xl">Sign in to Eduvate Kids</h1>
            <p className="mt-3 text-muted">
              Access inventory, event sales, and POS dashboards. This is a
              static demo login screen; hook into NextAuth for production.
            </p>
            <ul className="mt-6 space-y-3 text-sm">
              {[
                'Inventory control and pricing tiers.',
                'Event-based sales and profitability.',
                'Low stock alerts and best sellers.'
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="text-primary">✦</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-2xl border border-primary/10 bg-cream p-6">
            <form className="grid gap-4 text-sm">
              <label className="grid gap-1 font-semibold">
                Email
                <input
                  className="rounded-xl border border-black/10 bg-white px-4 py-3"
                  type="email"
                  placeholder="admin@eduvatekids.com"
                />
              </label>
              <label className="grid gap-1 font-semibold">
                Password
                <input
                  className="rounded-xl border border-black/10 bg-white px-4 py-3"
                  type="password"
                  placeholder="••••••••"
                />
              </label>
              <button
                className="rounded-full bg-gradient-to-r from-primary to-secondary px-6 py-3 font-semibold text-white"
                type="button"
              >
                Sign In
              </button>
              <a
                className="rounded-full border border-primary px-6 py-3 text-center font-semibold text-primaryDark"
                href="/dashboard"
              >
                Continue to Dashboard Demo
              </a>
            </form>
            <div className="mt-6 rounded-xl bg-white p-4 text-xs text-muted">
              Demo credentials: admin@eduvatekids.com / admin123
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
