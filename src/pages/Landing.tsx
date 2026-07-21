import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Shield, Zap, CreditCard, Lock, TrendingUp, Wallet, Receipt,
  ChevronsRight, Star, Phone, Mail, MapPin, Menu, X, Building2,
  Briefcase, HandCoins, Smartphone, Clock, BadgeCheck, ArrowRight,
  Facebook, Twitter, Linkedin, Instagram,
} from "lucide-react";
import heroPeople from "@/assets/hero-people.jpg";
import aboutMeeting from "@/assets/about-meeting.jpg";
import branchImg from "@/assets/branch.jpg";
import cardImg from "@/assets/card-feature.jpg";
import logoImg from "@/assets/logo.png";
import customer1 from "@/assets/customer-1.jpg";
import customer2 from "@/assets/customer-2.jpg";
import customer3 from "@/assets/customer-3.jpg";

/* ---------- Logo (unchanged asset) ---------- */
const Logo = ({ light = false }: { light?: boolean }) => (
  <div className="flex items-center gap-2.5">
    <img src={logoImg} alt="Lyncrest Digital Bank logo" width={44} height={44} className="w-11 h-11 object-contain" />
    <div className="leading-tight">
      <div className={`font-extrabold text-lg tracking-tight ${light ? "text-white" : "text-primary"}`}>Lyncrest</div>
      <div className="text-xs font-bold text-[hsl(var(--gold))] -mt-0.5">Fargo</div>
    </div>
  </div>
);

/* ---------- Pill button styles ---------- */
const pillPrimary =
  "rounded-full bg-[hsl(var(--primary-glow))] hover:bg-[hsl(var(--primary-glow))]/90 text-white font-semibold px-7 h-14 text-base shadow-lg shadow-[hsl(var(--primary-glow))]/30";
const pillOutline =
  "rounded-full border-2 border-white/80 text-white hover:bg-white hover:text-primary font-semibold px-7 h-14 text-base bg-transparent";

