/*
# Location System: City Database + Profile Home City

## Changes to poker_scene_cities
- Add latitude (double precision, nullable)
- Add longitude (double precision, nullable)
- Add population (integer, nullable)
- Add country_code (text, nullable)
- Add aliases (text[], nullable) — alternative city names for normalization

## Changes to user_profiles
- Add home_city_slug (text, nullable) — FK-like reference to poker_scene_cities.slug

## Data
- Seed ~80 major world cities (population 200k+) with coordinates and population
- Existing 5 cities (Winnipeg, Vegas, Toronto, Calgary, Montreal) updated with coordinates

## Security
- poker_scene_cities already has open anon+authenticated SELECT (no change needed)
- user_profiles already has RLS policies (no change needed, home_city_slug is just a new column)
*/

-- ── Add columns to poker_scene_cities ──
ALTER TABLE poker_scene_cities
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision,
  ADD COLUMN IF NOT EXISTS population integer,
  ADD COLUMN IF NOT EXISTS country_code text,
  ADD COLUMN IF NOT EXISTS aliases text[];

-- ── Add home_city_slug to user_profiles ──
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS home_city_slug text;

-- ── Seed major cities ──
-- First update existing 5 cities with coordinates
UPDATE poker_scene_cities SET latitude=49.8951, longitude=-97.1384, population=749607, country_code='CA', aliases=ARRAY['peg','wpg'] WHERE slug='winnipeg';
UPDATE poker_scene_cities SET latitude=36.1699, longitude=-115.1398, population=641903, country_code='US', aliases=ARRAY['vegas','las vegas nv','sin city'] WHERE slug='vegas';
UPDATE poker_scene_cities SET latitude=43.6532, longitude=-79.3832, population=2731571, country_code='CA', aliases=ARRAY['to','tdot','the 6'] WHERE slug='toronto';
UPDATE poker_scene_cities SET latitude=51.0447, longitude=-114.0719, population=1239220, country_code='CA', aliases=ARRAY['yyz'] WHERE slug='calgary';
UPDATE poker_scene_cities SET latitude=45.5017, longitude=-73.5673, population=1704694, country_code='CA', aliases=ARRAY['mtl','yonk'] WHERE slug='montreal';

