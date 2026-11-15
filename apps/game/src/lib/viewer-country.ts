/** ISO country of the preferred browser language. A tag without a region uses its likely country. */
export function viewerCountry(language: string | readonly string[]): string | null {
  const preferred = typeof language === "string" ? language : language[0];
  if (!preferred) {
    return null;
  }
  return countryOf(preferred, false) ?? countryOf(preferred, true);
}

function countryOf(language: string, likely: boolean): string | null {
  try {
    const locale = new Intl.Locale(language);
    const region = likely ? (locale.region ?? locale.maximize().region) : locale.region;
    if (region && /^[A-Z]{2}$/.test(region)) {
      return region;
    }
  } catch {
    return null;
  }
  return null;
}
