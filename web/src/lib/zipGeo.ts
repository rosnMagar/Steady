/** Approximate centroids for the ZIP codes the demo cohort uses as region labels.
 *
 *  The tables store no addresses — `region` is a coarse ZIP label derived from the pseudonymous
 *  person_id (see server/demo.py), so a point here means "somewhere in this ZIP", not a home.
 *  Census ZCTA centroids, rounded to 4dp; that's the resolution the privacy constraint allows and
 *  all a city-scale map needs. Add a row here when server/demo.py gains a ZIP. */
export const ZIP_CENTROIDS: Record<string, [number, number]> = {
  "63101": [38.6296, -90.1912], // Downtown
  "63104": [38.6094, -90.2130], // Soulard / Lafayette Square
  "63109": [38.5843, -90.2943], // St. Louis Hills
  "63110": [38.6249, -90.2582], // Forest Park Southeast
  "63116": [38.5832, -90.2588], // Dutchtown / Bevo
  "63118": [38.5931, -90.2276], // Benton Park / Cherokee
  "63139": [38.6108, -90.2913], // Clifton Heights / Ellendale
  "63147": [38.6904, -90.2028], // North Riverfront / Baden
};

/** Friendly neighbourhood names — a ZIP alone tells a care manager from out of town nothing. */
export const ZIP_NAMES: Record<string, string> = {
  "63101": "Downtown",
  "63104": "Soulard",
  "63109": "St. Louis Hills",
  "63110": "Forest Park SE",
  "63116": "Dutchtown",
  "63118": "Benton Park",
  "63139": "Clifton Heights",
  "63147": "North Riverfront",
};

/** Map centre used when nothing is plottable (city centre, not a cohort location). */
export const CITY_CENTER: [number, number] = [38.627, -90.2];

export function zipCoords(zip: string): [number, number] | null {
  return ZIP_CENTROIDS[zip.trim()] ?? null;
}

export function zipLabel(zip: string): string {
  const name = ZIP_NAMES[zip.trim()];
  return name ? `${zip} · ${name}` : zip;
}
