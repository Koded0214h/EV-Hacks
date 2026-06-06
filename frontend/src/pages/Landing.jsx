import { useState } from 'react'
import {
  Zap, ArrowRight, Database, Map, TrendingUp,
  Calculator, FileText, Wifi, Layers, Target,
  Cloud, Server, Send, Globe, Activity, Link, GitBranch, X as XIcon,
} from 'lucide-react'
import '../App.css'

// ── Small inline icons (map UI) ────────────────────────────

const IChart = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path d="M2 2v16h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M5 13l4-4.5 3.5 2.5L17 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)
const IPin = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path d="M10 2C7.24 2 5 4.24 5 7c0 4.42 5 11 5 11s5-6.58 5-11c0-2.76-2.24-5-5-5z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="10" cy="7" r="1.8" stroke="currentColor" strokeWidth="1.8"/>
  </svg>
)
const IArrow = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
    <path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)
const IFilter = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
    <path d="M1 2.5h11M3 6.5h7M5 10.5h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
  </svg>
)
const ILocate = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
    <circle cx="6.5" cy="6.5" r="2.5" stroke="currentColor" strokeWidth="1.4"/>
    <path d="M6.5 1v2M6.5 10v2M1 6.5h2M10 6.5h2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
  </svg>
)
const IList = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
    <path d="M1.5 3.5h10M1.5 6.5h10M1.5 9.5h7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
  </svg>
)
const IZap = ({ size = 10 }) => (
  <svg width={size} height={size} viewBox="0 0 10 10" fill="currentColor" aria-hidden="true">
    <path d="M6 1L2 6h3.5L4 9.5 8.5 4H5L6 1z"/>
  </svg>
)

// ── Animated Map Mock ─────────────────────────────────────

function MapMock() {
  return (
    <div className="map-mock" aria-hidden="true">
      <div className="map-topbar">
        <span className="map-topbar-title">Stations near you</span>
        <span className="map-topbar-badge">4 available</span>
      </div>

      <div className="map-canvas">
        <div className="mroad mroad-h1" />
        <div className="mroad mroad-h2" />
        <div className="mroad mroad-v1" />
        <div className="mroad mroad-v2" />
        <div className="mroad mroad-d1" />
        <div className="mroad mroad-d2" />

        <div className="mpin mpin--green" style={{ top:'16%', left:'20%' }}>
          <span className="mpin-ring" /><span className="mpin-body"><IZap /></span>
        </div>
        <div className="mpin mpin--green" style={{ top:'30%', left:'58%' }}>
          <span className="mpin-ring" /><span className="mpin-body"><IZap /></span>
        </div>
        <div className="mpin mpin--amber" style={{ top:'52%', left:'76%' }}>
          <span className="mpin-body"><IZap /></span>
        </div>
        <div className="mpin mpin--green" style={{ top:'65%', left:'36%' }}>
          <span className="mpin-ring mpin-ring--delay" /><span className="mpin-body"><IZap /></span>
        </div>
        <div className="mpin mpin--red" style={{ top:'76%', left:'66%' }}>
          <span className="mpin-body"><IZap /></span>
        </div>
        <div className="mpin mpin--green" style={{ top:'20%', left:'82%' }}>
          <span className="mpin-ring" /><span className="mpin-body"><IZap /></span>
        </div>

        <div className="mloc">
          <span className="mloc-ring" /><span className="mloc-dot" />
        </div>

        <div className="mcard">
          <div className="mcard-status mcard-status--green" />
          <div className="mcard-info">
            <div className="mcard-name">Lekki Station 3</div>
            <div className="mcard-meta">AC Level 2 · 0.8 km away</div>
          </div>
        </div>
      </div>

      <div className="map-dock">
        <button className="mdock-btn"><IFilter /><span>Filter</span></button>
        <button className="mdock-btn mdock-btn--active"><ILocate /><span>Locate</span></button>
        <button className="mdock-btn"><IList /><span>List</span></button>
      </div>
    </div>
  )
}

// ── Nav ─────────────────────────────────────────────────────

