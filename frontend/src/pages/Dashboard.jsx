import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import {
  Zap, LayoutDashboard, MapPin, BarChart3, Calculator,
  FileText, ChevronRight, X, PlusCircle, Layers, ZoomIn,
  ZoomOut, Map, Download, Sparkles, AlertTriangle,
  TrendingUp, Clock, CheckCircle, Navigation, Settings,
  LogOut, ChevronsUpDown, Satellite, Globe,
} from 'lucide-react'
import './Dashboard.css'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN

// ─── Map styles ──────────────────────────────────────────────
const MAP_STYLES = [
  { id:'light',     label:'Map',       url:'mapbox://styles/mapbox/light-v11',            icon:<Globe size={16}/> },
  { id:'streets',   label:'Streets',   url:'mapbox://styles/mapbox/streets-v12',           icon:<Map size={16}/> },
  { id:'satellite', label:'Satellite', url:'mapbox://styles/mapbox/satellite-streets-v12', icon:<Satellite size={16}/> },
]

// ─── Data ─────────────────────────────────────────────────────
const ZONES = [
  { id:'lekki',    name:'Lekki Phase 1',   score:87, tier:'A', lng:3.5852, lat:6.4698, radiusKm:1.3, pop:'High',   poi:142, evTraffic:'2,400/day', existing:1 },
  { id:'vi',       name:'Victoria Island', score:82, tier:'A', lng:3.4219, lat:6.4281, radiusKm:1.1, pop:'High',   poi:198, evTraffic:'2,100/day', existing:2 },
  { id:'ikoyi',    name:'Ikoyi',           score:76, tier:'B', lng:3.4376, lat:6.4491, radiusKm:0.9, pop:'Medium', poi:88,  evTraffic:'1,600/day', existing:1 },
  { id:'ikeja',    name:'Ikeja GRA',       score:68, tier:'B', lng:3.3408, lat:6.5944, radiusKm:1.4, pop:'High',   poi:210, evTraffic:'1,800/day', existing:1 },
  { id:'yaba',     name:'Yaba',            score:61, tier:'B', lng:3.3875, lat:6.5038, radiusKm:1.0, pop:'High',   poi:165, evTraffic:'1,200/day', existing:0 },
  { id:'surulere', name:'Surulere',        score:54, tier:'C', lng:3.3554, lat:6.4924, radiusKm:1.1, pop:'Medium', poi:92,  evTraffic:'900/day',   existing:0 },
  { id:'ajah',     name:'Ajah',            score:72, tier:'B', lng:3.5990, lat:6.4679, radiusKm:1.2, pop:'Medium', poi:78,  evTraffic:'1,400/day', existing:1 },
  { id:'apapa',    name:'Apapa',           score:41, tier:'D', lng:3.3625, lat:6.4480, radiusKm:1.0, pop:'Low',    poi:48,  evTraffic:'600/day',   existing:0 },
  { id:'gbagada',  name:'Gbagada',         score:58, tier:'C', lng:3.3820, lat:6.5508, radiusKm:1.0, pop:'Medium', poi:74,  evTraffic:'980/day',   existing:0 },
]

const INIT_STATIONS = [
  { id:1, name:'Lekki Charge Hub',  status:'available', type:'DC Fast',    ports:4, capex:8000000, zone:'lekki',    lng:3.5891, lat:6.4712, planted:false },
  { id:2, name:'VI Power Station',  status:'busy',      type:'AC Level 2', ports:6, capex:5500000, zone:'vi',       lng:3.4228, lat:6.4295, planted:false },
  { id:3, name:'Ikoyi EV Point',    status:'available', type:'AC Level 2', ports:2, capex:4000000, zone:'ikoyi',    lng:3.4388, lat:6.4504, planted:false },
  { id:4, name:'Ikeja Hub',         status:'offline',   type:'DC Fast',    ports:3, capex:9000000, zone:'ikeja',    lng:3.3419, lat:6.5953, planted:false },
  { id:5, name:'Ajah Station',      status:'available', type:'AC Level 2', ports:4, capex:5000000, zone:'ajah',     lng:3.6008, lat:6.4691, planted:false },
]

const SIDEBAR_NAV = [
  { id:'overview',  icon:<LayoutDashboard size={17} />, label:'Overview'      },
  { id:'stations',  icon:<MapPin size={17} />,          label:'My Stations'   },
  { id:'rankings',  icon:<BarChart3 size={17} />,       label:'Zone Rankings' },
  { id:'roi',       icon:<Calculator size={17} />,      label:'ROI History'   },
  { id:'reports',   icon:<FileText size={17} />,        label:'Reports'       },
]

const ROI_HISTORY = [
  { zone:'Lekki Phase 1',   type:'DC Fast',    capex:'₦8M',   payback:'12 mo', roi:'132%', date:'2 days ago' },
  { zone:'Victoria Island', type:'AC Level 2', capex:'₦5.5M', payback:'15 mo', roi:'108%', date:'5 days ago' },
  { zone:'Ajah',            type:'AC Level 2', capex:'₦5M',   payback:'18 mo', roi:'87%',  date:'1 week ago' },
]

