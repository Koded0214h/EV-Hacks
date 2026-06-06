import { useState, useRef, useEffect } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import {
  Zap, LayoutDashboard, MapPin, BarChart3, Calculator,
  FileText, ChevronRight, X, PlusCircle, Layers, ZoomIn,
  ZoomOut, Map, Download, Sparkles, AlertTriangle,
  TrendingUp, Clock, CheckCircle, Navigation,
} from 'lucide-react'
import './Dashboard.css'

// ─── Config ─────────────────────────────────────────────────
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN

// ─── Data ────────────────────────────────────────────────────
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
  { id:'overview',  icon:<LayoutDashboard size={16} />, label:'Overview'      },
  { id:'stations',  icon:<MapPin size={16} />,          label:'My Stations'   },
  { id:'rankings',  icon:<BarChart3 size={16} />,       label:'Zone Rankings' },
  { id:'roi',       icon:<Calculator size={16} />,      label:'ROI History'   },
  { id:'reports',   icon:<FileText size={16} />,        label:'Reports'       },
]

const ROI_HISTORY = [
  { zone:'Lekki Phase 1',   type:'DC Fast',    capex:'₦8M',   payback:'12 mo', roi:'132%', date:'2 days ago' },
  { zone:'Victoria Island', type:'AC Level 2', capex:'₦5.5M', payback:'15 mo', roi:'108%', date:'5 days ago' },
  { zone:'Ajah',            type:'AC Level 2', capex:'₦5M',   payback:'18 mo', roi:'87%',  date:'1 week ago' },
]

// ─── Helpers ─────────────────────────────────────────────────
function makeCircle(lng, lat, radiusKm, steps = 72) {
  const dX = radiusKm / (111.320 * Math.cos(lat * Math.PI / 180))
  const dY = radiusKm / 110.574
  const coords = Array.from({ length: steps }, (_, i) => {
    const θ = (i / steps) * 2 * Math.PI
    return [lng + dX * Math.cos(θ), lat + dY * Math.sin(θ)]
  })
  coords.push(coords[0])
  return { type:'Polygon', coordinates:[coords] }
}

function closestZone(lng, lat) {
  return ZONES.reduce((best, z) => {
    const d = Math.hypot(z.lng - lng, z.lat - lat)
    return d < Math.hypot(best.lng - lng, best.lat - lat) ? z : best
  })
}

function zoneColor(score) {
  if (score >= 80) return '#16A34A'
  if (score >= 65) return '#22c55e'
  if (score >= 50) return '#D97706'
  return '#DC2626'
}
function tierColor(tier) {
  return { A:'#16A34A', B:'#D97706', C:'#64748B', D:'#DC2626' }[tier] ?? '#94A3B8'
}
function statusColor(s) {
  return { available:'#16A34A', busy:'#D97706', offline:'#DC2626' }[s] ?? '#94A3B8'
}

// ─── Demand ring ─────────────────────────────────────────────
function DemandRing({ score }) {
  const r = 40, circ = 2 * Math.PI * r
  const dash = (score / 100) * circ
  const color = zoneColor(score)
  return (
    <svg width="100" height="100" viewBox="0 0 100 100">
      <circle cx="50" cy="50" r={r} fill="none" stroke="#E2E8F0" strokeWidth="7" />
      <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="7"
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        transform="rotate(-90 50 50)"
        style={{ transition:'stroke-dasharray 1s ease' }} />
      <text x="50" y="54" textAnchor="middle" fontSize="20" fontWeight="700" fill="#0F172A" fontFamily="Inter,sans-serif">{score}</text>
      <text x="50" y="67" textAnchor="middle" fontSize="9" fill="#94A3B8" fontFamily="Inter,sans-serif">/100</text>
    </svg>
  )
}

// ─── ROI table ────────────────────────────────────────────────
function calcROI(capex, type) {
  const base = type === 'DC Fast' ? 1.55 : 1.03
  const rows = [
    { label:'Conservative', mult:.67, bg:'rgba(148,163,184,.08)', color:'#64748B' },
    { label:'Base Case',    mult:1,   bg:'rgba(22,163,74,.06)',   color:'#16A34A' },
    { label:'Optimistic',   mult:1.44,bg:'rgba(74,222,128,.08)',  color:'#4ade80' },
  ]
  return rows.map(r => {
    const monthly = base * r.mult * 1e6
    return { ...r,
      annual:`₦${(monthly * 12).toLocaleString('en-NG',{maximumFractionDigits:0})}`,
      monthly:`₦${monthly.toLocaleString('en-NG',{maximumFractionDigits:0})}`,
      payback:`${Math.round(capex / monthly)} mo`,
    }
  })
}