function Nav() {
  return (
    <nav className="nav">
      <div className="nav-inner">
        <a href="/" className="wordmark">
          <span className="wordmark-bolt"><Zap size={13} /></span>
          EV Hacks
        </a>
        <div className="nav-actions">
          <a href="#/dashboard" className="nav-cta nav-cta--solid">Investor Dashboard</a>
          <a href="#/driver"    className="nav-cta nav-cta--ghost">Driver View</a>
        </div>
      </div>
    </nav>
  )
}

// ── Hero ─────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="hero">
      <div className="hero-bg-grid" aria-hidden="true" />
      <div className="hero-bg-glow"  aria-hidden="true" />
      <div className="hero-inner">

        <div className="hero-text">
          <h1 className="headline">
            Nigeria's EV<br />Intelligence Layer
          </h1>
          <p className="subtext">
            Over 20,000 electric vehicles move through Nigerian roads — but fewer
            than 50 charging stations are mapped and accessible. EV Hacks gives
            investors the intelligence to build where it matters, and drivers the
            confidence to go further.
          </p>
          <div className="doors">
            <a href="#/dashboard" className="door">
              <div className="door-icon"><IChart /></div>
              <div className="door-body">
                <span className="door-role">Investor &amp; Planner</span>
                <h2 className="door-title">Investor Dashboard</h2>
                <p className="door-desc">Analyse demand zones, project ROI, plant stations with AI briefs.</p>
              </div>
              <span className="door-cta">Enter <IArrow /></span>
            </a>
            <a href="#/driver" className="door">
              <div className="door-icon"><IPin /></div>
              <div className="door-body">
                <span className="door-role">Driver</span>
                <h2 className="door-title">Driver View</h2>
                <p className="door-desc">Find stations, check live availability, get directions in one tap.</p>
              </div>
              <span className="door-cta">Enter <IArrow /></span>
            </a>
          </div>
        </div>

        <div className="hero-visual">
          <MapMock />
        </div>

      </div>
    </section>
  )
}

// ── Stats Bar ────────────────────────────────────────────────

function StatsBar() {
  const stats = [
    { num: '20,000+', label: 'Electric vehicles on Nigerian roads' },
    { num: '< 50',    label: 'Mapped charging stations nationwide' },
    { num: '₦13M',    label: 'Government EV adoption target by 2050' },
  ]
  return (
    <section className="stats-bar">
      {stats.map(({ num, label }, i) => (
        <div key={num} style={{ display:'contents' }}>
          <div className="stat-item">
            <span className="stat-num">{num}</span>
            <span className="stat-lbl">{label}</span>
          </div>
          {i < stats.length - 1 && <div className="stat-div" />}
        </div>
      ))}
    </section>
  )
}

// ── How It Works ─────────────────────────────────────────────

