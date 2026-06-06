import { useState, useEffect, useRef, useMemo } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import {
  Zap, Eye, EyeOff, ArrowLeft, MapPin, Navigation, Star,
  Wifi, Coffee, X, User, Mail, Car, Lock, Search, Bell,
  Filter, CheckCircle, Clock, AlertCircle, LogOut, Settings,
  ChevronUp, Map, History, ShoppingBag, Bolt,
} from 'lucide-react'
import './DriverView.css'
import { api, mapDriverStation, getToken, setToken, setCachedUser, getCachedUser, clearAuth } from '../api.js'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN

async function fetchRoute(origin, dest) {
  const coords = `${origin.lng},${origin.lat};${dest.lng},${dest.lat}`
  const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}?steps=true&geometries=geojson&overview=full&access_token=${MAPBOX_TOKEN}`
  const res  = await fetch(url)
  const data = await res.json()
  if (!data.routes?.length) throw new Error('No route found')
  return data.routes[0]
}

function fmtDist(m) {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`
}
function fmtTime(s) {
  const m = Math.round(s / 60)
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m} min`
}

const DEFAULT_LOC = { lng: 3.3792, lat: 6.5244 }

function getUserLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve(DEFAULT_LOC); return }
    navigator.geolocation.getCurrentPosition(
      p => resolve({ lng:p.coords.longitude, lat:p.coords.latitude }),
      () => resolve(DEFAULT_LOC),
      { timeout:5000, maximumAge:30000 }
    )
  })
}

function distKm(lat1, lng1, lat2, lng2) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

function makeStationIcon(color) {
  const c = document.createElement('canvas')
  c.width = 76; c.height = 76
  const ctx = c.getContext('2d')
  // circle background
  ctx.beginPath(); ctx.arc(38,38,34,0,Math.PI*2)
  ctx.fillStyle = color; ctx.fill()
  ctx.strokeStyle = 'white'; ctx.lineWidth = 5; ctx.stroke()
  // pump body
  ctx.fillStyle = 'white'
  ctx.beginPath(); ctx.roundRect(18,12,28,50,4); ctx.fill()
  // screen cutout
  ctx.fillStyle = color; ctx.globalAlpha = 0.45
  ctx.beginPath(); ctx.roundRect(23,17,18,13,2); ctx.fill()
  ctx.globalAlpha = 1; ctx.fillStyle = 'white'
  // hose arm
  ctx.beginPath(); ctx.roundRect(46,26,10,5,2); ctx.fill()
  // hose vertical
  ctx.beginPath(); ctx.roundRect(51,26,5,18,2); ctx.fill()
  // nozzle bar
  ctx.beginPath(); ctx.roundRect(44,43,13,5,2); ctx.fill()
  // nozzle tip
  ctx.beginPath(); ctx.roundRect(44,47,5,10,2); ctx.fill()
  return ctx.getImageData(0,0,76,76)
}

const STATIONS = [
  {
    id:1, name:'Lekki Charge Hub', status:'available',
    portsAvailable:3, portsTotal:4, type:'DC Fast Charge',
    distanceKm:0.8, pricePerKwh:185, rating:4.8, reviews:124,
    address:'12 Admiralty Way, Lekki Phase 1',
    amenities:['Parking','Cafe','WiFi'],
    lng:3.5891, lat:6.4712, waitMins:null,
  },
  {
    id:2, name:'VI Power Station', status:'busy',
    portsAvailable:0, portsTotal:6, type:'AC Level 2',
    distanceKm:2.1, pricePerKwh:170, rating:4.5, reviews:89,
    address:'Plot 4 Adeola Odeku St, Victoria Island',
    amenities:['Parking','Mall'],
    lng:3.4228, lat:6.4295, waitMins:25,
  },
  {
    id:3, name:'Ikoyi EV Point', status:'available',
    portsAvailable:2, portsTotal:2, type:'AC Level 2',
    distanceKm:3.4, pricePerKwh:175, rating:4.3, reviews:56,
    address:'22 Bourdillon Road, Ikoyi',
    amenities:['Parking','WiFi'],
    lng:3.4388, lat:6.4504, waitMins:null,
  },
  {
    id:4, name:'Ikeja Hub', status:'offline',
    portsAvailable:0, portsTotal:3, type:'DC Fast Charge',
    distanceKm:8.2, pricePerKwh:180, rating:4.1, reviews:43,
    address:'Toyin St, Ikeja GRA',
    amenities:['Parking'],
    lng:3.3419, lat:6.5953, waitMins:null,
  },
  {
    id:5, name:'Ajah Station', status:'available',
    portsAvailable:4, portsTotal:4, type:'AC Level 2',
    distanceKm:5.6, pricePerKwh:165, rating:4.6, reviews:78,
    address:'Lekki-Epe Expressway, Ajah',
    amenities:['Parking','Cafe'],
    lng:3.6008, lat:6.4691, waitMins:null,
  },
]

const STATUS = {
  available: { color:'#16A34A', bg:'#DCFCE7', label:'Available' },
  busy:      { color:'#D97706', bg:'#FEF3C7', label:'Busy'      },
  offline:   { color:'#94A3B8', bg:'#F1F5F9', label:'Offline'   },
}

const VEHICLES = [
  'Tesla Model 3','Tesla Model Y','BYD Seal','BYD Atto 3',
  'Hyundai Ioniq 5','Kia EV6','Nissan Leaf','BMW i4',
  'Mercedes EQS','Peugeot e-2008','Other EV',
]

// ── Splash ────────────────────────────────────────────────────
function Splash({ onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 1700)
    return () => clearTimeout(t)
  }, [onDone])
  return (
    <div className="dv-splash">
      <div className="dv-splash-inner">
        <div className="dv-splash-logo"><Zap size={38}/></div>
        <h1 className="dv-splash-brand">EV Hacks</h1>
        <p className="dv-splash-tag">Nigeria's EV Network</p>
      </div>
      <div className="dv-splash-loader">
        <div className="dv-splash-bar"/>
      </div>
    </div>
  )
}

// ── Login ─────────────────────────────────────────────────────
function LoginScreen({ onLogin, onSignup }) {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  const submit = async () => {
    if (!email.trim() || !password.trim()) { setError('Fill in all fields'); return }
    setError(''); setLoading(true)
    try {
      const data = await api.auth.login(email.trim().toLowerCase(), password)
      setToken(data.token)
      setCachedUser(data.user)
      onLogin(data.user)
    } catch (e) {
      setError(e.message || 'Sign in failed')
      setLoading(false)
    }
  }

  return (
    <div className="dv-auth">
      <div className="dv-auth-hero">
        <div className="dv-auth-logo"><Zap size={24}/></div>
        <h2 className="dv-auth-title">Welcome back</h2>
        <p className="dv-auth-sub">Sign in to find stations near you</p>
      </div>

      <div className="dv-auth-card">
        {error && <div className="dv-error">{error}</div>}

        <div className="dv-field">
          <label className="dv-label">Email</label>
          <div className="dv-input-row">
            <Mail size={15} className="dv-input-ico"/>
            <input className="dv-input" type="email" placeholder="you@email.com"
              value={email} onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submit()} autoFocus/>
          </div>
        </div>

        <div className="dv-field">
          <label className="dv-label">Password</label>
          <div className="dv-pass-row">
            <Lock size={15} className="dv-pass-ico"/>
            <input className="dv-pass-input" type={showPass ? 'text' : 'password'}
              placeholder="Enter password"
              value={password} onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submit()}/>
            <button className="dv-eye" onClick={() => setShowPass(p => !p)}>
              {showPass ? <EyeOff size={16}/> : <Eye size={16}/>}
            </button>
          </div>
          <button className="dv-link dv-forgot">Forgot password?</button>
        </div>

        <button className={`dv-btn-primary${loading ? ' --loading' : ''}`} onClick={submit} disabled={loading}>
          {loading ? <span className="dv-spinner"/> : 'Sign In'}
        </button>

        <div className="dv-or"><span>or</span></div>

        <button className="dv-btn-google">
          <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
          Continue with Google
        </button>
      </div>

      <p className="dv-auth-switch">
        New to EV Hacks? <button className="dv-link" onClick={onSignup}>Create account</button>
      </p>
    </div>
  )
}

// ── Signup ────────────────────────────────────────────────────
function SignupScreen({ onBack, onDone }) {
  const [step, setStep]       = useState(1)
  const [form, setForm]       = useState({ name:'', phone:'', email:'', vehicle:'', password:'', confirm:'' })
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]:v }))

  const next = () => {
    if (!form.name.trim() || !form.phone.trim() || !form.email.trim()) {
      setError('Please fill in all fields'); return
    }
    setError(''); setStep(2)
  }

  const submit = async () => {
    if (!form.vehicle) { setError('Select your vehicle'); return }
    if (form.password.length < 8) { setError('Password must be at least 8 characters'); return }
    if (form.password !== form.confirm) { setError("Passwords don't match"); return }
    setError(''); setLoading(true)
    try {
      const data = await api.auth.register({
        name: form.name, email: form.email.trim().toLowerCase(),
        password: form.password, phone: form.phone, vehicle: form.vehicle,
      })
      setToken(data.token)
      setCachedUser(data.user)
      onDone(data.user)
    } catch (e) {
      setError(e.message || 'Registration failed')
      setLoading(false)
    }
  }

  return (
    <div className="dv-auth">
      <div className="dv-auth-top-nav">
        <button className="dv-icon-btn" onClick={step === 2 ? () => setStep(1) : onBack}>
          <ArrowLeft size={20}/>
        </button>
        <div className="dv-step-indicator">
          <span className={`dv-step-dot${step >= 1 ? ' --active' : ''}`}/>
          <span className="dv-step-line"/>
          <span className={`dv-step-dot${step >= 2 ? ' --active' : ''}`}/>
        </div>
        <div style={{width:36}}/>
      </div>

      <div className="dv-auth-hero dv-auth-hero--sm">
        <div className="dv-auth-logo"><Zap size={24}/></div>
        <h2 className="dv-auth-title">{step === 1 ? 'Create account' : 'Your vehicle'}</h2>
        <p className="dv-auth-sub">{step === 1 ? 'Step 1 — Personal info' : 'Step 2 — Vehicle & password'}</p>
      </div>

      <div className="dv-auth-card">
        {error && <div className="dv-error">{error}</div>}

        {step === 1 && <>
          <div className="dv-field">
            <label className="dv-label">Full Name</label>
            <div className="dv-input-row">
              <User size={15} className="dv-input-ico"/>
              <input className="dv-input" placeholder="Your full name"
                value={form.name} onChange={e => set('name', e.target.value)}/>
            </div>
          </div>
          <div className="dv-field">
            <label className="dv-label">Phone Number</label>
            <div className="dv-phone-row">
              <span className="dv-prefix">🇳🇬 +234</span>
              <input className="dv-phone-input" type="tel" placeholder="080 xxx xxxx"
                value={form.phone} onChange={e => set('phone', e.target.value)}/>
            </div>
          </div>
          <div className="dv-field">
            <label className="dv-label">Email</label>
            <div className="dv-input-row">
              <Mail size={15} className="dv-input-ico"/>
              <input className="dv-input" type="email" placeholder="you@email.com"
                value={form.email} onChange={e => set('email', e.target.value)}/>
            </div>
          </div>
          <button className="dv-btn-primary" onClick={next}>Continue →</button>
        </>}

        {step === 2 && <>
          <div className="dv-field">
            <label className="dv-label">Your Vehicle</label>
            <div className="dv-input-row">
              <Car size={15} className="dv-input-ico"/>
              <select className="dv-select" value={form.vehicle} onChange={e => set('vehicle', e.target.value)}>
                <option value="">Select your EV model</option>
                {VEHICLES.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          </div>
          <div className="dv-field">
            <label className="dv-label">Password</label>
            <div className="dv-pass-row">
              <Lock size={15} className="dv-pass-ico"/>
              <input className="dv-pass-input" type={showPass ? 'text' : 'password'}
                placeholder="Min. 8 characters"
                value={form.password} onChange={e => set('password', e.target.value)}/>
              <button className="dv-eye" onClick={() => setShowPass(p => !p)}>
                {showPass ? <EyeOff size={16}/> : <Eye size={16}/>}
              </button>
            </div>
          </div>
          <div className="dv-field">
            <label className="dv-label">Confirm Password</label>
            <div className="dv-pass-row">
              <Lock size={15} className="dv-pass-ico"/>
              <input className="dv-pass-input" type="password" placeholder="Repeat password"
                value={form.confirm} onChange={e => set('confirm', e.target.value)}/>
            </div>
          </div>
          <p className="dv-terms">By signing up you agree to our <button className="dv-link">Terms</button> & <button className="dv-link">Privacy Policy</button></p>
          <button className={`dv-btn-primary${loading ? ' --loading' : ''}`} onClick={submit} disabled={loading}>
            {loading ? <span className="dv-spinner"/> : 'Create Account'}
          </button>
        </>}
      </div>

      <p className="dv-auth-switch">
        Already have an account? <button className="dv-link" onClick={onBack}>Sign in</button>
      </p>
    </div>
  )
}

// ── Driver Map ─────────────────────────────────────────────────
function DriverMap({ stations, flyToId, onStationClick, navRoute, userLocation }) {
  const containerRef = useRef(null)
  const mapRef       = useRef(null)
  const stationsRef  = useRef(stations)
  const cbRef        = useRef(onStationClick)

  useEffect(() => { stationsRef.current = stations }, [stations])
  useEffect(() => { cbRef.current = onStationClick }, [onStationClick])

  useEffect(() => {
    mapboxgl.accessToken = MAPBOX_TOKEN
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [3.3792, 6.5244],
      zoom: 12.5,
      attributionControl: false,
    })
    map.addControl(new mapboxgl.AttributionControl({ compact:true }), 'bottom-right')
    mapRef.current = map

    map.on('load', () => {
      // User location dot
      map.addSource('user-loc', {
        type:'geojson',
        data:{ type:'Feature', geometry:{ type:'Point', coordinates:[3.3792, 6.5244] } }
      })
      map.addLayer({ id:'user-pulse', type:'circle', source:'user-loc',
        paint:{ 'circle-radius':14, 'circle-color':'#2563EB', 'circle-opacity':0.18 } })
      map.addLayer({ id:'user-dot', type:'circle', source:'user-loc',
        paint:{ 'circle-radius':6, 'circle-color':'#2563EB',
          'circle-stroke-width':2.5, 'circle-stroke-color':'white' } })

      // Station icons — synchronous canvas (no async needed)
      ;[
        { name:'dv-available', color:'#16A34A' },
        { name:'dv-busy',      color:'#D97706' },
        { name:'dv-offline',   color:'#94A3B8' },
      ].forEach(({ name, color }) => {
        if (!map.hasImage(name)) map.addImage(name, makeStationIcon(color), { pixelRatio:2 })
      })

      map.addSource('dv-stations', {
        type:'geojson',
        data:{
          type:'FeatureCollection',
          features: stationsRef.current.map(s => ({
            type:'Feature',
            properties:{ id:s.id, status:s.status },
            geometry:{ type:'Point', coordinates:[s.lng, s.lat] }
          }))
        }
      })
      map.addLayer({
        id:'dv-station-icons', type:'symbol', source:'dv-stations',
        layout:{
          'icon-image':['concat','dv-',['get','status']],
          'icon-size':1.2, 'icon-allow-overlap':true, 'icon-ignore-placement':true,
        }
      })
      map.on('click', 'dv-station-icons', e => {
        if (!e.features?.length) return
        const id = Number(e.features[0].properties.id)
        const s = stationsRef.current.find(s => s.id === id)
        if (s) cbRef.current(s)
      })
      map.on('mouseenter', 'dv-station-icons', () => { map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', 'dv-station-icons', () => { map.getCanvas().style.cursor = '' })
    })

    return () => { map.remove(); mapRef.current = null }
  }, [])

  // fly when selection changes
  useEffect(() => {
    if (!flyToId || !mapRef.current) return
    const s = stationsRef.current.find(s => s.id === flyToId)
    if (s) mapRef.current.flyTo({ center:[s.lng, s.lat], zoom:15, padding:{ bottom:340 }, duration:600 })
  }, [flyToId])

  // draw / clear navigation route
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const draw = () => {
      if (map.getLayer('nav-line-casing')) map.removeLayer('nav-line-casing')
      if (map.getLayer('nav-line'))        map.removeLayer('nav-line')
      if (map.getSource('nav-route'))      map.removeSource('nav-route')
      if (!navRoute?.length) return
      map.addSource('nav-route', {
        type:'geojson',
        data:{ type:'Feature', geometry:{ type:'LineString', coordinates:navRoute } }
      })
      // white casing below for contrast
      map.addLayer({ id:'nav-line-casing', type:'line', source:'nav-route',
        layout:{ 'line-join':'round', 'line-cap':'round' },
        paint:{ 'line-color':'#fff', 'line-width':9, 'line-opacity':0.7 }
      }, 'dv-station-icons')
      map.addLayer({ id:'nav-line', type:'line', source:'nav-route',
        layout:{ 'line-join':'round', 'line-cap':'round' },
        paint:{ 'line-color':'#2563EB', 'line-width':5, 'line-opacity':0.95 }
      }, 'dv-station-icons')
      // fit map to route
      const bounds = navRoute.reduce(
        (b, c) => b.extend(c),
        new mapboxgl.LngLatBounds(navRoute[0], navRoute[0])
      )
      map.fitBounds(bounds, { padding:{ top:130, bottom:160, left:30, right:30 }, duration:800 })
    }
    if (map.isStyleLoaded()) draw(); else map.once('style.load', draw)
  }, [navRoute])

  // move blue dot to real user position
  useEffect(() => {
    const map = mapRef.current
    if (!map || !userLocation) return
    const update = () => {
      const src = map.getSource('user-loc')
      if (src) src.setData({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [userLocation.lng, userLocation.lat] }
      })
    }
    if (map.isStyleLoaded()) update(); else map.once('style.load', update)
  }, [userLocation])

  return <div ref={containerRef} style={{ width:'100%', height:'100%' }}/>
}

// ── Station Card ───────────────────────────────────────────────
function StationCard({ station: s, onSelect }) {
  const cfg = STATUS[s.status]
  return (
    <div className="dv-station-card" onClick={() => onSelect(s)}>
      <div className="dv-card-left">
        <div className="dv-card-icon" style={{ background: cfg.bg, color: cfg.color }}>
          <Zap size={18}/>
        </div>
      </div>
      <div className="dv-card-body">
        <div className="dv-card-name">{s.name}</div>
        <div className="dv-card-meta">
          <span className="dv-card-type">{s.type}</span>
          <span className="dv-card-dot"/>
          <span>{s.distanceKm != null ? `${s.distanceKm} km away` : 'Locating…'}</span>
        </div>
        <div className="dv-card-row">
          <span className="dv-card-status" style={{ color:cfg.color, background:cfg.bg }}>
            {cfg.label}
            {s.status === 'busy' && s.waitMins && ` · ~${s.waitMins} min`}
          </span>
          <span className="dv-card-ports">{s.portsAvailable}/{s.portsTotal} ports</span>
        </div>
      </div>
      <div className="dv-card-right">
        <div className="dv-card-price">₦{s.pricePerKwh}</div>
        <div className="dv-card-price-lbl">per kWh</div>
        <div className="dv-card-rating"><Star size={10} fill="currentColor"/> {s.rating}</div>
      </div>
    </div>
  )
}

// ── Charging Session ───────────────────────────────────────────
function ChargingSession({ session, onStop }) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setElapsed(e => e + 1), 1000)
    return () => clearInterval(t)
  }, [])
  const mins  = Math.floor(elapsed / 60)
  const secs  = elapsed % 60
  const kwh   = ((elapsed / 3600) * 22).toFixed(2)  // fake 22kW rate
  const cost  = Math.round((kwh * session.station.pricePerKwh))
  return (
    <div className="dv-session">
      <div className="dv-session-pulse"/>
      <div className="dv-session-inner">
        <div className="dv-session-top">
          <div className="dv-session-indicator">
            <Zap size={14}/> Charging
          </div>
          <button className="dv-session-stop" onClick={onStop}>Stop</button>
        </div>
        <div className="dv-session-name">{session.station.name}</div>
        <div className="dv-session-stats">
          <div className="dv-session-stat">
            <span className="dv-session-val">{String(mins).padStart(2,'0')}:{String(secs).padStart(2,'0')}</span>
            <span className="dv-session-lbl">Time</span>
          </div>
          <div className="dv-session-divider"/>
          <div className="dv-session-stat">
            <span className="dv-session-val">{kwh}</span>
            <span className="dv-session-lbl">kWh</span>
          </div>
          <div className="dv-session-divider"/>
          <div className="dv-session-stat">
            <span className="dv-session-val">₦{cost.toLocaleString()}</span>
            <span className="dv-session-lbl">Cost</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Station Detail Sheet ───────────────────────────────────────
function StationDetail({ station: s, onClose, onStartCharging, onNavigate }) {
  const cfg = STATUS[s.status]
  const amenityIcon = { Parking: Car, WiFi: Wifi, Cafe: Coffee, Mall: ShoppingBag }

  return (
    <div className="dv-detail-overlay" onClick={onClose}>
      <div className="dv-detail-sheet" onClick={e => e.stopPropagation()}>
        <div className="dv-detail-handle"/>

        <div className="dv-detail-header">
          <div>
            <h3 className="dv-detail-name">{s.name}</h3>
            <div className="dv-detail-rating">
              {[...Array(5)].map((_, i) => (
                <Star key={i} size={12} fill={i < Math.round(s.rating) ? '#F59E0B' : 'none'}
                  stroke={i < Math.round(s.rating) ? '#F59E0B' : '#CBD5E1'}/>
              ))}
              <span className="dv-detail-rating-text">{s.rating} ({s.reviews})</span>
            </div>
          </div>
          <button className="dv-icon-btn" onClick={onClose}><X size={20}/></button>
        </div>

        <div className="dv-detail-status-bar">
          <span className="dv-detail-status-badge" style={{ color:cfg.color, background:cfg.bg }}>
            {cfg.label}
          </span>
          <span className="dv-detail-ports">
            <strong>{s.portsAvailable}</strong> of {s.portsTotal} ports available
            {s.status === 'busy' && s.waitMins && <span className="dv-detail-wait"> · ~{s.waitMins} min wait</span>}
          </span>
        </div>

        <div className="dv-detail-rows">
          <div className="dv-detail-row">
            <MapPin size={15} className="dv-detail-row-icon"/>
            <span>{s.address}</span>
          </div>
          <div className="dv-detail-row">
            <Zap size={15} className="dv-detail-row-icon"/>
            <span>{s.type} · <strong>₦{s.pricePerKwh}/kWh</strong></span>
          </div>
          <div className="dv-detail-row">
            <span className="dv-detail-row-icon" style={{ fontSize:13 }}>📏</span>
            <span>{s.distanceKm != null ? `${s.distanceKm} km from your location` : 'Calculating distance…'}</span>
          </div>
        </div>

        {s.amenities.length > 0 && (
          <div className="dv-detail-amenities">
            <div className="dv-detail-section-label">Amenities</div>
            <div className="dv-amenity-row">
              {s.amenities.map(a => {
                const Icon = amenityIcon[a] ?? MapPin
                return (
                  <div className="dv-amenity" key={a}>
                    <Icon size={15}/> {a}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div className="dv-detail-actions">
          <button className="dv-btn-outline" onClick={() => { onNavigate(s); onClose() }}>
            <Navigation size={16}/> Navigate
          </button>
          <button className="dv-btn-primary dv-btn-primary--full"
            disabled={s.status !== 'available'}
            style={{ opacity: s.status !== 'available' ? 0.5 : 1 }}
            onClick={() => s.status === 'available' && onStartCharging(s)}>
            <Zap size={16}/>
            {s.status === 'available' ? 'Start Charging' : s.status === 'busy' ? 'Join Queue' : 'Unavailable'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Profile Page ───────────────────────────────────────────────
function ProfileSheet({ title, onClose, children }) {
  return (
    <div className="dv-detail-overlay" onClick={onClose}>
      <div className="dv-detail-sheet" onClick={e => e.stopPropagation()}>
        <div className="dv-detail-handle"/>
        <div className="dv-psheet-head">
          <span className="dv-psheet-title">{title}</span>
          <button className="dv-icon-btn" onClick={onClose}><X size={18}/></button>
        </div>
        <div className="dv-psheet-body">{children}</div>
      </div>
    </div>
  )
}

function Toggle({ on, onChange }) {
  return (
    <button className={`dv-toggle${on ? ' dv-toggle--on' : ''}`} onClick={() => onChange(!on)}>
      <span className="dv-toggle-knob"/>
    </button>
  )
}

function ProfilePage({ onLogout, user }) {
  const [name,    setName]    = useState(user?.name    || 'Driver')
  const [vehicle, setVehicle] = useState(user?.vehicle || 'BYD Seal')
  const [sheet,   setSheet]   = useState(null) // 'vehicle' | 'notifications' | 'settings' | 'editName'
  const [editNameVal, setEditNameVal] = useState(name)
  const [notif, setNotif] = useState({
    nearbyAvailable: true,
    chargingComplete: true,
    priceAlerts: false,
    newStations: true,
  })
  const [settings, setSettings] = useState({
    unit: 'km',
    mapStyle: 'light',
    language: 'en',
  })

  const initials = name.trim().split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase()

  const saveEditName = () => { setName(editNameVal.trim() || name); setSheet(null) }

  return (
    <div className="dv-tab-page">
      {/* Header */}
      <div className="dv-profile-header" style={{ cursor:'pointer' }} onClick={() => { setEditNameVal(name); setSheet('editName') }}>
        <div className="dv-profile-avatar">{initials}</div>
        <div style={{ flex:1 }}>
          <div className="dv-profile-name">{name}</div>
          <div className="dv-profile-vehicle">{vehicle}{user?.phone ? ` · +234 ${user.phone.replace(/^0/, '')}` : ''}</div>
        </div>
        <span style={{ color:'#94A3B8', fontSize:20 }}>›</span>
      </div>

      {/* Stats */}
      <div className="dv-profile-stats">
        {[
          { val:'73.6 kWh', lbl:'Total Charged' },
          { val:'3',        lbl:'Sessions'       },
          { val:'₦13,033',  lbl:'Total Spent'    },
        ].map(s => (
          <div className="dv-profile-stat" key={s.lbl}>
            <div className="dv-profile-stat-val">{s.val}</div>
            <div className="dv-profile-stat-lbl">{s.lbl}</div>
          </div>
        ))}
      </div>

      {/* Rows */}
      {[
        { icon:<Car size={18}/>,      label:'My Vehicle',    sub: vehicle,        id:'vehicle'       },
        { icon:<Bell size={18}/>,     label:'Notifications', sub: Object.values(notif).filter(Boolean).length + ' enabled', id:'notifications' },
        { icon:<Settings size={18}/>, label:'Settings',      sub: settings.unit === 'km' ? 'Kilometres' : 'Miles', id:'settings' },
      ].map(item => (
        <div className="dv-profile-row" key={item.id} onClick={() => setSheet(item.id)}>
          <span className="dv-profile-row-icon">{item.icon}</span>
          <div style={{ flex:1 }}>
            <div className="dv-profile-row-label">{item.label}</div>
            <div className="dv-profile-row-sub">{item.sub}</div>
          </div>
          <span className="dv-profile-row-arrow">›</span>
        </div>
      ))}

      <button className="dv-btn-logout" onClick={onLogout}>
        <LogOut size={16}/> Sign Out
      </button>

      {/* Edit Name sheet */}
      {sheet === 'editName' && (
        <ProfileSheet title="Edit Profile" onClose={() => setSheet(null)}>
          <div className="dv-field">
            <label className="dv-label">Full Name</label>
            <div className="dv-input-row">
              <User size={15} className="dv-input-ico"/>
              <input className="dv-input" value={editNameVal}
                onChange={e => setEditNameVal(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && saveEditName()}
                autoFocus/>
            </div>
          </div>
          <button className="dv-btn-primary" style={{ marginTop:8 }} onClick={saveEditName}>Save</button>
        </ProfileSheet>
      )}

      {/* Vehicle sheet */}
      {sheet === 'vehicle' && (
        <ProfileSheet title="My Vehicle" onClose={() => setSheet(null)}>
          <div className="dv-vehicle-list">
            {VEHICLES.map(v => (
              <button key={v} className={`dv-vehicle-option${vehicle === v ? ' --selected' : ''}`}
                onClick={() => { setVehicle(v); setSheet(null) }}>
                <Car size={16}/>
                <span>{v}</span>
                {vehicle === v && <CheckCircle size={16} style={{ color:'#16A34A', marginLeft:'auto' }}/>}
              </button>
            ))}
          </div>
        </ProfileSheet>
      )}

      {/* Notifications sheet */}
      {sheet === 'notifications' && (
        <ProfileSheet title="Notifications" onClose={() => setSheet(null)}>
          {[
            { key:'nearbyAvailable', label:'Nearby available stations', sub:'Alert when a station opens near you' },
            { key:'chargingComplete', label:'Charging complete',         sub:'When your session finishes' },
            { key:'priceAlerts',      label:'Price alerts',              sub:'When prices drop at saved stations' },
            { key:'newStations',      label:'New stations',              sub:'When a new station opens near you' },
          ].map(n => (
            <div className="dv-notif-row" key={n.key}>
              <div style={{ flex:1 }}>
                <div className="dv-notif-label">{n.label}</div>
                <div className="dv-notif-sub">{n.sub}</div>
              </div>
              <Toggle on={notif[n.key]} onChange={v => setNotif(p => ({ ...p, [n.key]:v }))}/>
            </div>
          ))}
        </ProfileSheet>
      )}

      {/* Settings sheet */}
      {sheet === 'settings' && (
        <ProfileSheet title="Settings" onClose={() => setSheet(null)}>
          <div className="dv-settings-section">
            <div className="dv-settings-label">Distance Unit</div>
            <div className="dv-settings-options">
              {['km','miles'].map(u => (
                <button key={u} className={`dv-settings-opt${settings.unit === u ? ' --on' : ''}`}
                  onClick={() => setSettings(p => ({ ...p, unit:u }))}>
                  {u === 'km' ? 'Kilometres' : 'Miles'}
                </button>
              ))}
            </div>
          </div>
          <div className="dv-settings-section">
            <div className="dv-settings-label">Map Style</div>
            <div className="dv-settings-options">
              {[['light','Light'],['dark','Dark']].map(([v,l]) => (
                <button key={v} className={`dv-settings-opt${settings.mapStyle === v ? ' --on' : ''}`}
                  onClick={() => setSettings(p => ({ ...p, mapStyle:v }))}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div className="dv-settings-section">
            <div className="dv-settings-label">Language</div>
            <div className="dv-settings-options">
              {[['en','English'],['yo','Yoruba'],['ha','Hausa'],['ig','Igbo']].map(([v,l]) => (
                <button key={v} className={`dv-settings-opt${settings.language === v ? ' --on' : ''}`}
                  onClick={() => setSettings(p => ({ ...p, language:v }))}>
                  {l}
                </button>
              ))}
            </div>
          </div>
        </ProfileSheet>
      )}
    </div>
  )
}

// ── Navigation Overlay ─────────────────────────────────────────
function NavigationOverlay({ navTarget, navData, navLoading, onEnd }) {
  if (!navTarget) return null
  const step = navData?.legs?.[0]?.steps?.[0]
  const instruction = step?.maneuver?.instruction ?? 'Head toward destination'
  return (
    <>
      {/* Top instruction bar */}
      <div className="dv-nav-bar">
        <div className="dv-nav-arrow">
          {navLoading ? <span className="dv-spinner"/> : <Navigation size={22}/>}
        </div>
        <div className="dv-nav-content">
          <div className="dv-nav-instruction">
            {navLoading ? 'Finding best route…' : instruction}
          </div>
          {navData && (
            <div className="dv-nav-meta">
              {fmtDist(navData.distance)} · {fmtTime(navData.duration)}
            </div>
          )}
        </div>
      </div>
      {/* Bottom arrival card */}
      <div className="dv-nav-arrival">
        <div className="dv-nav-arrival-info">
          <div className="dv-nav-arrival-icon"><Zap size={18}/></div>
          <div>
            <div className="dv-nav-dest">{navTarget.name}</div>
            <div className="dv-nav-eta">
              {navData
                ? `Arriving in ${fmtTime(navData.duration)} · ${fmtDist(navData.distance)}`
                : 'Calculating…'}
            </div>
          </div>
        </div>
        <button className="dv-nav-end" onClick={onEnd}>End</button>
      </div>
    </>
  )
}

// ── Driver Home ────────────────────────────────────────────────
function DriverHome({ onLogout, user }) {
  const [activeTab,       setActiveTab]       = useState('map')
  const [sheetExpanded,   setSheetExpanded]   = useState(false)
  const [filter,          setFilter]          = useState('all')
  const [selected,        setSelected]        = useState(null)
  const [searchQuery,     setSearchQuery]     = useState('')
  const [chargingSession, setChargingSession] = useState(null)
  const [navTarget,       setNavTarget]       = useState(null)
  const [navData,         setNavData]         = useState(null)
  const [navLoading,      setNavLoading]      = useState(false)
  const [liveStations,    setLiveStations]    = useState(STATIONS)
  const [userLoc,         setUserLoc]         = useState(DEFAULT_LOC)

  useEffect(() => {
    getUserLocation().then(setUserLoc)
  }, [])

  useEffect(() => {
    api.getStations().then(d => {
      if (d.stations?.length) setLiveStations(d.stations.map(mapDriverStation))
    }).catch(() => {})
  }, [])

  // attach real distances and sort nearest-first
  const stationsWithDist = useMemo(() =>
    liveStations
      .map(s => ({
        ...s,
        distanceKm: (s.lat && s.lng)
          ? parseFloat(distKm(userLoc.lat, userLoc.lng, s.lat, s.lng).toFixed(1))
          : null,
      }))
      .sort((a, b) => (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999)),
    [liveStations, userLoc]
  )

  const endNav = () => { setNavTarget(null); setNavData(null); setNavLoading(false) }

  const handleNavigate = async (station) => {
    setSelected(null)
    setNavTarget(station)
    setNavData(null)
    setNavLoading(true)
    try {
      const route = await fetchRoute(userLoc, station)
      setNavData(route)
    } catch {
      setNavData(null)
    } finally {
      setNavLoading(false)
    }
  }

  const filtered = stationsWithDist.filter(s => {
    if (filter === 'available' && s.status !== 'available') return false
    if (filter === 'fast'      && s.type !== 'DC Fast Charge') return false
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      return s.name.toLowerCase().includes(q) || s.address.toLowerCase().includes(q)
    }
    return true
  })

  const handleSelect = (s) => { setSelected(s); setSheetExpanded(false) }
  const handleStartCharging = (s) => { setChargingSession({ station:s }); setSelected(null) }

  return (
    <div className="dv-home">
      {/* Map fills entire screen */}
      {activeTab === 'map' && (
        <div className="dv-map-wrap">
          <DriverMap
            stations={stationsWithDist}
            flyToId={selected?.id}
            onStationClick={!navTarget ? handleSelect : undefined}
            navRoute={navData?.geometry?.coordinates ?? null}
            userLocation={userLoc}
          />
        </div>
      )}

      {/* History tab */}
      {activeTab === 'history' && (
        <div className="dv-tab-page">
          <h2 className="dv-tab-title">Charging History</h2>
          {[
            { station:'Lekki Charge Hub',  date:'Jun 5, 2026',  kwh:'24.4', cost:'₦4,514',  duration:'38 min' },
            { station:'VI Power Station',  date:'May 28, 2026', kwh:'18.2', cost:'₦3,094',  duration:'52 min' },
            { station:'Ikoyi EV Point',    date:'May 20, 2026', kwh:'31.0', cost:'₦5,425',  duration:'1h 12m' },
          ].map((h, i) => (
            <div className="dv-history-card" key={i}>
              <div className="dv-history-icon"><Zap size={18}/></div>
              <div className="dv-history-body">
                <div className="dv-history-station">{h.station}</div>
                <div className="dv-history-meta">{h.date} · {h.duration} · {h.kwh} kWh</div>
              </div>
              <div className="dv-history-cost">{h.cost}</div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'profile' && (
        <ProfilePage onLogout={onLogout} user={user}/>
      )}

      {/* Floating top bar (map tab only, hidden during navigation) */}
      {activeTab === 'map' && !navTarget && (
        <div className="dv-top-bar">
          <div className="dv-search-bar">
            <Search size={15} className="dv-search-icon"/>
            <input
              className="dv-search-input"
              placeholder="Search stations…"
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setSheetExpanded(true) }}
            />
            {searchQuery && (
              <button className="dv-search-clear" onClick={() => setSearchQuery('')}>
                <X size={14}/>
              </button>
            )}
          </div>
          <button className="dv-notif-btn"><Bell size={18}/></button>
        </div>
      )}

      {/* Active charging session indicator */}
      {chargingSession && activeTab === 'map' && (
        <ChargingSession
          session={chargingSession}
          onStop={() => setChargingSession(null)}
        />
      )}

      {/* Bottom sheet (map tab only, hidden during navigation) */}
      {activeTab === 'map' && !navTarget && (
        <div className={`dv-sheet${sheetExpanded ? ' dv-sheet--open' : ''}`}>
          <button className="dv-sheet-handle-wrap" onClick={() => setSheetExpanded(e => !e)}>
            <div className="dv-sheet-handle"/>
          </button>

          <div className="dv-sheet-head">
            <div>
              <div className="dv-sheet-title">Stations near you</div>
              <div className="dv-sheet-count">{filtered.length} within 10 km</div>
            </div>
            <ChevronUp size={18} className={`dv-sheet-chevron${sheetExpanded ? ' --up' : ''}`}
              onClick={() => setSheetExpanded(e => !e)}/>
          </div>

          <div className="dv-filter-chips">
            {[['all','All'],['available','Available'],['fast','DC Fast']].map(([k,l]) => (
              <button key={k} className={`dv-chip${filter === k ? ' dv-chip--active' : ''}`}
                onClick={() => setFilter(k)}>{l}</button>
            ))}
          </div>

          <div className="dv-station-list">
            {filtered.map(s => (
              <StationCard key={s.id} station={s} onSelect={handleSelect}/>
            ))}
          </div>
        </div>
      )}

      {/* Tab bar */}
      <div className="dv-tab-bar">
        {[
          { id:'map',     icon:<Map size={22}/>,     label:'Map'     },
          { id:'history', icon:<History size={22}/>, label:'History' },
          { id:'profile', icon:<User size={22}/>,    label:'Profile' },
        ].map(tab => (
          <button key={tab.id}
            className={`dv-tab${activeTab === tab.id ? ' dv-tab--active' : ''}`}
            onClick={() => { setActiveTab(tab.id); setSheetExpanded(false) }}>
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* In-app navigation overlay */}
      {navTarget && activeTab === 'map' && (
        <NavigationOverlay
          navTarget={navTarget}
          navData={navData}
          navLoading={navLoading}
          onEnd={endNav}
        />
      )}

      {/* Station detail overlay (hidden during navigation) */}
      {selected && !navTarget && (
        <StationDetail
          station={selected}
          onClose={() => setSelected(null)}
          onStartCharging={handleStartCharging}
          onNavigate={handleNavigate}
        />
      )}
    </div>
  )
}

// ── Root ───────────────────────────────────────────────────────
export default function DriverView() {
  const [screen, setScreen] = useState('splash')
  const [user,   setUser]   = useState(null)

  const handleLogout = async () => {
    api.auth.logout().catch(() => {})
    clearAuth()
    setUser(null)
    setScreen('login')
  }

  // After splash: if token present skip login
  const afterSplash = () => {
    if (getToken() && getCachedUser()) {
      api.auth.me()
        .then(u => { setUser(u); setCachedUser(u); setScreen('home') })
        .catch(() => { clearAuth(); setScreen('login') })
    } else {
      setScreen('login')
    }
  }

  return (
    <div className="dv-root">
      {screen === 'splash'  && <Splash   onDone={afterSplash}/>}
      {screen === 'login'   && <LoginScreen onLogin={u => { setUser(u); setScreen('home') }} onSignup={() => setScreen('signup')}/>}
      {screen === 'signup'  && <SignupScreen onBack={() => setScreen('login')} onDone={u => { setUser(u); setScreen('home') }}/>}
      {screen === 'home'    && <DriverHome onLogout={handleLogout} user={user}/>}
    </div>
  )
}