function ROITable({ capex, type }) {
  const rows = calcROI(capex || 8000000, type || 'DC Fast')
  return (
    <table className="dp-roi-table">
      <thead><tr><th>Scenario</th><th>Annual</th><th>Monthly</th><th>Payback</th></tr></thead>
      <tbody>
        {rows.map(r => (
          <tr key={r.label} style={{ background:r.bg }}>
            <td><span className="dp-roi-badge" style={{ color:r.color, background:`${r.color}18` }}>{r.label}</span></td>
            <td className="dp-roi-num">{r.annual}</td>
            <td className="dp-roi-num">{r.monthly}</td>
            <td className="dp-roi-num" style={{ color:r.color }}>{r.payback}</td>
          </tr>
        ))}
      </tbody>
    </table>
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
          <Sparkles size={15} /> Generate Investor Brief
        </button>
      )}
      {state === 'loading' && (
        <div className="dp-brief-loading">
          <div className="dp-brief-spinner" /><span>Generating analysis…</span>
        </div>
      )}
      {state === 'done' && (
        <div className="dp-brief-result">
          <div className="dp-brief-ai-badge"><Sparkles size={11} /> AI Generated</div>
          <p className="dp-brief-headline">{zone.name} — Strong ROI opportunity with manageable competition</p>
          <p className="dp-brief-summary">
            {zone.name} scores {zone.score}/100 on EV demand and qualifies as a Tier {zone.tier} zone.
            With {zone.evTraffic} EV trips daily and only {zone.existing} existing station{zone.existing !== 1 ? 's' : ''} serving the area,
            infrastructure supply is significantly below demand. A 4-port DC Fast station here is
            projected to reach breakeven in 12–15 months under base-case assumptions.
          </p>
          <div className="dp-brief-metrics">
            {[
              { val:`${zone.score}/100`, lbl:'Demand Score' },
              { val:`${zone.existing} nearby`, lbl:'Competition' },
              { val:zone.evTraffic, lbl:'Daily Traffic' },
            ].map(m => (
              <div className="dp-brief-metric" key={m.lbl}>
                <span className="dp-brief-metric-val">{m.val}</span>
                <span className="dp-brief-metric-lbl">{m.lbl}</span>
              </div>
            ))}
          </div>
          {zone.score < 60 && (
            <div className="dp-brief-risk">
              <AlertTriangle size={13} /> Low demand zone — consider a smaller AC Level 2 deployment to reduce capex exposure.
            </div>
          )}
          <div className="dp-brief-rec">
            <TrendingUp size={13} /> DC Fast charging recommended for {zone.name} based on commercial traffic density and driver dwell time of &lt;30 min.
          </div>
          <div className="dp-brief-actions">
            <button className="dp-brief-export"><Download size={13} /> Export PDF</button>
            <button className="dp-brief-reset" onClick={() => setState('idle')}>Regenerate</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Station Panel ────────────────────────────────────────────
function StationPanel({ station, zone, onClose, isNew }) {
  const [name, setName]     = useState(station?.name ?? 'New Station')
  const [type, setType]     = useState(station?.type ?? 'AC Level 2')
  const [ports, setPorts]   = useState(station?.ports ?? 4)
  const [capex, setCapex]   = useState(station?.capex ?? 5000000)
  const [opex, setOpex]     = useState(120000)
  const [roiVisible, setROI] = useState(!isNew)
  const z = zone ?? ZONES.find(z => z.id === station?.zone)

  return (
    <aside className="dp-panel">
      <div className="dp-panel-header">
        <div className="dp-panel-title-row">
          <input className="dp-panel-name-input" value={name} onChange={e => setName(e.target.value)} />
          <button className="dp-panel-close" onClick={onClose}><X size={16} /></button>
        </div>
        {z && <div className="dp-panel-coords">{z.name} · Demand Zone {z.tier}</div>}
      </div>

      <div className="dp-panel-scroll">
        {z && (
          <div className="dp-panel-section">
            <div className="dp-section-label">Zone Intelligence</div>
            <div className="dp-zone-intel">
              <div className="dp-zone-ring-wrap">
                <DemandRing score={z.score} />
                <div className="dp-zone-tier" style={{ background:`${tierColor(z.tier)}18`, color:tierColor(z.tier) }}>Tier {z.tier}</div>
              </div>
              <div className="dp-zone-stats">
                <div className="dp-zone-stat"><span>{z.pop}</span><label>Population</label></div>
                <div className="dp-zone-stat"><span>{z.poi}</span><label>POIs</label></div>
                <div className="dp-zone-stat"><span>{z.evTraffic}</span><label>EV Traffic</label></div>
                <div className="dp-zone-stat"><span>{z.existing}</span><label>Stations</label></div>
              </div>
            </div>
            {z.score < 55 && (
              <div className="dp-risk-flag"><AlertTriangle size={13} /> Low demand zone — consider smaller capex.</div>
            )}
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
                onChange={e => setPorts(Number(e.target.value))} />
            </label>
            <label className="dp-label">Capital Expenditure (₦)
              <input className="dp-input" type="number" value={capex}
                onChange={e => setCapex(Number(e.target.value))} step={500000} />
            </label>
            <label className="dp-label">Monthly OPEX (₦)
              <input className="dp-input" type="number" value={opex}
                onChange={e => setOpex(Number(e.target.value))} step={10000} />
            </label>
          </div>
          <button className="dp-calc-btn" onClick={() => setROI(true)}>
            <Calculator size={14} /> Calculate ROI
          </button>
        </div>

        {roiVisible && (
          <div className="dp-panel-section">
            <div className="dp-section-label">ROI Projections</div>
            <ROITable capex={capex} type={type} />
            <div className="dp-roi-note">Based on ₦180/kWh, 45 min avg session, zone demand score {z?.score ?? 80}/100.</div>
          </div>
        )}

        {z && (
          <div className="dp-panel-section">
            <div className="dp-section-label">Competition</div>
            <div className="dp-competitor">
              <span className="dp-comp-count">{z.existing}</span>
              <span>existing station{z.existing !== 1 ? 's' : ''} within 1km</span>
            </div>
          </div>
        )}

        <div className="dp-panel-section">
          <div className="dp-section-label">AI Investor Brief</div>
          <AIBrief zone={z} />
        </div>
      </div>
    </aside>
  )
}

// ─── Legend panel ─────────────────────────────────────────────
function LegendPanel() {
  return (
    <div className="dp-legend">
      <div className="dp-legend-title">Demand Zones</div>
      {[
        { label:'Tier A  (80+)',  color:'#16A34A' },
        { label:'Tier B  (65–79)',color:'#22c55e' },
        { label:'Tier C  (50–64)',color:'#D97706' },
        { label:'Tier D  (<50)',  color:'#DC2626' },
      ].map(l => (
        <div className="dp-legend-item" key={l.label}>
          <span className="dp-legend-swatch" style={{ background:`${l.color}40`, border:`1.5px solid ${l.color}` }} />
          <span>{l.label}</span>
        </div>
      ))}
      <div className="dp-legend-divider" />
      <div className="dp-legend-title">Stations</div>
      {[
        { label:'Available', color:'#16A34A' },
        { label:'Busy',      color:'#D97706' },
        { label:'Offline',   color:'#DC2626' },
      ].map(l => (
        <div className="dp-legend-item" key={l.label}>
          <span className="dp-legend-dot" style={{ background:l.color }} />
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
  const markersRef    = useRef({})

  // keep refs fresh so event handlers never go stale
  const plantRef     = useRef(plantingMode)
  const clickCbRef   = useRef(onMapClick)
  const stationCbRef = useRef(onStationClick)
  useEffect(() => { plantRef.current     = plantingMode }, [plantingMode])
  useEffect(() => { clickCbRef.current   = onMapClick   }, [onMapClick])
  useEffect(() => { stationCbRef.current = onStationClick }, [onStationClick])

  // init
  useEffect(() => {
    mapboxgl.accessToken = MAPBOX_TOKEN
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [3.3792, 6.5244],
      zoom: 11,
      attributionControl: false,
    })
    map.addControl(new mapboxgl.AttributionControl({ compact:true }), 'bottom-right')
    mapRef.current = map
    if (mapInstanceRef) mapInstanceRef.current = map

    map.on('load', () => {
      // ── zone circle source ──
      const features = ZONES.map(z => ({
        type:'Feature',
        properties:{ id:z.id, name:z.name, score:z.score, tier:z.tier, color:zoneColor(z.score) },
        geometry:makeCircle(z.lng, z.lat, z.radiusKm),
      }))
      map.addSource('zones', { type:'geojson', data:{ type:'FeatureCollection', features } })

      map.addLayer({
        id:'zones-fill', type:'fill', source:'zones',
        paint:{ 'fill-color':['get','color'], 'fill-opacity':0.18 },
      })
      map.addLayer({
        id:'zones-outline', type:'line', source:'zones',
        paint:{ 'line-color':['get','color'], 'line-width':1.5, 'line-opacity':0.55, 'line-dasharray':[2,1.5] },
      })
      map.addLayer({
        id:'zones-label', type:'symbol', source:'zones',
        layout:{
          'text-field':['get','name'],
          'text-size':11,
          'text-font':['DIN Offc Pro Medium','Arial Unicode MS Regular'],
          'text-anchor':'center',
          'text-offset':[0,0],
        },
        paint:{
          'text-color':['get','color'],
          'text-halo-color':'rgba(255,255,255,0.9)',
          'text-halo-width':2,
        },
      })

      // add initial markers
      INIT_STATIONS.forEach(s => addMarker(map, s))
    })

    // planting click
    map.on('click', e => {
      if (!plantRef.current) return
      clickCbRef.current({ lng:e.lngLat.lng, lat:e.lngLat.lat })
    })

    return () => {
      Object.values(markersRef.current).forEach(m => m.remove())
      markersRef.current = {}
      map.remove()
      mapRef.current = null
    }
  }, [])

  // heatmap toggle
  useEffect(() => {
    const map = mapRef.current
    if (!map?.isStyleLoaded()) return
    const vis = heatmapOn ? 'visible' : 'none'
    ;['zones-fill','zones-outline','zones-label'].forEach(id => map.setLayoutProperty(id,'visibility',vis))
  }, [heatmapOn])

  // add new markers when station list grows
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    stations.forEach(s => {
      if (!markersRef.current[s.id]) addMarker(map, s)
    })
  }, [stations])

  // update marker colors when status changes
  useEffect(() => {
    stations.forEach(s => {
      const el = markersRef.current[s.id]?.getElement()
      if (el) el.style.background = statusColor(s.status)
    })
  }, [stations])

  function addMarker(map, s) {
    const el = document.createElement('div')
    el.className = `mb-marker mb-marker--${s.status}${s.planted ? ' mb-marker--new' : ''}`
    el.style.cssText = `
      width:26px; height:26px;
      background:${statusColor(s.status)};
      border:2.5px solid #fff;
      border-radius:50%;
      cursor:pointer;
      display:flex; align-items:center; justify-content:center;
      box-shadow:0 2px 10px rgba(0,0,0,.22);
      position:relative; z-index:1;
    `
    el.innerHTML = `<svg width="11" height="11" viewBox="0 0 10 10" fill="white" style="display:block"><path d="M6 1L2 6h3.5L4 9.5 8.5 4H5L6 1z"/></svg>`

    // pulse ring
    const ring = document.createElement('div')
    ring.className = 'mb-marker-ring'
    ring.style.cssText = `
      position:absolute;
      width:40px; height:40px;
      border:1.5px solid ${statusColor(s.status)};
      border-radius:50%;
      top:50%; left:50%;
      animation:mbRingPulse 2.4s ease-out infinite;
      pointer-events:none;
    `
    el.appendChild(ring)

    el.addEventListener('click', e => { e.stopPropagation(); stationCbRef.current(s) })

    const marker = new mapboxgl.Marker({ element:el, anchor:'center' })
      .setLngLat([s.lng, s.lat])
      .addTo(map)
    markersRef.current[s.id] = marker
  }

  return (
    <div className={`dp-map-canvas${plantingMode ? ' dp-map-canvas--plant' : ''}`}>
      <div ref={containerRef} style={{ width:'100%', height:'100%' }} />
      {showLegend && <LegendPanel />}
      {plantingMode && <div className="dp-plant-hint">Click anywhere on the map to plant a station</div>}
    </div>
  )
}

// ─── Dock ─────────────────────────────────────────────────────
function Dock({ plantingMode, heatmapOn, showLegend, onPlant, onHeatmap, onLegend, onZoomIn, onZoomOut }) {
  return (
    <div className="dp-dock">
      <button className={`dp-dock-btn${plantingMode ? ' dp-dock-btn--active' : ''}`} onClick={onPlant}>
        <PlusCircle size={18} /><span>Plant Station</span>
      </button>
      <div className="dp-dock-divider" />
      <button className={`dp-dock-btn${heatmapOn ? ' dp-dock-btn--active' : ''}`} onClick={onHeatmap}>
        <Layers size={18} /><span>Heatmap</span>
      </button>
      <div className="dp-dock-divider" />
      <button className="dp-dock-btn" onClick={onZoomIn}><ZoomIn size={18} /><span>Zoom In</span></button>
      <button className="dp-dock-btn" onClick={onZoomOut}><ZoomOut size={18} /><span>Zoom Out</span></button>
      <div className="dp-dock-divider" />
      <button className={`dp-dock-btn${showLegend ? ' dp-dock-btn--active' : ''}`} onClick={onLegend}>
        <Map size={18} /><span>Legend</span>
      </button>
    </div>
  )
}

// ─── Sidebar ──────────────────────────────────────────────────
function Sidebar({ activePage, setActivePage, stations }) {
  return (
    <aside className="dp-sidebar">
      <div className="dp-sidebar-top">
        <a href="#/" className="dp-wordmark">
          <span className="dp-wordmark-bolt"><Zap size={12} /></span>EV Hacks
        </a>
        <div className="dp-sidebar-role">Investor Dashboard</div>
      </div>

      <nav className="dp-nav">
        {SIDEBAR_NAV.map(({ id, icon, label }) => (
          <button key={id}
            className={`dp-nav-item${activePage === id ? ' dp-nav-item--active' : ''}`}
            onClick={() => setActivePage(id)}>
            {icon}<span>{label}</span>
            {activePage === id && <ChevronRight size={14} className="dp-nav-arrow" />}
          </button>
        ))}
      </nav>

      <div className="dp-sidebar-stats">
        <div className="dp-sidebar-stats-title">Live Stats</div>
        {[
          { label:'Stations Planted', val:String(stations.length), icon:<MapPin size={14}/> },
          { label:'Top Zone',         val:'Lekki Phase 1',         icon:<BarChart3 size={14}/>, sm:true },
          { label:'Best ROI',         val:'132%',                  icon:<TrendingUp size={14}/> },
          { label:'Avg Payback',      val:'14 mo',                 icon:<Clock size={14}/> },
        ].map(({ label, val, icon, sm }) => (
          <div className="dp-stat-card" key={label}>
            <div className="dp-stat-icon">{icon}</div>
            <div>
              <div className={`dp-stat-val${sm ? ' dp-stat-val--sm' : ''}`}>{val}</div>
              <div className="dp-stat-lbl">{label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="dp-sidebar-bottom">
        <div className="dp-sidebar-updated"><Clock size={12} />Updated just now</div>
        <a href="#/driver" className="dp-switch-link"><Navigation size={13} />Switch to Driver View</a>
      </div>
    </aside>
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
          <thead>
            <tr><th>#</th><th>Zone</th><th>Tier</th><th>Demand Score</th><th>EV Traffic</th><th>POIs</th><th>Stations</th><th></th></tr>
          </thead>
          <tbody>
            {[...ZONES].sort((a,b)=>b.score-a.score).map((z,i) => (
              <tr key={z.id}>
                <td className="dp-rank-num">{i+1}</td>
                <td className="dp-rank-name">{z.name}</td>
                <td><span className="dp-tier-badge" style={{ background:`${tierColor(z.tier)}18`, color:tierColor(z.tier) }}>{z.tier}</span></td>
                <td>
                  <div className="dp-score-bar-wrap">
                    <div className="dp-score-bar" style={{ width:`${z.score}%`, background:zoneColor(z.score) }} />
                    <span className="dp-score-num">{z.score}</span>
                  </div>
                </td>
                <td>{z.evTraffic}</td>
                <td>{z.poi}</td>
                <td>{z.existing}</td>
                <td><button className="dp-rank-btn" onClick={() => onSelectZone(z)}>View <ChevronRight size={12} /></button></td>
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
            <div className="dp-history-card-left">
              <div className="dp-history-zone">{r.zone}</div>
              <div className="dp-history-meta">{r.type} · Capex {r.capex}</div>
              <div className="dp-history-date">{r.date}</div>
            </div>
            <div className="dp-history-card-right">
              <div className="dp-history-roi">{r.roi}</div>
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
            <div className="dp-report-icon"><FileText size={20} /></div>
            <div className="dp-report-info">
              <div className="dp-report-name">{r.name}</div>
              <div className="dp-report-date">{r.date}</div>
            </div>
            <span className={`dp-report-status dp-report-status--${r.status}`}>
              {r.status === 'ready' ? <><CheckCircle size={12}/> Ready</> : <><Clock size={12}/> Draft</>}
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
              {z && (
                <div className="dp-station-zone">
                  <MapPin size={11} />{z.name}
                  <span className="dp-station-tier" style={{ color:tierColor(z.tier) }}>Tier {z.tier}</span>
                </div>
              )}
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
  const [showLegend,   setShowLegend]   = useState(false)
  const mapInstanceRef = useRef(null)

  const panelOpen = selected !== null || selectedZone !== null

  const handleMapClick = ({ lng, lat }) => {
    const zone = closestZone(lng, lat)
    const newId = ++_nextId
    const s = { id:newId, name:`New Station`, status:'available', type:'AC Level 2', ports:4, capex:5000000, zone:zone.id, lng, lat, planted:true }
    setStations(prev => [...prev, s])
    setSelected(s)
    setSelZone(null)
    setPlantingMode(false)
  }

  const handleStationClick = (s) => {
    setSelected(s)
    setSelZone(null)
    // fly to station
    mapInstanceRef.current?.flyTo({ center:[s.lng, s.lat], zoom:13, duration:900 })
  }

  const handleZoneSelect = (z) => {
    setSelZone(z)
    setSelected(null)
    setActivePage('overview')
    mapInstanceRef.current?.flyTo({ center:[z.lng, z.lat], zoom:13, duration:900 })
  }

  const closePanel = () => { setSelected(null); setSelZone(null) }

  return (
    <div className="dp-root">
      <Sidebar
        activePage={activePage}
        setActivePage={p => { setActivePage(p); closePanel() }}
        stations={stations}
      />

      <div className="dp-main">
        {activePage === 'overview' && (
          <>
            <MapboxMap
              stations={stations}
              heatmapOn={heatmapOn}
              plantingMode={plantingMode}
              showLegend={showLegend}
              onMapClick={handleMapClick}
              onStationClick={handleStationClick}
              mapInstanceRef={mapInstanceRef}
            />
            <Dock
              plantingMode={plantingMode}
              heatmapOn={heatmapOn}
              showLegend={showLegend}
              onPlant={() => { setPlantingMode(p => !p); closePanel() }}
              onHeatmap={() => setHeatmapOn(p => !p)}
              onLegend={() => setShowLegend(p => !p)}
              onZoomIn={() => mapInstanceRef.current?.zoomIn()}
              onZoomOut={() => mapInstanceRef.current?.zoomOut()}
            />
          </>
        )}
        {activePage === 'stations'  && <StationsPage  stations={stations} onStationClick={handleStationClick} />}
        {activePage === 'rankings'  && <ZoneRankings  onSelectZone={handleZoneSelect} />}
        {activePage === 'roi'       && <ROIHistoryPage />}
        {activePage === 'reports'   && <ReportsPage />}
      </div>

      <div className={`dp-panel-wrap${panelOpen ? ' dp-panel-wrap--open' : ''}`}>
        {panelOpen && (
          <StationPanel
            station={selected}
            zone={selectedZone ?? (selected ? ZONES.find(z => z.id === selected.zone) : null)}
            onClose={closePanel}
            isNew={selected?.planted ?? false}
          />
        )}
      </div>
    </div>
  )
}
