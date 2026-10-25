import { supabase } from '@/lib/supabase';

export interface CityRecord {
  id: string;
  city_name: string;
  region: string | null;
  country: string | null;
  country_code: string | null;
  slug: string;
  latitude: number | null;
  longitude: number | null;
  population: number | null;
  aliases: string[] | null;
  active: boolean;
}

const RECENT_KEY = 'sv-recent-cities';
const MAX_RECENT = 5;

// Normalize a user-typed city name to a slug
export function normalizeCityInput(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[,\s]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// Fetch all active cities from the database
export async function fetchAllCities(): Promise<CityRecord[]> {
  const { data, error } = await supabase
    .from('poker_scene_cities')
    .select('*')
    .eq('active', true)
    .order('city_name');
  if (error || !data) return [];
  return data as CityRecord[];
}

// Search cities by name, alias, or slug — client-side fuzzy match
export function searchCities(query: string, cities: CityRecord[], limit = 10): CityRecord[] {
  const q = query.toLowerCase().trim();
  if (!q) return cities.slice(0, limit);

  const matches: { city: CityRecord; score: number }[] = [];
  for (const city of cities) {
    const name = city.city_name.toLowerCase();
    const slug = city.slug.toLowerCase();
    const aliases = (city.aliases ?? []).map(a => a.toLowerCase());
    const region = (city.region ?? '').toLowerCase();
    const fullLabel = `${name}, ${region}, ${city.country ?? ''}`.toLowerCase();

    let score = 0;
    if (name === q || slug === q) score = 100;
    else if (name.startsWith(q) || slug.startsWith(q)) score = 80;
    else if (name.includes(q) || slug.includes(q)) score = 60;
    else if (aliases.some(a => a === q || a.startsWith(q))) score = 70;
    else if (fullLabel.includes(q)) score = 40;
    else continue;

    matches.push({ city, score });
  }
  matches.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (b.city.population ?? 0) - (a.city.population ?? 0);
  });
  return matches.slice(0, limit).map(m => m.city);
}

// Resolve a city by slug from the database
export async function fetchCityBySlug(slug: string): Promise<CityRecord | null> {
  const { data, error } = await supabase
    .from('poker_scene_cities')
    .select('*')
    .eq('slug', slug)
    .eq('active', true)
    .maybeSingle();
  if (error || !data) return null;
  return data as CityRecord;
}

// Haversine distance in km
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Find the nearest city to given coordinates
export function findNearestCity(lat: number, lon: number, cities: CityRecord[]): CityRecord | null {
  let nearest: CityRecord | null = null;
  let minDist = Infinity;
  for (const city of cities) {
    if (city.latitude == null || city.longitude == null) continue;
    const dist = haversineKm(lat, lon, city.latitude, city.longitude);
    if (dist < minDist) {
      minDist = dist;
      nearest = city;
    }
  }
  return nearest;
}

// Reverse-geocode coordinates to a city using the database
export async function resolveCoordinates(lat: number, lon: number): Promise<CityRecord | null> {
  const cities = await fetchAllCities();
  if (cities.length === 0) return null;
  return findNearestCity(lat, lon, cities);
}

// Recent cities — stored in localStorage
export function getRecentCities(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

export function addRecentCity(slug: string): void {
  try {
    const recent = getRecentCities().filter(s => s !== slug);
    recent.unshift(slug);
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
  } catch {
    // ignore
  }
}

// Try to match a free-text location string to a city record
export function matchCityByText(text: string, cities: CityRecord[]): CityRecord | null {
  const q = text.toLowerCase().trim();
  if (!q) return null;
  for (const city of cities) {
    const name = city.city_name.toLowerCase();
    const fullLabel = `${name}, ${(city.region ?? '').toLowerCase()}, ${(city.country ?? '').toLowerCase()}`;
    if (q === name || q === fullLabel || q === city.slug.toLowerCase()) return city;
  }
  for (const city of cities) {
    const name = city.city_name.toLowerCase();
    const aliases = (city.aliases ?? []).map(a => a.toLowerCase());
    if (aliases.includes(q)) return city;
  }
  for (const city of cities) {
    const name = city.city_name.toLowerCase();
    if (q.includes(name) || name.includes(q)) return city;
  }
  return null;
}

// Format a city for display
export function formatCityLabel(city: CityRecord): string {
  const parts = [city.city_name];
  if (city.region) parts.push(city.region);
  if (city.country) parts.push(city.country);
  return parts.join(', ');
}

// Short label for compact UI
export function formatCityShort(city: CityRecord): string {
  const parts = [city.city_name];
  if (city.region) parts.push(city.region);
  return parts.join(', ');
}
