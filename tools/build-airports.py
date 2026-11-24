#!/usr/bin/env python3
"""Build js/data/airports-world.js: every airport with scheduled passenger service, worldwide.

Sources (download both, then run this script):
  OurAirports (public domain)
    https://github.com/davidmegginson/ourairports-data  -> airports.csv
  mwgg/Airports (MIT License, Copyright (c) 2014 mwgg), used for each airport's time zone
    https://github.com/mwgg/Airports                    -> airports.json

Usage:
  python3 tools/build-airports.py path/to/airports.csv path/to/airports.json

Airports already in js/data/airports.js (the hand-curated list with friendly names and aliases)
are skipped, so the curated entries always win. Every time zone is checked against the system
time zone database, and zones whose UTC offset is far from the airport's longitude are reported.
"""
import csv
import json
import re
import sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

ROOT = Path(__file__).resolve().parent.parent
CURATED = ROOT / 'js' / 'data' / 'airports.js'
OUT = ROOT / 'js' / 'data' / 'airports-world.js'

# Zones newer than some browsers' time zone data, mapped to an older zone with the same rules.
TZ_COMPAT = {
    'America/Ciudad_Juarez': 'America/Denver',
    'Europe/Kyiv': 'Europe/Kiev',
    'America/Nuuk': 'America/Godthab',
    'Pacific/Kanton': 'Pacific/Enderbury',
}


# Corrections for wrong zones in the source data, found by the checks below. Most are border airports
# that were given a neighboring country's zone; several of those differ in offset or daylight saving.
# Left as is: PRN (Kosovo officially uses Europe/Belgrade) and CJS (mapped to Denver by TZ_COMPAT).
TZ_FIX = {
    'AVR': 'Asia/Kolkata',          # Amravati, India (source said Lisbon)
    'BOR': 'Asia/Vientiane',        # Bokeo, Laos (source said Paris)
    'YZY': 'Asia/Shanghai',         # Zhangye, China (source said Vancouver)
    'SQD': 'Asia/Shanghai',         # Shangrao, China (source said Lima)
    'YAM': 'America/Toronto',       # Sault Ste. Marie, Canada
    'YXX': 'America/Vancouver',     # Abbotsford, Canada
    'NRN': 'Europe/Berlin',         # Weeze, Germany
    'OMD': 'Africa/Windhoek',       # Oranjemund, Namibia
    'GOM': 'Africa/Lubumbashi',     # Goma, DR Congo
    'MLN': 'Africa/Ceuta',          # Melilla, Spain (Casablanca has different rules)
    'NDB': 'Africa/Nouakchott',     # Nouadhibou, Mauritania (El Aaiun is an hour ahead)
    'ETM': 'Asia/Jerusalem',        # Ramon, Israel (Amman has different rules)
    'SZG': 'Europe/Vienna',         # Salzburg, Austria
    'ACH': 'Europe/Zurich',         # St. Gallen-Altenrhein, Switzerland
    'TIJ': 'America/Tijuana',       # Tijuana, Mexico
    'IGU': 'America/Sao_Paulo',     # Foz do Iguacu, Brazil
    'PMG': 'America/Campo_Grande',  # Ponta Pora, Brazil (Asuncion has different rules)
    'TBT': 'America/Manaus',        # Tabatinga, Brazil (Bogota is an hour behind)
    'ARI': 'America/Santiago',      # Arica, Chile (Lima is 1 to 2 hours behind)
    'SVZ': 'America/Caracas',       # San Antonio del Tachira, Venezuela (Bogota is an hour behind)
    'LTM': 'America/Guyana',        # Lethem, Guyana
    'SFG': 'America/Marigot',       # Grand Case, Saint Martin
    'HPH': 'Asia/Ho_Chi_Minh', 'DIN': 'Asia/Ho_Chi_Minh', 'VDH': 'Asia/Ho_Chi_Minh',
    'VDO': 'Asia/Ho_Chi_Minh', 'VII': 'Asia/Ho_Chi_Minh',  # Vietnam
    'LMN': 'Asia/Kuching',          # Limbang, Malaysia
    'XSP': 'Asia/Singapore',        # Seletar, Singapore
}