// ─── Helpers ──────────────────────────────────────────────────
function makeCircle(lng, lat, radiusKm, steps = 72) {
  const dX = radiusKm / (111.320 * Math.cos(lat * Math.PI / 180))
  const dY = radiusKm / 110.574
  const coords = Array.from({ length:steps }, (_, i) => {
    const θ = (i / steps) * 2 * Math.PI
    return [lng + dX * Math.cos(θ), lat + dY * Math.sin(θ)]
  })
  coords.push(coords[0])
  return { type:'Polygon', coordinates:[coords] }
}
function closestZone(lng, lat) {
  return ZONES.reduce((best, z) =>
    Math.hypot(z.lng-lng, z.lat-lat) < Math.hypot(best.lng-lng, best.lat-lat) ? z : best
  )
}
function zoneColor(score) {
  if (score >= 80) return '#16A34A'
  if (score >= 65) return '#22c55e'
  if (score >= 50) return '#D97706'
  return '#DC2626'
}
function tierColor(t) { return { A:'#16A34A', B:'#D97706', C:'#64748B', D:'#DC2626' }[t] ?? '#94A3B8' }
function statusColor(s) { return { available:'#16A34A', busy:'#D97706', offline:'#DC2626' }[s] ?? '#94A3B8' }

function calcROI(capex, type) {
  const base = type === 'DC Fast' ? 1.55 : 1.03
  return [
    { label:'Conservative', mult:.67, color:'#64748B', bg:'rgba(148,163,184,.08)' },
    { label:'Base Case',    mult:1,   color:'#16A34A', bg:'rgba(22,163,74,.06)'   },
    { label:'Optimistic',   mult:1.44,color:'#4ade80', bg:'rgba(74,222,128,.08)'  },
  ].map(r => {
    const monthly = base * r.mult * 1e6
    return { ...r,
      annual:`₦${(monthly*12).toLocaleString('en-NG',{maximumFractionDigits:0})}`,
      monthly:`₦${monthly.toLocaleString('en-NG',{maximumFractionDigits:0})}`,
      payback:`${Math.round(capex/monthly)} mo`,
      roi:`${Math.round((monthly*12/capex)*100)}%`,
    }
  })
}

// ─── Framer variants ──────────────────────────────────────────
const sidebarV = {
  open:   { width:240 },
  closed: { width:64  },
}
const labelV = {
  open:   { opacity:1, x:0,   display:'block',  transition:{ delay:.05, duration:.15 } },
  closed: { opacity:0, x:-12, transitionEnd:{ display:'none' } },
}
const transitionProps = { type:'tween', ease:'easeOut', duration:.2 }

// ─── Demand ring ──────────────────────────────────────────────
function DemandRing({ score }) {
  const r = 40, circ = 2*Math.PI*r, dash = (score/100)*circ
  const color = zoneColor(score)
  return (
    <svg width="100" height="100" viewBox="0 0 100 100">
      <circle cx="50" cy="50" r={r} fill="none" stroke="#E2E8F0" strokeWidth="7"/>
      <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="7"
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        transform="rotate(-90 50 50)" style={{ transition:'stroke-dasharray 1s ease' }}/>
      <text x="50" y="54" textAnchor="middle" fontSize="20" fontWeight="700" fill="#0F172A" fontFamily="Inter,sans-serif">{score}</text>
      <text x="50" y="67" textAnchor="middle" fontSize="9" fill="#94A3B8" fontFamily="Inter,sans-serif">/100</text>
    </svg>
  )
}

