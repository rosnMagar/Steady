import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useTheme } from "../lib/theme";
import { zipCoords, zipLabel, CITY_CENTER } from "../lib/zipGeo";

export interface RegionPoint {
  region: string;
  /** Expected caregivers needing outreach from this ZIP — the magnitude the circles encode. */
  load: number;
  people: number;
}

/** Sequential single-hue (blue) ramp, lightest = near zero.
 *  Dark mode gets its own steps rather than a flipped light ramp: against a near-black basemap the
 *  prominent end has to be the LIGHT step, or the busiest ZIP is the one you can't see. */
const RAMP = {
  // The light ramp starts at step 200 rather than the palette's lightest: these marks sit on map
  // tiles, not a flat surface, and anything paler than this disappears into the roads.
  light: ["#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#184f95"],
  dark: ["#184f95", "#256abf", "#3987e5", "#6da7ec", "#b7d3f6"],
} as const;

// Plain OpenStreetMap tiles: no API key, no account, nothing to expire mid-demo. (CARTO's
// light/dark basemaps look better but now stamp "API KEY REQUIRED" across every tile.) Dark mode
// is handled in CSS by inverting the tile pane — see .region-map in index.css.
const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIB = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const R_MIN = 9;
const R_MAX = 30;

/** Leaflet measures its container once, at mount. Inside a card that is still laying out (or in a
 *  column that reflows when the drawer opens) that measurement is stale and half the tiles never
 *  paint, so re-measure after layout settles and on every resize. */
function FitToPoints({ bounds }: { bounds: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    const fit = () => {
      map.invalidateSize();
      if (bounds.length === 1) map.setView(bounds[0], 13);
      else if (bounds.length > 1) map.fitBounds(bounds, { padding: [34, 34], maxZoom: 13 });
    };
    const t = window.setTimeout(fit, 0);
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(map.getContainer());
    return () => {
      window.clearTimeout(t);
      ro.disconnect();
    };
  }, [map, bounds]);
  return null;
}

/** Where the projected outreach load sits across the city.
 *
 *  Circle area (not radius) is proportional to load, and fill steps through a sequential ramp, so
 *  size and colour say the same thing twice — the reading survives both colour-vision deficiency
 *  and a printed screenshot. The ranked list underneath is the keyboard/screen-reader equivalent,
 *  not decoration: a Leaflet canvas is not reachable by tab. */
export function RegionMap({ points, height = 300 }: { points: RegionPoint[]; height?: number }) {
  const { theme } = useTheme();

  const located = useMemo(
    () => points
      .map((p) => ({ ...p, coords: zipCoords(p.region) }))
      .filter((p): p is RegionPoint & { coords: [number, number] } => p.coords != null)
      .sort((a, b) => b.load - a.load),
    [points],
  );
  const missing = points.length - located.length;
  const max = located.reduce((m, p) => Math.max(m, p.load), 0) || 1;
  const bounds = useMemo(() => located.map((p) => p.coords), [located]);
  const ramp = RAMP[theme];
  const ring = theme === "dark" ? "#141414" : "#ffffff";

  const radius = (load: number) => R_MIN + (R_MAX - R_MIN) * Math.sqrt(Math.max(load, 0) / max);
  const fill = (load: number) =>
    ramp[Math.min(ramp.length - 1, Math.floor((load / max) * ramp.length - 1e-9))] ?? ramp[0];

  if (located.length === 0) {
    return (
      <div className="text-sm t-muted" style={{ padding: "1.5rem 0", textAlign: "center" }}>
        No mapped regions for this day.
      </div>
    );
  }

  return (
    <div>
      <div className="region-map" style={{ height }}>
        <MapContainer
          center={CITY_CENTER}
          zoom={12}
          scrollWheelZoom={false}
          attributionControl
          style={{ height: "100%", width: "100%", background: "rgb(var(--surface))" }}
        >
          <TileLayer url={TILE_URL} attribution={ATTRIB} maxZoom={18} />
          <FitToPoints bounds={bounds} />
          {located.map((p) => (
            <CircleMarker
              key={p.region}
              center={p.coords}
              radius={radius(p.load)}
              pathOptions={{
                color: ring,
                weight: 2,
                fillColor: fill(p.load),
                fillOpacity: 0.78,
              }}
            >
              <Tooltip direction="top" offset={[0, -4]} opacity={1} className="region-map-tip">
                <div style={{ fontWeight: 600 }}>{zipLabel(p.region)}</div>
                <div>{p.load} projected · {p.people} {p.people === 1 ? "caregiver" : "caregivers"}</div>
              </Tooltip>
            </CircleMarker>
          ))}
          {/* Direct labels ride on their own zero-radius, non-interactive layers: Leaflet allows
              exactly one tooltip per layer, so a permanent label on the circle itself would
              replace the hover detail rather than sit alongside it. Only the busiest few are
              labelled — the south-side ZIPs sit close enough together that labelling all of them
              collides. */}
          {located.slice(0, 3).map((p) => (
            <CircleMarker
              key={`label-${p.region}`}
              center={p.coords}
              radius={0}
              pathOptions={{ stroke: false, fill: false, interactive: false }}
            >
              <Tooltip permanent direction="center" className="region-map-label">{p.load}</Tooltip>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>

      <div className="text-xs t-muted" style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          Lower
          <span style={{ display: "inline-flex", borderRadius: 4, overflow: "hidden" }}>
            {ramp.map((step) => (
              <span key={step} style={{ width: 20, height: 8, background: step }} />
            ))}
          </span>
          higher
        </span>
        <span>colour and circle size both show projected load</span>
      </div>

      <ul className="region-list" aria-label="Projected load by ZIP code">
        {located.map((p) => (
          <li key={p.region}>
            <span style={{ width: 8, height: 8, borderRadius: 9999, background: fill(p.load), flexShrink: 0 }} aria-hidden />
            <span className="t-text">{zipLabel(p.region)}</span>
            <span className="t-muted" style={{ marginLeft: "auto" }}>{p.load}</span>
          </li>
        ))}
      </ul>

      <p className="text-xs t-muted" style={{ margin: "8px 0 0" }}>
        Points are ZIP-code centres, not caregiver locations.
        {missing > 0 && ` ${missing} region${missing === 1 ? "" : "s"} without a mapped ZIP.`}
      </p>
    </div>
  );
}