/* ---------- Header ---------- */
const Header = () => {
  const [open, setOpen] = useState(false);
  const links = [
    { label: "Home", href: "#home" },
    { label: "About", href: "#about" },
    { label: "Services", href: "#services" },
    { label: "Why Us", href: "#why" },
    { label: "Contact", href: "#contact" },
  ];
  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-border">
      <div className="container mx-auto px-4 h-20 flex items-center justify-between">
        <Link to="/"><Logo /></Link>
        <nav className="hidden lg:flex items-center gap-8">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="text-sm font-semibold text-foreground/80 hover:text-primary">
              {l.label}
            </a>
          ))}
        </nav>
        <div className="hidden lg:flex items-center gap-3">
          <Link to="/auth"><Button variant="ghost" className="font-semibold">Login</Button></Link>
          <Link to="/auth?mode=signup">
            <Button className="rounded-full bg-[hsl(var(--primary-glow))] hover:bg-[hsl(var(--primary-glow))]/90 font-semibold px-6">
              Open Account
            </Button>
          </Link>
        </div>
        <button onClick={() => setOpen(!open)} className="lg:hidden p-2 -mr-2" aria-label="Toggle menu">
          {open ? <X className="w-7 h-7 text-primary" /> : <Menu className="w-7 h-7 text-primary" />}
        </button>
      </div>
      {open && (
        <div className="lg:hidden border-t border-border bg-white">
          <div className="container mx-auto px-4 py-4 flex flex-col gap-1">
            {links.map((l) => (
              <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="py-3 font-semibold text-foreground/80">
                {l.label}
              </a>
            ))}
            <div className="flex gap-2 pt-3">
              <Link to="/auth" className="flex-1"><Button variant="outline" className="w-full rounded-full">Login</Button></Link>
              <Link to="/auth?mode=signup" className="flex-1">
                <Button className="w-full rounded-full bg-[hsl(var(--primary-glow))] hover:bg-[hsl(var(--primary-glow))]/90">Open Account</Button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

/* ---------- Hero ---------- */
const Hero = () => (
  <section id="home" className="relative overflow-hidden">
    <img
      src={heroPeople}
      alt="Smiling Lyncrest Digital Bank customers giving thumbs up"
      width={1920}
      height={1080}
      className="absolute inset-0 w-full h-full object-cover"
    />
    {/* Dark navy overlay */}
    <div className="absolute inset-0 bg-gradient-to-b from-primary/85 via-primary/70 to-primary/90" />
    <div className="relative container mx-auto px-4 py-24 md:py-36 lg:py-44 text-center text-white">
      <p className="text-xs md:text-sm font-bold tracking-[0.3em] text-[hsl(var(--gold))] mb-5">
        SIMPLE. TRANSPARENT. SECURE.
      </p>
      <p className="text-2xl md:text-4xl font-extrabold tracking-tight mb-4">
        LYNCREST <span className="text-[hsl(var(--gold))]">FARGO</span>
      </p>
      <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold leading-tight max-w-4xl mx-auto mb-10">
        Your Banking and Financial Solution
      </h1>
      <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
        <Link to="/auth"><Button className={pillPrimary}>Account Login <ChevronsRight className="ml-1 w-5 h-5" /></Button></Link>
        <Link to="/auth?mode=signup"><Button className={pillPrimary}>Open Account <ChevronsRight className="ml-1 w-5 h-5" /></Button></Link>
      </div>
    </div>
  </section>
);

/* ---------- Trust strip ---------- */
const TrustStrip = () => {
  const items = [
    { icon: Shield, label: "FDIC Insured" },
    { icon: Lock, label: "256-bit Encryption" },
    { icon: Clock, label: "24/7 Support" },
    { icon: BadgeCheck, label: "25+ Years Trusted" },
  ];
  return (
    <section className="bg-secondary border-y border-border">
      <div className="container mx-auto px-4 py-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        {items.map((it) => (
          <div key={it.label} className="flex items-center justify-center gap-3 text-primary">
            <it.icon className="w-6 h-6 text-[hsl(var(--gold))]" />
            <span className="font-semibold text-sm md:text-base">{it.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
};

/* ---------- About ---------- */
const About = () => (
  <section id="about" className="py-16 md:py-24 bg-background">
    <div className="container mx-auto px-4 grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
      <div className="relative">
        <img
          src={aboutMeeting}
          alt="Lyncrest Digital Bank advisors meeting with a client"
          width={1600}
          height={900}
          loading="lazy"
          className="w-full h-auto rounded-2xl shadow-[var(--shadow-card)]"
        />
        {/* 25+ Years badge */}
        <div className="absolute -bottom-6 -right-2 sm:right-6 w-32 h-32 sm:w-40 sm:h-40 rounded-full bg-[hsl(var(--primary-glow))] text-white flex flex-col items-center justify-center text-center shadow-2xl ring-8 ring-background">
          <div className="text-3xl sm:text-4xl font-extrabold leading-none">25+</div>
          <div className="text-xs sm:text-sm font-semibold mt-1 leading-tight px-2">Years of<br />Experience</div>
        </div>
      </div>
      <div>
        <p className="text-sm font-bold tracking-widest text-[hsl(var(--primary-glow))] mb-4">ABOUT COMPANY</p>
        <h2 className="text-3xl md:text-5xl font-extrabold leading-tight mb-6 text-foreground">
          Small Business Loans For a Daily Expenses
        </h2>
        <p className="text-base md:text-lg text-muted-foreground leading-relaxed mb-4">
          At Lyncrest Digital Bank, we believe that your bank should support your dreams and aspirations.
          That's why we have developed convenient mortgage solutions to help make your dream of owning
          your own business a reality.
        </p>
        <p className="text-base md:text-lg text-muted-foreground leading-relaxed mb-8">
          Whether you are a first time investor, or thinking about property purchase as an investment,
          we have convenient mortgage solutions for you, backed by 25 years of trusted financial expertise.
        </p>
        <Link to="/auth?mode=signup">
          <Button className="rounded-full bg-[hsl(var(--primary-glow))] hover:bg-[hsl(var(--primary-glow))]/90 font-semibold px-8 h-12">
            Learn More <ArrowRight className="ml-2 w-4 h-4" />
          </Button>
        </Link>
      </div>
    </div>
  </section>
);

/* ---------- Services ---------- */
const Services = () => {
  const services = [
    { icon: Wallet, title: "Personal Banking", desc: "Checking, high-yield savings, and instant transfers built for everyday life." },
    { icon: Briefcase, title: "Business Banking", desc: "Business accounts, payroll, and merchant services to help your company grow." },
    { icon: HandCoins, title: "Loans & Mortgages", desc: "Home, auto, and small business loans with competitive rates and quick approval." },
    { icon: CreditCard, title: "Cards & Payments", desc: "Virtual and physical debit cards with instant freeze, limits, and rewards." },
  ];
  return (
    <section id="services" className="py-16 md:py-24 bg-secondary">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <p className="text-sm font-bold tracking-widest text-[hsl(var(--primary-glow))] mb-3">OUR SERVICES</p>
          <h2 className="text-3xl md:text-5xl font-extrabold text-foreground">Banking that fits every need</h2>
          <p className="text-muted-foreground mt-4 text-lg">From your first paycheck to your first business — we're with you.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {services.map((s) => (
            <div key={s.title} className="group bg-card rounded-2xl p-7 shadow-[var(--shadow-soft)] hover:shadow-[var(--shadow-card)] transition border border-border">
              <div className="w-14 h-14 rounded-xl bg-[hsl(var(--primary-glow))]/10 text-[hsl(var(--primary-glow))] flex items-center justify-center mb-5">
                <s.icon className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold mb-2 text-foreground">{s.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">{s.desc}</p>
              <a href="#" className="text-sm font-bold text-[hsl(var(--primary-glow))] inline-flex items-center gap-1 group-hover:gap-2 transition-all">
                Learn more <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

/* ---------- Why Choose Us ---------- */
const WhyUs = () => {
  const features = [
    { icon: Shield, title: "Bank-grade Security", desc: "Multi-factor auth, biometric login, and 24/7 fraud monitoring keep your money safe." },
    { icon: Zap, title: "Instant Transfers", desc: "Move money to anyone in seconds — domestically or internationally, free between members." },
    { icon: Receipt, title: "No Hidden Fees", desc: "Transparent pricing. No monthly maintenance fees, no surprise charges, ever." },
    { icon: Smartphone, title: "Mobile First", desc: "Deposit checks, pay bills, and manage cards from a beautiful app on any device." },
  ];
  return (
    <section id="why" className="py-16 md:py-24 bg-background">
      <div className="container mx-auto px-4 grid lg:grid-cols-2 gap-12 items-center">
        <img
          src={branchImg}
          alt="Lyncrest Digital Bank branch interior"
          width={1600}
          height={1067}
          loading="lazy"
          className="w-full h-auto rounded-2xl shadow-[var(--shadow-card)] order-2 lg:order-1"
        />
        <div className="order-1 lg:order-2">
          <p className="text-sm font-bold tracking-widest text-[hsl(var(--primary-glow))] mb-3">WHY CHOOSE US</p>
          <h2 className="text-3xl md:text-5xl font-extrabold text-foreground mb-8">A bank you can actually trust</h2>
          <div className="space-y-6">
            {features.map((f) => (
              <div key={f.title} className="flex gap-4">
                <div className="shrink-0 w-12 h-12 rounded-xl bg-primary text-white flex items-center justify-center">
                  <f.icon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-foreground mb-1">{f.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

/* ---------- Stats ---------- */
const Stats = () => {
  const stats = [
    { num: "2.4M+", label: "Active Customers" },
    { num: "$48B", label: "Assets Managed" },
    { num: "320+", label: "Branches Worldwide" },
    { num: "25+", label: "Years of Service" },
  ];
  return (
    <section className="py-16 md:py-20 bg-primary text-primary-foreground relative overflow-hidden">
      <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "var(--gradient-primary)" }} />
      <div className="container mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-8 relative">
        {stats.map((s) => (
          <div key={s.label} className="text-center">
            <div className="text-4xl md:text-6xl font-extrabold text-[hsl(var(--gold))] tabular">{s.num}</div>
            <div className="mt-2 text-sm md:text-base font-semibold opacity-90">{s.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
};

/* ---------- Card feature strip ---------- */
const CardStrip = () => (
  <section className="py-16 md:py-24 bg-secondary">
    <div className="container mx-auto px-4 grid lg:grid-cols-2 gap-12 items-center">
      <div>
        <p className="text-sm font-bold tracking-widest text-[hsl(var(--primary-glow))] mb-3">DEBIT & CREDIT</p>
        <h2 className="text-3xl md:text-5xl font-extrabold mb-6 text-foreground">Cards designed for modern life</h2>
        <ul className="space-y-3 mb-8">
          {[
            "Instant virtual cards for online shopping",
            "Freeze, unfreeze, and set limits in one tap",
            "2% cashback on every purchase",
            "Zero foreign transaction fees",
          ].map((t) => (
            <li key={t} className="flex items-start gap-3 text-foreground">
              <BadgeCheck className="w-5 h-5 text-[hsl(var(--primary-glow))] shrink-0 mt-0.5" />
              <span>{t}</span>
            </li>
          ))}
        </ul>
        <Link to="/auth?mode=signup">
          <Button className="rounded-full bg-primary hover:bg-primary/90 font-semibold px-8 h-12">Get Your Card</Button>
        </Link>
      </div>
      <img src={cardImg} alt="Lyncrest Digital Bank premium debit card" width={1600} height={900} loading="lazy"
        className="w-full h-auto rounded-2xl shadow-[var(--shadow-card)]" />
    </div>
  </section>
);

/* ---------- Testimonials ---------- */
const Testimonials = () => {
  const quotes = [
    { name: "Sarah Mitchell", role: "Small Business Owner", img: customer1, quote: "Lyncrest Digital Bank approved my business loan in 48 hours. Their team genuinely cares about helping local businesses succeed." },
    { name: "James Carter", role: "Software Engineer", img: customer2, quote: "The mobile app is incredible. I haven't stepped foot in a branch in years and everything just works." },
    { name: "Aisha Patel", role: "First-time Homebuyer", img: customer3, quote: "From mortgage pre-approval to closing, the process was smooth and transparent. They explained every single step." },
  ];
  return (
    <section className="py-16 md:py-24 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <p className="text-sm font-bold tracking-widest text-[hsl(var(--primary-glow))] mb-3">TESTIMONIALS</p>
          <h2 className="text-3xl md:text-5xl font-extrabold text-foreground">Trusted by 2.4 million customers</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {quotes.map((q) => (
            <div key={q.name} className="bg-card rounded-2xl p-7 shadow-[var(--shadow-soft)] border border-border">
              <div className="flex gap-1 mb-4">
                {[...Array(5)].map((_, i) => <Star key={i} className="w-5 h-5 fill-[hsl(var(--gold))] text-[hsl(var(--gold))]" />)}
              </div>
              <p className="text-foreground/90 leading-relaxed mb-6">"{q.quote}"</p>
              <div className="flex items-center gap-3">
                <img src={q.img} alt={q.name} width={48} height={48} loading="lazy" className="w-12 h-12 rounded-full object-cover" />
                <div>
                  <div className="font-bold text-foreground">{q.name}</div>
                  <div className="text-sm text-muted-foreground">{q.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

/* ---------- FAQ ---------- */
const FAQ = () => {
  const faqs = [
    { q: "How do I open an account?", a: "Click 'Open Account', complete the secure signup form, and upload a selfie for identity verification. Most accounts are approved within 24 hours." },
    { q: "Is my money FDIC insured?", a: "Yes. All deposits at Lyncrest Digital Bank are insured up to $250,000 per depositor by the FDIC." },
    { q: "Are there any monthly fees?", a: "No. Our checking and savings accounts have zero monthly maintenance fees and no minimum balance requirements." },
    { q: "How fast are transfers?", a: "Internal transfers between Lyncrest members are instant. External transfers via ACH typically settle within 1-2 business days." },
    { q: "Can I get a loan as a small business owner?", a: "Yes. We offer small business loans starting at $5,000 with competitive rates and decisions in as little as 48 hours." },
    { q: "How do I contact support?", a: "Our support team is available 24/7 by live chat and secure email at support@Lyncrestdigital.online. Average response time is under 2 minutes." },
  ];
  return (
    <section className="py-16 md:py-24 bg-secondary">
      <div className="container mx-auto px-4 max-w-3xl">
        <div className="text-center mb-10">
          <p className="text-sm font-bold tracking-widest text-[hsl(var(--primary-glow))] mb-3">FAQ</p>
          <h2 className="text-3xl md:text-5xl font-extrabold text-foreground">Questions? We have answers.</h2>
        </div>
        <Accordion type="single" collapsible className="bg-card rounded-2xl border border-border px-6 shadow-[var(--shadow-soft)]">
          {faqs.map((f, i) => (
            <AccordionItem key={i} value={`item-${i}`} className="border-border">
              <AccordionTrigger className="text-left font-semibold text-foreground hover:no-underline py-5">{f.q}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground leading-relaxed pb-5">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
};

/* ---------- CTA banner ---------- */
const CTA = () => (
  <section className="py-16 md:py-20 relative overflow-hidden" style={{ backgroundImage: "var(--gradient-primary)" }}>
    <div className="container mx-auto px-4 text-center text-white">
      <h2 className="text-3xl md:text-5xl font-extrabold mb-4">Ready to bank smarter?</h2>
      <p className="text-lg opacity-90 mb-8 max-w-xl mx-auto">Open your Lyncrest Digital Bank account in minutes. No fees, no minimums, no hassle.</p>
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <Link to="/auth?mode=signup"><Button className={pillPrimary}>Open Account <ChevronsRight className="ml-1 w-5 h-5" /></Button></Link>
        <Link to="/auth"><Button className={pillOutline}>Account Login <ChevronsRight className="ml-1 w-5 h-5" /></Button></Link>
      </div>
    </div>
  </section>
);

/* ---------- Footer ---------- */
const Footer = () => {
  const cols = [
    { title: "Company", links: ["About Us", "Careers", "Press", "Investors"] },
    { title: "Products", links: ["Checking", "Savings", "Loans", "Cards", "Business"] },
    { title: "Support", links: ["Help Center", "Contact", "Security", "Accessibility"] },
    { title: "Legal", links: ["Privacy", "Terms", "Disclosures", "FDIC Notice"] },
  ];
  return (
    <footer id="contact" className="bg-primary text-primary-foreground pt-16 pb-8">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-2 lg:grid-cols-6 gap-10 pb-12 border-b border-white/15">
          <div className="lg:col-span-2">
            <Logo light />
            <p className="text-sm opacity-80 mt-4 leading-relaxed max-w-xs">
              Lyncrest Digital Bank. Trusted banking, transparent pricing, and 25+ years of helping families and businesses thrive.
            </p>
            <div className="flex gap-3 mt-5">
              {[Facebook, Twitter, Linkedin, Instagram].map((I, i) => (
                <a key={i} href="#" className="w-10 h-10 rounded-full bg-white/10 hover:bg-[hsl(var(--gold))] hover:text-primary flex items-center justify-center transition" aria-label="Social">
                  <I className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>
          {cols.map((c) => (
            <div key={c.title}>
              <h4 className="font-bold mb-4 text-[hsl(var(--gold))]">{c.title}</h4>
              <ul className="space-y-2 text-sm opacity-85">
                {c.links.map((l) => <li key={l}><a href="#" className="hover:text-[hsl(var(--gold))] hover:opacity-100">{l}</a></li>)}
              </ul>
            </div>
          ))}
        </div>
        <div className="pt-6 flex flex-col md:flex-row gap-4 items-center justify-between text-sm opacity-80">
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> support@Lyncrestdigital.online</span>
          </div>
        </div>
        <div className="text-xs opacity-60 text-center mt-6">© {new Date().getFullYear()} Lyncrest Digital Bank. All rights reserved.</div>
      </div>
    </footer>
  );
};

/* ---------- Page ---------- */
export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <Hero />
        <About />
        <Services />
        <WhyUs />
        <CardStrip />
        <Testimonials />
        <FAQ />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