// ─── ROI Modal ────────────────────────────────────────────────
function ROIModal({ capex, type, zone, onClose }) {
  const [phase, setPhase] = useState('loading')
  const rows = calcROI(capex, type)

  useEffect(() => {
    const t = setTimeout(() => setPhase('results'), 1800)
    return () => clearTimeout(t)
  }, [])

  return (
    <AnimatePresence>
      <motion.div className="dp-modal-overlay"
        initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
        onClick={onClose}>
        <motion.div className="dp-modal"
          initial={{ opacity:0, y:24, scale:.97 }}
          animate={{ opacity:1, y:0, scale:1 }}
          exit={{ opacity:0, y:24, scale:.97 }}
          transition={{ type:'tween', ease:'easeOut', duration:.22 }}
          onClick={e => e.stopPropagation()}>

          {phase === 'loading' ? (
            <div className="dp-modal-loading">
              <div className="dp-modal-spinner-wrap">
                <div className="dp-modal-spinner" />
                <Zap size={22} className="dp-modal-zap" />
              </div>
              <div className="dp-modal-loading-title">Calculating ROI…</div>
              <div className="dp-modal-loading-sub">
                Analysing {zone?.name ?? 'zone'} demand · Modelling {type} throughput · Running 3 scenarios
              </div>
              <div className="dp-modal-progress">
                <motion.div className="dp-modal-progress-bar"
                  initial={{ width:'0%' }} animate={{ width:'100%' }}
                  transition={{ duration:1.7, ease:'linear' }} />
              </div>
            </div>
          ) : (
            <div className="dp-modal-results">
              <div className="dp-modal-header">
                <div>
                  <div className="dp-modal-badge"><Sparkles size={11}/> ROI Analysis</div>
                  <h2 className="dp-modal-title">{zone?.name ?? 'Station'} — Investment Projection</h2>
                  <p className="dp-modal-sub">{type} · {Math.round(capex/1e6*10)/10}M capex · Demand score {zone?.score ?? '—'}/100</p>
                </div>
                <button className="dp-modal-close" onClick={onClose}><X size={18}/></button>
              </div>

              <div className="dp-modal-meta-row">
                {[
                  { label:'Zone', val:zone?.name ?? '—' },
                  { label:'Station Type', val:type },
                  { label:'Capex', val:`₦${(capex/1e6).toFixed(1)}M` },
                  { label:'Demand Score', val:`${zone?.score ?? '—'}/100` },
                ].map(m => (
                  <div className="dp-modal-meta-card" key={m.label}>
                    <span className="dp-modal-meta-val">{m.val}</span>
                    <span className="dp-modal-meta-lbl">{m.label}</span>
                  </div>
                ))}
              </div>

              <table className="dp-modal-table">
                <thead>
                  <tr><th>Scenario</th><th>Annual Revenue</th><th>Monthly Income</th><th>Payback Period</th><th>ROI</th></tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.label} style={{ background:r.bg }}>
                      <td><span className="dp-modal-badge-cell" style={{ color:r.color, background:`${r.color}18` }}>{r.label}</span></td>
                      <td className="dp-modal-num">{r.annual}</td>
                      <td className="dp-modal-num">{r.monthly}</td>
                      <td className="dp-modal-num" style={{ color:r.color }}>{r.payback}</td>
                      <td className="dp-modal-num" style={{ color:r.color, fontWeight:800 }}>{r.roi}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="dp-modal-note">
                Based on ₦180/kWh rate, 45 min avg session, zone demand score {zone?.score ?? 80}/100.
                Results vary by zone and operator.
              </div>

              {zone?.score < 55 && (
                <div className="dp-modal-risk"><AlertTriangle size={13}/> Low demand zone — consider a smaller AC Level 2 deployment to reduce capex exposure.</div>
              )}

              <div className="dp-modal-rec">
                <TrendingUp size={13}/> {type} recommended for {zone?.name} based on commercial traffic density and avg driver dwell time &lt;30 min.
              </div>

              <div className="dp-modal-actions">
                <button className="dp-modal-export"><Download size={14}/> Export PDF</button>
                <button className="dp-modal-secondary" onClick={onClose}>Close</button>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

// ─── AI Brief ────────────────────────────────────────────────
function AIBrief({ zone }) {
  const [state, setState] = useState('idle')
  if (!zone) return null
  return (
    <div className="dp-brief">
      {state === 'idle' && (
        <button className="dp-brief-btn"
          onClick={() => { setState('loading'); setTimeout(() => setState('done'), 2200) }}>
          <Sparkles size={15}/> Generate Investor Brief
        </button>
      )}
      {state === 'loading' && (
        <div className="dp-brief-loading">
          <div className="dp-brief-spinner"/><span>Generating analysis…</span>
        </div>
      )}
      {state === 'done' && (
        <div className="dp-brief-result">
          <div className="dp-brief-ai-badge"><Sparkles size={11}/> AI Generated</div>
          <p className="dp-brief-headline">{zone.name} — Strong ROI opportunity with manageable competition</p>
          <p className="dp-brief-summary">
            {zone.name} scores {zone.score}/100 on EV demand (Tier {zone.tier}). With {zone.evTraffic} EV trips
            daily and only {zone.existing} existing station{zone.existing!==1?'s':''} in the area,
            infrastructure supply is below demand. A 4-port station here targets breakeven in 12–15 months.
          </p>
          <div className="dp-brief-metrics">
            {[
              { val:`${zone.score}/100`, lbl:'Demand Score' },
              { val:`${zone.existing}`, lbl:'Competition' },
              { val:zone.evTraffic, lbl:'Daily Traffic' },
            ].map(m => (
              <div className="dp-brief-metric" key={m.lbl}>
                <span className="dp-brief-metric-val">{m.val}</span>
                <span className="dp-brief-metric-lbl">{m.lbl}</span>
              </div>
            ))}
          </div>
          {zone.score < 60 && <div className="dp-brief-risk"><AlertTriangle size={13}/> Low demand zone — smaller capex advised.</div>}
          <div className="dp-brief-rec"><TrendingUp size={13}/> DC Fast recommended for {zone.name} based on traffic density.</div>
          <div className="dp-brief-actions">
            <button className="dp-brief-export"><Download size={13}/> Export PDF</button>
            <button className="dp-brief-reset" onClick={() => setState('idle')}>Regenerate</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Station Panel ─────────────────────────────────────────────
function StationPanel({ station, zone, onClose, isNew, onCalculateROI }) {
  const [name, setName]   = useState(station?.name ?? 'New Station')
  const [type, setType]   = useState(station?.type ?? 'AC Level 2')
  const [ports, setPorts] = useState(station?.ports ?? 4)
  const [capex, setCapex] = useState(station?.capex ?? 5000000)
  const [opex, setOpex]   = useState(120000)
  const z = zone ?? ZONES.find(z => z.id === station?.zone)

  return (
    <aside className="dp-panel">
      <div className="dp-panel-header">
        <div className="dp-panel-title-row">
          <button className="dp-panel-close" onClick={onClose}><X size={16}/></button>
        </div>
        <div className="dp-panel-name-section">
          <label className="dp-panel-name-label">Station Name</label>
          <input className="dp-panel-name-input" value={name} onChange={e => setName(e.target.value)}
            placeholder="Enter station name…" />
        </div>
        {z && <div className="dp-panel-coords">{z.name} · Demand Zone {z.tier}</div>}
      </div>

      <div className="dp-panel-scroll">
        {z && (
          <div className="dp-panel-section">
            <div className="dp-section-label">Zone Intelligence</div>
            <div className="dp-zone-intel">
              <div className="dp-zone-ring-wrap">
                <DemandRing score={z.score}/>
                <div className="dp-zone-tier" style={{ background:`${tierColor(z.tier)}18`, color:tierColor(z.tier) }}>Tier {z.tier}</div>
              </div>
              <div className="dp-zone-stats">
                <div className="dp-zone-stat"><span>{z.pop}</span><label>Population</label></div>
                <div className="dp-zone-stat"><span>{z.poi}</span><label>POIs</label></div>
                <div className="dp-zone-stat"><span>{z.evTraffic}</span><label>EV Traffic</label></div>
                <div className="dp-zone-stat"><span>{z.existing}</span><label>Stations</label></div>
              </div>
            </div>
            {z.score < 55 && <div className="dp-risk-flag"><AlertTriangle size={13}/> Low demand zone — consider smaller capex.</div>}
          </div>
        )}

        <div className="dp-panel-section">
          <div className="dp-section-label">Station Config</div>
          <div className="dp-form">
            <label className="dp-label">Station Type
              <select className="dp-select" value={type} onChange={e => setType(e.target.value)}>
                <option>AC Level 2</option><option>DC Fast</option><option>Battery Swap</option>
              </select>
            </label>
            <label className="dp-label">Number of Ports
              <input className="dp-input" type="number" value={ports} min={1} max={20}
                onChange={e => setPorts(Number(e.target.value))}/>
            </label>
            <label className="dp-label">Capital Expenditure (₦)
              <input className="dp-input" type="number" value={capex} step={500000}
                onChange={e => setCapex(Number(e.target.value))}/>
            </label>
            <label className="dp-label">Monthly OPEX (₦)
              <input className="dp-input" type="number" value={opex} step={10000}
                onChange={e => setOpex(Number(e.target.value))}/>
            </label>
          </div>
          <button className="dp-calc-btn" onClick={() => onCalculateROI({ capex, type, zone:z })}>
            <Calculator size={14}/> Calculate ROI
          </button>
        </div>

        {z && (
          <div className="dp-panel-section">
            <div className="dp-section-label">Competition</div>
            <div className="dp-competitor">
              <span className="dp-comp-count">{z.existing}</span>
              <span>existing station{z.existing!==1?'s':''} within 1km</span>
            </div>
          </div>
        )}

        <div className="dp-panel-section">
          <div className="dp-section-label">AI Investor Brief</div>
          <AIBrief zone={z}/>
        </div>
      </div>
    </aside>
  )
}

// ─── Legend ───────────────────────────────────────────────────
function LegendPanel() {
  return (
    <div className="dp-legend">
      <div className="dp-legend-title">Demand Zones</div>
      {[
        { label:'Tier A  (80+)',   color:'#16A34A' },
        { label:'Tier B  (65–79)', color:'#22c55e' },
        { label:'Tier C  (50–64)', color:'#D97706' },
        { label:'Tier D  (<50)',   color:'#DC2626' },
      ].map(l => (
        <div className="dp-legend-item" key={l.label}>
          <span className="dp-legend-swatch" style={{ background:`${l.color}38`, border:`1.5px solid ${l.color}` }}/>
          <span>{l.label}</span>
        </div>
      ))}
      <div className="dp-legend-divider"/>
      <div className="dp-legend-title">Stations</div>
      {[
        { label:'Available', color:'#16A34A' },
        { label:'Busy',      color:'#D97706' },
        { label:'Offline',   color:'#DC2626' },
      ].map(l => (
        <div className="dp-legend-item" key={l.label}>
          <span className="dp-legend-dot" style={{ background:l.color }}/>
          <span>{l.label}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Mapbox map ───────────────────────────────────────────────
function MapboxMap({ stations, heatmapOn, plantingMode, showLegend, onMapClick, onStationClick, mapInstanceRef }) {
  const containerRef  = useRef(null)
  const mapRef        = useRef(null)
  const plantRef      = useRef(plantingMode)
  const clickCbRef    = useRef(onMapClick)
  const stationCbRef  = useRef(onStationClick)
  const stationsRef   = useRef(stations)        // always-current list for GL click handler
  const zonesAddedRef = useRef(false)

  useEffect(() => { plantRef.current     = plantingMode   }, [plantingMode])
  useEffect(() => { clickCbRef.current   = onMapClick     }, [onMapClick])
  useEffect(() => { stationCbRef.current = onStationClick }, [onStationClick])
  useEffect(() => { stationsRef.current  = stations       }, [stations])

  // ── zone circles ──────────────────────────────────────────
  function setupZoneLayers(map) {
    if (map.getSource('zones')) return
    const features = ZONES.map(z => ({
      type:'Feature',
      properties:{ id:z.id, name:z.name, score:z.score, tier:z.tier, color:zoneColor(z.score) },
      geometry:makeCircle(z.lng, z.lat, z.radiusKm),
    }))
    map.addSource('zones', { type:'geojson', data:{ type:'FeatureCollection', features } })
    map.addLayer({ id:'zones-fill', type:'fill', source:'zones',
      paint:{ 'fill-color':['get','color'], 'fill-opacity':0.18 } })
    map.addLayer({ id:'zones-outline', type:'line', source:'zones',
      paint:{ 'line-color':['get','color'], 'line-width':1.5, 'line-opacity':0.55, 'line-dasharray':[2,1.5] } })
    map.addLayer({ id:'zones-label', type:'symbol', source:'zones',
      layout:{
        'text-field':['get','name'], 'text-size':11,
        'text-font':['DIN Offc Pro Medium','Arial Unicode MS Regular'],
        'text-anchor':'center',
      },
      paint:{ 'text-color':['get','color'], 'text-halo-color':'rgba(255,255,255,0.9)', 'text-halo-width':2 } })
    zonesAddedRef.current = true
  }

  // ── station GL icons — registered as map sprite images ────
  // Using GL symbol layers avoids all DOM-marker positioning issues
  function loadStationImages(map, cb) {
    const defs = [
      { name:'ev-available', color:'#16A34A' },
      { name:'ev-busy',      color:'#D97706' },
      { name:'ev-offline',   color:'#DC2626' },
    ]
    let pending = defs.length
    const done = () => { if (--pending === 0 && cb) cb() }
    defs.forEach(({ name, color }) => {
      if (map.hasImage(name)) { done(); return }
      // 76×76 SVG rendered at pixelRatio:2 → crisp 38×38 on screen
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="76" height="76">
        <circle cx="38" cy="38" r="34" fill="${color}" stroke="white" stroke-width="5"/>
        <path d="M44 16L28 42h12L32 60 48 34h-12L44 16Z" fill="white"/>
      </svg>`
      const img = new Image(76, 76)
      img.onload = () => { if (!map.hasImage(name)) map.addImage(name, img, { pixelRatio:2 }); done() }
      img.onerror = done
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
    })
  }

  function setupStationsLayer(map) {
    if (map.getSource('ev-stations')) return
    map.addSource('ev-stations', { type:'geojson', data:{ type:'FeatureCollection', features:[] } })
    map.addLayer({
      id:'ev-stations', type:'symbol', source:'ev-stations',
      layout:{
        'icon-image':['concat','ev-',['get','status']],
        'icon-size':1,
        'icon-allow-overlap':true,
        'icon-ignore-placement':true,
      }
    })
    // click: find matching station by id stored in feature properties
    map.on('click', 'ev-stations', e => {
      if (!e.features?.length) return
      const id = Number(e.features[0].properties.id)
      const s  = stationsRef.current.find(s => s.id === id)
      if (s) stationCbRef.current(s)
    })
    map.on('mouseenter', 'ev-stations', () => { map.getCanvas().style.cursor = 'pointer' })
    map.on('mouseleave', 'ev-stations', () => { map.getCanvas().style.cursor = plantRef.current ? 'crosshair' : '' })
  }

  function setStationsData(map, list) {
    const src = map.getSource('ev-stations')
    if (!src) return
    src.setData({
      type:'FeatureCollection',
      features: list.map(s => ({
        type:'Feature',
        properties:{ id:s.id, status:s.status, name:s.name },
        geometry:{ type:'Point', coordinates:[s.lng, s.lat] }
      }))
    })
  }

  // ── init ──────────────────────────────────────────────────
  useEffect(() => {
    mapboxgl.accessToken = MAPBOX_TOKEN
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: MAP_STYLES[1].url,
      center: [3.3792, 6.5244],
      zoom: 11,
      attributionControl: false,
    })
    map.addControl(new mapboxgl.AttributionControl({ compact:true }), 'bottom-right')
    mapRef.current = map
    if (mapInstanceRef) mapInstanceRef.current = map

    map._changeStyle = (styleUrl) => {
      zonesAddedRef.current = false
      map.once('style.load', () => {
        setupZoneLayers(map)
        loadStationImages(map, () => {
          setupStationsLayer(map)
          setStationsData(map, stationsRef.current)
        })
      })
      map.setStyle(styleUrl)
    }

    map.on('load', () => {
      setupZoneLayers(map)
      loadStationImages(map, () => {
        setupStationsLayer(map)
        setStationsData(map, stationsRef.current)
      })
    })

    // plant click — skip if cursor is over an existing station icon
    map.on('click', e => {
      if (!plantRef.current) return
      const hit = map.queryRenderedFeatures(e.point, { layers:['ev-stations'] })
      if (hit.length) return
      clickCbRef.current({ lng:e.lngLat.lng, lat:e.lngLat.lat })
    })

    return () => { map.remove(); mapRef.current = null }
  }, [])

  // ── update GL source when stations list changes ───────────
  useEffect(() => {
    const map = mapRef.current
    if (!map?.isStyleLoaded()) return
    setStationsData(map, stations)
  }, [stations])

  // ── heatmap toggle ────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map?.isStyleLoaded() || !zonesAddedRef.current) return
    const vis = heatmapOn ? 'visible' : 'none'
    ;['zones-fill','zones-outline','zones-label'].forEach(id => {
      try { map.setLayoutProperty(id,'visibility',vis) } catch {}
    })
  }, [heatmapOn])

  return (
    <div className={`dp-map-canvas${plantingMode ? ' dp-map-canvas--plant' : ''}`}>
      <div ref={containerRef} style={{ width:'100%', height:'100%' }}/>
      {showLegend && <LegendPanel/>}
      {plantingMode && <div className="dp-plant-hint">Click anywhere on the map to plant a station</div>}
    </div>
  )
}

// ─── Dock ─────────────────────────────────────────────────────
function Dock({ plantingMode, heatmapOn, showLegend, mapStyleIdx,
  onPlant, onHeatmap, onLegend, onZoomIn, onZoomOut, onCycleStyle }) {
  const style = MAP_STYLES[mapStyleIdx]
  return (
    <div className="dp-dock">
      <button className={`dp-dock-btn${plantingMode ? ' dp-dock-btn--active' : ''}`} onClick={onPlant}>
        <PlusCircle size={18}/><span>Plant Station</span>
      </button>
      <div className="dp-dock-divider"/>
      <button className={`dp-dock-btn${heatmapOn ? ' dp-dock-btn--active' : ''}`} onClick={onHeatmap}>
        <Layers size={18}/><span>Heatmap</span>
      </button>
      <div className="dp-dock-divider"/>
      <button className="dp-dock-btn" onClick={onZoomIn}><ZoomIn size={18}/><span>Zoom In</span></button>
      <button className="dp-dock-btn" onClick={onZoomOut}><ZoomOut size={18}/><span>Zoom Out</span></button>
      <div className="dp-dock-divider"/>
      <button className={`dp-dock-btn dp-dock-btn--style`} onClick={onCycleStyle}>
        {style.icon}<span>{style.label}</span>
      </button>
      <div className="dp-dock-divider"/>
      <button className={`dp-dock-btn${showLegend ? ' dp-dock-btn--active' : ''}`} onClick={onLegend}>
        <Map size={18}/><span>Legend</span>
      </button>
    </div>
  )
}

// ─── Sidebar ──────────────────────────────────────────────────
function Sidebar({ activePage, setActivePage, stations }) {
  const [collapsed, setCollapsed] = useState(true)

  return (
    <motion.aside
      className="dp-sidebar"
      initial="closed"
      animate={collapsed ? 'closed' : 'open'}
      variants={sidebarV}
      transition={transitionProps}
      onMouseEnter={() => setCollapsed(false)}
      onMouseLeave={() => setCollapsed(true)}
    >
      {/* Top — wordmark */}
      <div className="dp-sidebar-top">
        <a href="#/" className="dp-wordmark">
          <span className="dp-wordmark-bolt"><Zap size={12}/></span>
          <motion.span variants={labelV} className="dp-wordmark-text">EV Hacks</motion.span>
        </a>
        <motion.div variants={labelV} className="dp-sidebar-role">Investor Dashboard</motion.div>
      </div>

      {/* Nav */}
      <nav className="dp-nav">
        {SIDEBAR_NAV.map(({ id, icon, label }) => (
          <button key={id}
            className={`dp-nav-item${activePage === id ? ' dp-nav-item--active' : ''}`}
            onClick={() => setActivePage(id)}>
            <span className="dp-nav-icon">{icon}</span>
            <motion.span variants={labelV} className="dp-nav-label">{label}</motion.span>
            {activePage === id && (
              <motion.span variants={labelV} className="dp-nav-arrow"><ChevronRight size={13}/></motion.span>
            )}
          </button>
        ))}
      </nav>

      {/* Stats */}
      <div className="dp-sidebar-stats">
        <motion.div variants={labelV} className="dp-sidebar-stats-title">Live Stats</motion.div>
        {[
          { label:'Stations',  val:String(stations.length), icon:<MapPin size={14}/> },
          { label:'Top Zone',  val:'Lekki',                 icon:<BarChart3 size={14}/> },
          { label:'Best ROI',  val:'132%',                  icon:<TrendingUp size={14}/> },
          { label:'Payback',   val:'14 mo',                 icon:<Clock size={14}/> },
        ].map(({ label, val, icon }) => (
          <div className="dp-stat-card" key={label}>
            <div className="dp-stat-icon" title={label}>{icon}</div>
            <motion.div variants={labelV} className="dp-stat-text">
              <div className="dp-stat-val">{val}</div>
              <div className="dp-stat-lbl">{label}</div>
            </motion.div>
          </div>
        ))}
      </div>

      {/* Bottom */}
      <div className="dp-sidebar-bottom">
        <a href="#/driver" className="dp-nav-item dp-switch-row">
          <span className="dp-nav-icon"><Navigation size={17}/></span>
          <motion.span variants={labelV} className="dp-nav-label">Driver View</motion.span>
        </a>
        <button className="dp-nav-item">
          <span className="dp-nav-icon"><Settings size={17}/></span>
          <motion.span variants={labelV} className="dp-nav-label">Settings</motion.span>
        </button>
        <div className="dp-sidebar-divider"/>
        <div className="dp-account-row">
          <div className="dp-account-avatar">RA</div>
          <motion.div variants={labelV} className="dp-account-info">
            <span className="dp-account-name">Raufu Abdulraman</span>
            <span className="dp-account-email">raufu@evhacks.ng</span>
          </motion.div>
          <motion.button variants={labelV} className="dp-account-logout" title="Sign out">
            <LogOut size={13}/>
          </motion.button>
        </div>
      </div>
    </motion.aside>
  )
}

// ─── Sub-pages ─────────────────────────────────────────────────
function ZoneRankings({ onSelectZone }) {
  return (
    <div className="dp-subpage">
      <div className="dp-subpage-header">
        <h2 className="dp-subpage-title">Zone Rankings</h2>
        <p className="dp-subpage-sub">All Nigerian EV zones ranked by demand score</p>
      </div>
      <div className="dp-rankings-table-wrap">
        <table className="dp-rankings-table">
          <thead><tr><th>#</th><th>Zone</th><th>Tier</th><th>Demand Score</th><th>EV Traffic</th><th>POIs</th><th>Stations</th><th></th></tr></thead>
          <tbody>
            {[...ZONES].sort((a,b)=>b.score-a.score).map((z,i) => (
              <tr key={z.id}>
                <td className="dp-rank-num">{i+1}</td>
                <td className="dp-rank-name">{z.name}</td>
                <td><span className="dp-tier-badge" style={{ background:`${tierColor(z.tier)}18`, color:tierColor(z.tier) }}>{z.tier}</span></td>
                <td>
                  <div className="dp-score-bar-wrap">
                    <div className="dp-score-bar" style={{ width:`${z.score}%`, background:zoneColor(z.score) }}/>
                    <span className="dp-score-num">{z.score}</span>
                  </div>
                </td>
                <td>{z.evTraffic}</td><td>{z.poi}</td><td>{z.existing}</td>
                <td><button className="dp-rank-btn" onClick={() => onSelectZone(z)}>View <ChevronRight size={12}/></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ROIHistoryPage() {
  return (
    <div className="dp-subpage">
      <div className="dp-subpage-header">
        <h2 className="dp-subpage-title">ROI History</h2>
        <p className="dp-subpage-sub">Your saved ROI calculations</p>
      </div>
      <div className="dp-history-list">
        {ROI_HISTORY.map((r,i) => (
          <div className="dp-history-card" key={i}>
            <div><div className="dp-history-zone">{r.zone}</div>
              <div className="dp-history-meta">{r.type} · Capex {r.capex}</div>
              <div className="dp-history-date">{r.date}</div>
            </div>
            <div><div className="dp-history-roi">{r.roi}</div>
              <div className="dp-history-payback">Payback {r.payback}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ReportsPage() {
  const reports = [
    { name:'Lekki Phase 1 — Investor Brief',         date:'Jun 4, 2025',  status:'ready' },
    { name:'Victoria Island — Comparative Analysis', date:'Jun 1, 2025',  status:'ready' },
    { name:'Ajah Zone — Feasibility Study',          date:'May 28, 2025', status:'draft' },
  ]
  return (
    <div className="dp-subpage">
      <div className="dp-subpage-header">
        <h2 className="dp-subpage-title">Reports</h2>
        <p className="dp-subpage-sub">AI-generated investor briefs and analyses</p>
      </div>
      <div className="dp-reports-list">
        {reports.map(r => (
          <div className="dp-report-card" key={r.name}>
            <div className="dp-report-icon"><FileText size={20}/></div>
            <div className="dp-report-info">
              <div className="dp-report-name">{r.name}</div>
              <div className="dp-report-date">{r.date}</div>
            </div>
            <span className={`dp-report-status dp-report-status--${r.status}`}>
              {r.status==='ready' ? <><CheckCircle size={12}/> Ready</> : <><Clock size={12}/> Draft</>}
            </span>
            <button className="dp-report-dl"><Download size={14}/></button>
          </div>
        ))}
      </div>
    </div>
  )
}

function StationsPage({ stations, onStationClick }) {
  return (
    <div className="dp-subpage">
      <div className="dp-subpage-header">
        <h2 className="dp-subpage-title">My Stations</h2>
        <p className="dp-subpage-sub">{stations.length} stations in your portfolio</p>
      </div>
      <div className="dp-stations-grid">
        {stations.map(s => {
          const z = ZONES.find(z => z.id === s.zone)
          return (
            <div className="dp-station-card" key={s.id} onClick={() => onStationClick(s)}>
              <div className="dp-station-card-header">
                <span className="dp-station-name">{s.name}</span>
                <span className="dp-station-status" style={{ background:`${statusColor(s.status)}18`, color:statusColor(s.status) }}>{s.status}</span>
              </div>
              <div className="dp-station-meta"><span>{s.type}</span><span>·</span><span>{s.ports} ports</span></div>
              {z && <div className="dp-station-zone"><MapPin size={11}/>{z.name}<span className="dp-station-tier" style={{ color:tierColor(z.tier) }}>Tier {z.tier}</span></div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main Dashboard ────────────────────────────────────────────
let _nextId = 100
export default function Dashboard() {
  const [activePage,   setActivePage]   = useState('overview')
  const [stations,     setStations]     = useState(INIT_STATIONS)
  const [plantingMode, setPlantingMode] = useState(false)
  const [selected,     setSelected]     = useState(null)
  const [selectedZone, setSelZone]      = useState(null)
  const [heatmapOn,    setHeatmapOn]    = useState(true)
  const [showLegend,   setShowLegend]   = useState(true)
  const [mapStyleIdx,  setMapStyleIdx]  = useState(1)
  const [roiModal,     setRoiModal]     = useState(null) // { capex, type, zone }
  const mapInstanceRef = useRef(null)
  const panelOpen = selected !== null || selectedZone !== null

  const handleMapClick = ({ lng, lat }) => {
    console.log('[plant] click received at', lng, lat)
    const zone = closestZone(lng, lat)
    const newId = ++_nextId
    const s = { id:newId, name:'New Station', status:'available', type:'AC Level 2', ports:4, capex:5000000, zone:zone.id, lng, lat, planted:true }
    console.log('[plant] creating station id', newId, 'zone', zone.name)
    setStations(prev => { console.log('[plant] stations before:', prev.length); return [...prev, s] })
    setSelected(s)
    setSelZone(null)
    setPlantingMode(false)
    setTimeout(() => {
      const map = mapInstanceRef.current
      if (!map) { console.warn('[plant] no map ref'); return }
      const currentZoom = map.getZoom()
      const targetZoom = Math.max(currentZoom, 15)
      console.log('[plant] flying to', lng, lat, 'zoom', currentZoom, '→', targetZoom)
      map.flyTo({ center:[lng, lat], zoom:targetZoom, padding:{ right:380 }, duration:700 })
    }, 50)
  }

  const handleStationClick = (s) => {
    setSelected(s)
    setSelZone(null)
    mapInstanceRef.current?.flyTo({ center:[s.lng, s.lat], zoom:13, padding:{ right:380 }, duration:900 })
  }

  const handleZoneSelect = (z) => {
    setSelZone(z)
    setSelected(null)
    setActivePage('overview')
    mapInstanceRef.current?.flyTo({ center:[z.lng, z.lat], zoom:13, padding:{ right:380 }, duration:900 })
  }

  const handleCycleStyle = () => {
    const nextIdx = (mapStyleIdx + 1) % MAP_STYLES.length
    setMapStyleIdx(nextIdx)
    mapInstanceRef.current?._changeStyle(MAP_STYLES[nextIdx].url)
  }

  const closePanel = () => { setSelected(null); setSelZone(null) }

  return (
    <div className="dp-root">
      <Sidebar activePage={activePage} setActivePage={p => { setActivePage(p); closePanel() }} stations={stations}/>

      <div className="dp-main">
        {activePage === 'overview' && (
          <>
            <MapboxMap
              stations={stations} heatmapOn={heatmapOn}
              plantingMode={plantingMode} showLegend={showLegend}
              onMapClick={handleMapClick} onStationClick={handleStationClick}
              mapInstanceRef={mapInstanceRef}
            />
            <Dock
              plantingMode={plantingMode} heatmapOn={heatmapOn}
              showLegend={showLegend} mapStyleIdx={mapStyleIdx}
              onPlant={() => { setPlantingMode(p => !p); closePanel() }}
              onHeatmap={() => setHeatmapOn(p => !p)}
              onLegend={() => setShowLegend(p => !p)}
              onZoomIn={() => mapInstanceRef.current?.zoomIn()}
              onZoomOut={() => mapInstanceRef.current?.zoomOut()}
              onCycleStyle={handleCycleStyle}
            />
          </>
        )}
        {activePage === 'stations' && <StationsPage stations={stations} onStationClick={handleStationClick}/>}
        {activePage === 'rankings' && <ZoneRankings onSelectZone={handleZoneSelect}/>}
        {activePage === 'roi'      && <ROIHistoryPage/>}
        {activePage === 'reports'  && <ReportsPage/>}
      </div>

      <div className={`dp-panel-wrap${panelOpen ? ' dp-panel-wrap--open' : ''}`}>
        {panelOpen && (
          <StationPanel
            station={selected}
            zone={selectedZone ?? (selected ? ZONES.find(z => z.id === selected.zone) : null)}
            onClose={closePanel}
            isNew={selected?.planted ?? false}
            onCalculateROI={setRoiModal}
          />
        )}
      </div>

      {roiModal && (
        <ROIModal
          capex={roiModal.capex} type={roiModal.type} zone={roiModal.zone}
          onClose={() => setRoiModal(null)}
        />
      )}
    </div>
  )
}