def load_tz_tables():
    """Alias -> canonical zone (from tzdata.zi link lines), and canonical zone -> country codes (zone.tab)."""
    zi = Path('/usr/share/zoneinfo')
    alias = {}
    for line in (zi / 'tzdata.zi').read_text().splitlines():
        if line.startswith('L '):
            _, target, name = line.split()
            alias[name] = target
    canon = lambda tz: alias.get(tz, tz)
    countries = {}
    for line in (zi / 'zone.tab').read_text().splitlines():
        if line and not line.startswith('#'):
            cc, _, tz = line.split('\t')[:3]
            countries.setdefault(canon(tz), set()).add(cc)
    return canon, countries


def clean_city(municipality, name):
    city = re.sub(r'\s*\(.*?\)\s*', ' ', municipality or '')
    city = city.split(',')[0]  # "Luton, Luton" -> "Luton"; "Leeds, West Yorkshire" -> "Leeds"
    city = city.strip(' ,/-')
    city = re.sub(r'\s{2,}', ' ', city)
    return city or name


def clean_name(name):
    name = re.sub(r'\s+Airport$', '', name.strip())
    return re.sub(r'\s{2,}', ' ', name)


def safe(text):
    # The output is a pipe-separated template literal, so drop characters that would break it.
    return re.sub(r'[|`\\$\n\r]', ' ', text).strip()


def main(csv_path, json_path):
    curated = set(re.findall(r"\['([A-Z]{3})'", CURATED.read_text(encoding='utf-8')))
    tz_by_iata = {v['iata']: v['tz'] for v in json.load(open(json_path, encoding='utf-8')).values() if v.get('iata')}

    canon, zone_countries = load_tz_tables()
    rows, seen, skipped_no_tz, bad_tz, suspicious, wrong_country = [], set(), [], [], [], []
    jan = datetime(2026, 1, 15)
    for r in csv.DictReader(open(csv_path, encoding='utf-8')):
        code = r['iata_code'].strip().upper()
        if not re.fullmatch(r'[A-Z]{3}', code) or code in curated or code in seen:
            continue
        if r['scheduled_service'] != 'yes' or r['type'] not in ('large_airport', 'medium_airport'):
            continue
        tz = tz_by_iata.get(code)
        if not tz:
            skipped_no_tz.append(code)
            continue
        tz = TZ_COMPAT.get(TZ_FIX.get(code, tz), TZ_FIX.get(code, tz))
        try:
            offset = ZoneInfo(canon(tz)).utcoffset(jan).total_seconds() / 3600
        except (ZoneInfoNotFoundError, ValueError):
            bad_tz.append((code, tz))
            continue
        lon = float(r['longitude_deg'] or 0)
        if abs(offset - lon / 15) > 4 and abs(offset - lon / 15) < 20:
            suspicious.append((code, r['name'], tz, round(offset, 1), round(lon, 1)))
        allowed = zone_countries.get(canon(tz), set())
        if allowed and r['iso_country'] not in allowed:
            wrong_country.append((code, r['name'], r['iso_country'], tz, sorted(allowed)))
        seen.add(code)
        name = clean_name(r['name'])
        rows.append((0 if r['type'] == 'large_airport' else 1, code, safe(clean_city(r['municipality'], name)),
                     r['iso_country'], tz, safe(name)))

    rows.sort(key=lambda x: (x[0], x[2], x[1]))  # large airports first, then by city
    lines = [f"{code}|{city}|{cc}|{tz}|{name}|{'L' if size == 0 else 'M'}" for size, code, city, cc, tz, name in rows]
    OUT.write_text(
        '// Generated by tools/build-airports.py. Do not edit by hand; edit js/data/airports.js or rerun the script.\n'
        '// Airports with scheduled passenger service from OurAirports (public domain), with time zones from\n'
        '// mwgg/Airports (MIT License, Copyright (c) 2014 mwgg). One airport per line:\n'
        '//   IATA|city|ISO country|IANA time zone|airport name|size (L = large, M = medium)\n'
        f'// {len(lines)} airports.\n'
        'export const WORLD_AIRPORTS = `\n' + '\n'.join(lines) + '\n`;\n',
        encoding='utf-8')

    print(f'wrote {len(lines)} airports to {OUT.relative_to(ROOT)}')
    print(f'skipped {len(skipped_no_tz)} without a time zone, {len(bad_tz)} with an unknown zone: {bad_tz[:10]}')
    print(f'{len(suspicious)} zones far from longitude (review):')
    for s in suspicious:
        print('  ', s)
    print(f'{len(wrong_country)} zones that belong to a different country (review):')
    for s in wrong_country:
        print('  ', s)


if __name__ == '__main__':
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