function HowItWorks() {
  const steps = [
    { icon: <Database size={22} />, n:'01', title:'Collect the Data',        desc:'Mobility pings, EV registrations, and POI data aggregated in real time across Nigerian roads and cities.' },
    { icon: <Map size={22} />,      n:'02', title:'Map the Infrastructure',  desc:'Demand zones layered over road networks. See where EV traffic is densest and charging infrastructure is thinnest.' },
    { icon: <TrendingUp size={22}/>, n:'03', title:'Decide Where to Build',  desc:'ROI projections, AI-powered investment briefs, and zone rankings — everything an investor needs to act with confidence.' },
  ]
  return (
    <section className="how-section">
      <div className="section-inner">
        <div className="section-hd">
          <div className="section-eyebrow">How it works</div>
          <h2 className="section-title">From raw data to investment-grade intelligence</h2>
        </div>
        <div className="how-steps">
          {steps.map(({ icon, n, title, desc }, i) => (
            <div className="how-step" key={n}>
              <div className="how-step-icon">{icon}</div>
              <div className="how-step-num">{n}</div>
              <h3 className="how-step-title">{title}</h3>
              <p className="how-step-desc">{desc}</p>
              {i < steps.length - 1 && <div className="how-connector" />}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Two Products ─────────────────────────────────────────────

function InvestorMockup() {
  return (
    <div className="mockup mockup--investor">
      <div className="mockup-sidebar">
        <div className="mockup-logo" />
        {['Overview','Stations','Rankings','ROI','Reports'].map(l => (
          <div className={`mockup-navitem${l==='Overview'?' mockup-navitem--active':''}`} key={l} />
        ))}
        <div className="mockup-stats-mini">
          {[...Array(4)].map((_,i) => <div className="mockup-stat-card" key={i} />)}
        </div>
      </div>
      <div className="mockup-map">
        <div className="mockup-zone mockup-zone--hot"  style={{ top:'20%', left:'25%', width:90, height:70 }} />
        <div className="mockup-zone mockup-zone--warm" style={{ top:'45%', left:'55%', width:70, height:55 }} />
        <div className="mockup-zone mockup-zone--cool" style={{ top:'60%', left:'18%', width:60, height:50 }} />
        <div className="mockup-zone mockup-zone--warm" style={{ top:'30%', left:'65%', width:50, height:40 }} />
        <div className="mockup-pin" style={{ top:'28%', left:'38%' }} />
        <div className="mockup-pin mockup-pin--amber" style={{ top:'52%', left:'62%' }} />
        <div className="mockup-dock-investor">
          {['Plant','Heatmap','Legend'].map(l => <span key={l}>{l}</span>)}
        </div>
      </div>
    </div>
  )
}

function DriverMockup() {
  return (
    <div className="mockup mockup--driver">
      <div className="mockup-map-full">
        <div className="mockup-road mockup-road-h" style={{ top:'40%' }} />
        <div className="mockup-road mockup-road-h" style={{ top:'65%' }} />
        <div className="mockup-road mockup-road-v" style={{ left:'45%' }} />
        {[
          { t:'22%', l:'28%', c:'green' },
          { t:'35%', l:'60%', c:'green' },
          { t:'55%', l:'78%', c:'amber' },
          { t:'48%', l:'35%', c:'red'   },
          { t:'70%', l:'55%', c:'green' },
        ].map(({ t, l, c }, i) => (
          <div className={`dpin dpin--${c}`} style={{ top:t, left:l }} key={i} />
        ))}
        <div className="dloc" />
        <div className="driver-sheet">
          <div className="driver-sheet-handle" />
          <div className="driver-sheet-title">4 stations near you</div>
          <div className="driver-sheet-cards">
            {['Lekki Station 3','VI Charge Hub','Ikoyi Fast'].map(n => (
              <div className="driver-card" key={n}>
                <div className="driver-card-dot driver-card-dot--green" />
                <span>{n}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function TwoProducts() {
  const products = [
    {
      tag: 'For Investors & Planners',
      title: 'Investor Dashboard',
      desc: 'Demand heatmaps, ROI projections, AI investment briefs, and a station planting tool — built for infrastructure decisions at speed.',
      cta: 'Open Dashboard', href: '#/dashboard',
      mockup: <InvestorMockup />,
    },
    {
      tag: 'For Drivers',
      title: 'Driver View',
      desc: 'Real-time map of every charging station near you. Live availability, community reports, and one-tap directions.',
      cta: 'Find Stations', href: '#/driver',
      mockup: <DriverMockup />,
    },
  ]
  return (
    <section className="products-section">
      <div className="section-inner">
        <div className="section-hd">
          <div className="section-eyebrow">The platform</div>
          <h2 className="section-title">Two views. One platform.</h2>
          <p className="section-sub">Built for every actor in Nigeria's EV ecosystem.</p>
        </div>
        <div className="products-grid">
          {products.map(({ tag, title, desc, cta, href, mockup }) => (
            <div className="product-card" key={title}>
              <div className="product-mockup">{mockup}</div>
              <div className="product-body">
                <span className="product-tag">{tag}</span>
                <h3 className="product-title">{title}</h3>
                <p className="product-desc">{desc}</p>
                <a href={href} className="product-cta">{cta} <ArrowRight size={14} /></a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Key Features ─────────────────────────────────────────────

function Features() {
  const feats = [
    { icon: <Map size={20} />,        title:'Demand Heat Map',     desc:'Zone-by-zone EV traffic density visualised over Nigerian road networks. Find the gaps instantly.' },
    { icon: <Calculator size={20} />, title:'ROI Calculator',      desc:'Three-scenario projections — Conservative, Base, Optimistic — with payback period and monthly income.' },
    { icon: <FileText size={20} />,   title:'AI Investor Brief',   desc:'One-click AI-generated analysis for any zone. Export as PDF, ready for stakeholder presentations.' },
    { icon: <Wifi size={20} />,       title:'Live Station Status', desc:'Real-time availability from driver reports. Available, Busy, and Offline — always up to date.' },
    { icon: <Layers size={20} />,     title:'Mobility Data Layer', desc:'Raw mobility pings and EV registration data surfaced as actionable infrastructure intelligence.' },
    { icon: <Target size={20} />,     title:'Zone Intelligence',   desc:'Population density, POI count, competitor analysis, and demand score — all in a single zone profile.' },
  ]
  return (
    <section className="features-section">
      <div className="section-inner">
        <div className="section-hd">
          <div className="section-eyebrow">Key features</div>
          <h2 className="section-title">Everything you need to decide and navigate</h2>
        </div>
        <div className="features-grid">
          {feats.map(({ icon, title, desc }) => (
            <div className="feat-card" key={title}>
              <div className="feat-icon">{icon}</div>
              <h3 className="feat-title">{title}</h3>
              <p className="feat-desc">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── ROI Preview ──────────────────────────────────────────────

function RoiPreview() {
  const rows = [
    { scenario:'Conservative', badge:'conservative', revenue:'₦12.4M', monthly:'₦1.03M', payback:'18 months' },
    { scenario:'Base Case',    badge:'base',         revenue:'₦18.6M', monthly:'₦1.55M', payback:'12 months' },
    { scenario:'Optimistic',   badge:'optimistic',   revenue:'₦26.8M', monthly:'₦2.23M', payback:'8 months'  },
  ]
  return (
    <section className="roi-section">
      <div className="section-inner">
        <div className="roi-layout">
          <div className="roi-left">
            <div className="section-eyebrow section-eyebrow--light">ROI Preview</div>
            <h2 className="roi-title">What your investment could look like</h2>
            <p className="roi-desc">Real projections from a 4-port AC Level 2 station planted in Lekki Phase 1 — one of Lagos's highest-demand EV zones.</p>
            <div className="roi-meta">
              <div className="roi-meta-item"><span>Zone</span><strong>Lekki Phase 1, Lagos</strong></div>
              <div className="roi-meta-item"><span>Type</span><strong>AC Level 2 · 4 Ports</strong></div>
              <div className="roi-meta-item"><span>Capex</span><strong>₦8,000,000</strong></div>
              <div className="roi-meta-item"><span>Demand Score</span><strong>87 / 100</strong></div>
            </div>
            <a href="#/dashboard" className="roi-cta">Run your own analysis <ArrowRight size={15} /></a>
          </div>
          <div className="roi-right">
            <div className="roi-table-wrap">
              <table className="roi-table">
                <thead>
                  <tr>
                    <th>Scenario</th>
                    <th>Annual Revenue</th>
                    <th>Monthly Income</th>
                    <th>Payback Period</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ scenario, badge, revenue, monthly, payback }) => (
                    <tr key={scenario} className={`roi-row roi-row--${badge}`}>
                      <td><span className={`roi-badge roi-badge--${badge}`}>{scenario}</span></td>
                      <td className="roi-num">{revenue}</td>
                      <td className="roi-num">{monthly}</td>
                      <td className="roi-num roi-payback">{payback}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="roi-table-note">
                Projections based on Lekki Phase 1 demand score, average session length of 45 min, and a per-kWh charge rate of ₦180. Results vary by zone and operator.
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ── Built on AWS ─────────────────────────────────────────────

function BuiltOnAws() {
  const services = [
    { icon:<Cloud size={18} />,    label:'AWS Lambda',   desc:'Serverless compute'     },
    { icon:<Database size={18} />, label:'DynamoDB',     desc:'Real-time data store'   },
    { icon:<Activity size={18} />, label:'CloudWatch',   desc:'Monitoring & alerts'    },
    { icon:<Server size={18} />,   label:'API Gateway',  desc:'Managed API layer'      },
  ]
  return (
    <section className="aws-section">
      <div className="section-inner">
        <div className="aws-layout">
          <div className="aws-left">
            <div className="aws-badge"><Zap size={14} />Powered by AWS</div>
            <h2 className="aws-title">Cloud-native infrastructure built for scale</h2>
            <p className="aws-desc">Every data point, every demand score, every ROI calculation runs on AWS infrastructure — serverless, globally distributed, and ready to scale with Nigeria's growing EV ecosystem. Zero cold start. Always on.</p>
          </div>
          <div className="aws-right">
            {services.map(({ icon, label, desc }) => (
              <div className="aws-service" key={label}>
                <div className="aws-service-icon">{icon}</div>
                <div>
                  <div className="aws-service-name">{label}</div>
                  <div className="aws-service-desc">{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

// ── Footer ────────────────────────────────────────────────────

function Footer() {
  const [email, setEmail] = useState('')
  return (
    <footer className="footer">
      <div className="footer-glow" />
      <div className="footer-inner">
        <div className="footer-grid">

          <div className="footer-col footer-col--brand">
            <a href="/" className="wordmark wordmark--light">
              <span className="wordmark-bolt wordmark-bolt--green"><Zap size={13} /></span>
              EV Hacks
            </a>
            <p className="footer-tagline">Nigeria's EV intelligence layer — helping investors build and drivers charge, powered by real-time infrastructure data.</p>
            <div className="footer-hack-badge">Built at the One With AI Hackathon</div>
          </div>

          <div className="footer-col">
            <h4 className="footer-col-title">Platform</h4>
            <nav className="footer-links">
              <a href="#/dashboard">Investor Dashboard</a>
              <a href="#/driver">Driver View</a>
              <a href="#">How It Works</a>
              <a href="#">Key Features</a>
              <a href="#">ROI Calculator</a>
            </nav>
          </div>

          <div className="footer-col">
            <h4 className="footer-col-title">Data &amp; Intelligence</h4>
            <nav className="footer-links">
              <a href="#">Demand Heat Map</a>
              <a href="#">Zone Intelligence</a>
              <a href="#">AI Investor Briefs</a>
              <a href="#">Mobility Data Layer</a>
              <a href="#">Live Station Status</a>
            </nav>
          </div>

          <div className="footer-col">
            <h4 className="footer-col-title">Stay Connected</h4>
            <p className="footer-newsletter-desc">Get updates on Nigeria's EV infrastructure and new platform features.</p>
            <form className="footer-form" onSubmit={e => { e.preventDefault(); setEmail('') }}>
              <input
                type="email" value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="footer-input"
              />
              <button type="submit" className="footer-send"><Send size={14} /></button>
            </form>
            <div className="footer-socials">
              {[
                { icon:<XIcon size={15} />,    label:'X / Twitter' },
                { icon:<Link size={15} />,     label:'LinkedIn'    },
                { icon:<GitBranch size={15}/>, label:'GitHub'      },
                { icon:<Globe size={15} />,    label:'Website'     },
              ].map(({ icon, label }) => (
                <a href="#" className="footer-social-btn" aria-label={label} key={label}>{icon}</a>
              ))}
            </div>
          </div>

        </div>
        <div className="footer-bottom">
          <span>© 2025 EV Hacks. All rights reserved.</span>
          <nav className="footer-bottom-links">
            <a href="#">Privacy Policy</a>
            <a href="#">Terms of Service</a>
            <a href="#">Cookie Settings</a>
          </nav>
        </div>
      </div>
    </footer>
  )
}

// ── Page ─────────────────────────────────────────────────────

export default function Landing() {
  return (
    <div className="landing">
      <Nav />
      <Hero />
      <StatsBar />
      <HowItWorks />
      <TwoProducts />
      <Features />
      <RoiPreview />
      <BuiltOnAws />
      <Footer />
    </div>
  )
}