-- Insert new cities (ON CONFLICT on slug to be idempotent)
INSERT INTO poker_scene_cities (city_name, region, country, slug, active, latitude, longitude, population, country_code, aliases) VALUES
-- Canada
('Vancouver','BC','Canada','vancouver',true,49.2827,-123.1207,675218,'CA',ARRAY['vancity','van']),
('Edmonton','AB','Canada','edmonton',true,53.5461,-113.4938,932546,'CA',ARRAY['edm','e-town']),
('Ottawa','ON','Canada','ottawa',true,45.4215,-75.6972,994837,'CA',ARRAY['bytown']),
('Winnipeg','MB','Canada','winnipeg',true,49.8951,-97.1384,749607,'CA',ARRAY['peg','wpg']),
('Hamilton','ON','Canada','hamilton',true,43.2557,-79.8711,569353,'CA',ARRAY['hammer']),
('Quebec City','QC','Canada','quebec-city',true,46.8139,-71.2080,531902,'CA',ARRAY['quebec']),
('Halifax','NS','Canada','halifax',true,44.6488,-63.5752,403131,'CA',ARRAY['hfx']),
('Victoria','BC','Canada','victoria',true,48.4284,-123.3656,335696,'CA',ARRAY['vic']),
('Saskatoon','SK','Canada','saskatoon',true,52.1332,-106.6700,273010,'CA',ARRAY['stoon']),
('Regina','SK','Canada','regina',true,50.4452,-104.6189,215000,'CA',ARRAY['reg']),
('Windsor','ON','Canada','windsor',true,42.3149,-83.0364,329760,'CA',ARRAY['ydg']),
('London','ON','Canada','london-on',true,42.9849,-81.2453,383437,'CA',ARRAY['forest city']),
-- USA
('New York','NY','USA','new-york',true,40.7128,-74.0060,8336817,'US',ARRAY['nyc','manhattan','the city','big apple']),
('Los Angeles','CA','USA','los-angeles',true,34.0522,-118.2437,3979576,'US',ARRAY['la','lax']),
('Chicago','IL','USA','chicago',true,41.8781,-87.6298,2693976,'US',ARRAY['chi','second city']),
('Miami','FL','USA','miami',true,25.7617,-80.1918,467963,'US',ARRAY['mia','the 305']),
('Dallas','TX','USA','dallas',true,32.7767,-96.7970,1343573,'US',ARRAY['dal','dtx']),
('Houston','TX','USA','houston',true,29.7604,-95.3698,2320268,'US',ARRAY['hou','h-town']),
('Phoenix','AZ','USA','phoenix',true,33.4484,-112.0740,1660272,'US',ARRAY['phx']),
('Philadelphia','PA','USA','philadelphia',true,39.9526,-75.1652,1584064,'US',ARRAY['philly']),
('San Antonio','TX','USA','san-antonio',true,29.4241,-98.4936,1532233,'US',ARRAY['sa','sat']),
('San Diego','CA','USA','san-diego',true,32.7157,-117.1611,1425976,'US',ARRAY['sd']),
('San Francisco','CA','USA','san-francisco',true,37.7749,-122.4194,873965,'US',ARRAY['sf','bay area','the city by the bay']),
('Austin','TX','USA','austin',true,30.2672,-97.7431,978908,'US',ARRAY['atx']),
('Seattle','WA','USA','seattle',true,47.6062,-122.3321,753675,'US',ARRAY['sea','emerald city']),
('Denver','CO','USA','denver',true,39.7392,-104.9903,727211,'US',ARRAY['den','mile high']),
('Boston','MA','USA','boston',true,42.3601,-71.0589,692600,'US',ARRAY['bos','bean town']),
('Atlanta','GA','USA','atlanta',true,33.7490,-84.3880,506811,'US',ARRAY['atl','the a']),
('Minneapolis','MN','USA','minneapolis',true,44.9778,-93.2650,429606,'US',ARRAY['msp','mini apple']),
('Las Vegas','NV','USA','las-vegas',true,36.1699,-115.1398,641903,'US',ARRAY['vegas','sin city']),
('Portland','OR','USA','portland',true,45.5152,-122.6784,654741,'US',ARRAY['pdx','p-town']),
('Sacramento','CA','USA','sacramento',true,38.5816,-121.4944,513624,'US',ARRAY['sac','sactown']),
('New Orleans','LA','USA','new-orleans',true,29.9511,-90.0715,390144,'US',ARRAY['nola','the big easy']),
('Tampa','FL','USA','tampa',true,27.9506,-82.4572,399700,'US',ARRAY['tpa']),
('Pittsburgh','PA','USA','pittsburgh',true,40.4406,-79.9959,301048,'US',ARRAY['pgh','steel city']),
('Cleveland','OH','USA','cleveland',true,41.4993,-81.6944,381009,'US',ARRAY['cle','the land']),
('Detroit','MI','USA','detroit',true,42.3314,-83.0458,670031,'US',ARRAY['det','motor city']),
('Minneapolis','MN','USA','minneapolis-mn',true,44.9778,-93.2650,429606,'US',ARRAY['msp']),
('Nashville','TN','USA','nashville',true,36.1627,-86.7816,691243,'US',ARRAY['nash','music city']),
('Kansas City','MO','USA','kansas-city',true,39.0997,-94.5786,491918,'US',ARRAY['kc']),
('Columbus','OH','USA','columbus',true,39.9612,-82.9988,898553,'US',ARRAY['cbus']),
('Indianapolis','IN','USA','indianapolis',true,39.7684,-86.1581,876384,'US',ARRAY['indy']),
('Charlotte','NC','USA','charlotte',true,35.2271,-80.8431,885708,'US',ARRAY['clt','the qc']),
('Orlando','FL','USA','orlando',true,28.5383,-81.3792,287486,'US',ARRAY['orl','the city beautiful']),
('Reno','NV','USA','reno',true,39.5296,-119.8138,264165,'US',ARRAY['biggest little city']),
('Atlantic City','NJ','USA','atlantic-city',true,39.3643,-74.4229,39945,'US',ARRAY['ac','vegas east']),
-- International
('London','England','UK','london-uk',true,51.5074,-0.1278,8961989,'GB',ARRAY['london uk','ldn','the big smoke']),
('Paris','Île-de-France','France','paris',true,48.8566,2.3522,2161000,'FR',ARRAY['paris france','city of light']),
('Madrid','Madrid','Spain','madrid',true,40.4168,-3.7038,3223334,'ES',ARRAY[]::text[]),
('Barcelona','Catalonia','Spain','barcelona',true,41.3851,2.1734,1620343,'ES',ARRAY['bcn']),
('Berlin','Berlin','Germany','berlin',true,52.5200,13.4050,3669491,'DE',ARRAY[]::text[]),
('Sydney','NSW','Australia','sydney',true,-33.8688,151.2093,5312163,'AU',ARRAY['syd']),
('Melbourne','Victoria','Australia','melbourne',true,-37.8136,144.9631,5078195,'AU',ARRAY['melb']),
('Tokyo','Tokyo','Japan','tokyo',true,35.6762,139.6503,13960000,'JP',ARRAY[]::text[]),
('Manila','Metro Manila','Philippines','manila',true,14.5995,120.9842,1780148,'PH',ARRAY[]::text[]),
('Amsterdam','North Holland','Netherlands','amsterdam',true,52.3676,4.9041,872680,'NL',ARRAY[]::text[]),
('Dublin','Leinster','Ireland','dublin',true,53.3498,-6.2603,1390180,'IE',ARRAY[]::text[]),
('Vienna','Vienna','Austria','vienna',true,48.2082,16.3738,1911191,'AT',ARRAY[]::text[]),
('Prague','Prague','Czech Republic','prague',true,50.0755,14.4378,1335084,'CZ',ARRAY[]::text[]),
('Rome','Lazio','Italy','rome',true,41.9028,12.4964,2872800,'IT',ARRAY[]::text[]),
('Milan','Lombardy','Italy','milan',true,45.4642,9.1900,1396059,'IT',ARRAY['milano']),
('Mexico City','CDMX','Mexico','mexico-city',true,19.4326,-99.1332,9209944,'MX',ARRAY['cdmx','df']),
('Monterrey','Nuevo León','Mexico','monterrey',true,25.6866,-100.3161,5341171,'MX',ARRAY[]::text[]),
('Buenos Aires','Buenos Aires','Argentina','buenos-aires',true,-34.6037,-58.3816,3075646,'AR',ARRAY['ba','baires']),
('São Paulo','São Paulo','Brazil','sao-paulo',true,-23.5505,-46.6333,12325232,'BR',ARRAY['sao paulo','sampa']),
('Rio de Janeiro','Rio de Janeiro','Brazil','rio-de-janeiro',true,-22.9068,-43.1729,6747815,'BR',ARRAY['rio','rj']),
('Montevideo','Montevideo','Uruguay','montevideo',true,-34.9011,-56.1645,1318755,'UY',ARRAY[]::text[]),
('Santiago','Santiago','Chile','santiago',true,-33.4489,-70.6693,6160000,'CL',ARRAY['stgo']),
('Lima','Lima','Peru','lima',true,-12.0464,-77.0428,10391000,'PE',ARRAY[]::text[]),
('Bogotá','Bogotá','Colombia','bogota',true,4.7110,-74.0721,7180000,'CO',ARRAY[]::text[]),
('Panama City','Panamá','Panama','panama-city',true,8.9824,-79.5199,880692,'PA',ARRAY[]::text[]),
('San José','San José','Costa Rica','san-jose-cr',true,9.9281,-84.0907,1369185,'CR',ARRAY[]::text[]),
('London','England','UK','london',true,51.5074,-0.1278,8961989,'GB',ARRAY['london uk','ldn','the big smoke'])
ON CONFLICT (slug) DO UPDATE SET
  latitude=EXCLUDED.latitude,
  longitude=EXCLUDED.longitude,
  population=EXCLUDED.population,
  country_code=EXCLUDED.country_code,
  aliases=EXCLUDED.aliases;
