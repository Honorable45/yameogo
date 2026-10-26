/**
 * Détection du téléphone sur lequel le site est ouvert.
 *
 * - Android + Chrome / Edge / Samsung Internet récents : le navigateur fournit la référence du modèle
 *   (ex. « SM-A546B », « TECNO KJ5 », « Infinix X6831 ») via les User-Agent Client Hints.
 * - Anciens navigateurs Android : la référence figure parfois encore dans le User-Agent.
 * - iPhone : Safari ne donne jamais le modèle exact, seulement « iPhone ».
 * La référence n'est pas toujours le nom commercial : elle est transmise telle quelle à la boutique.
 */
export interface DetectedDevice {
  brand: string | null;
  model: string | null;
  /** iPhone : la marque est connue mais le modèle exact doit être lu dans les Réglages. */
  iphone: boolean;
}

// Préfixes de référence → marque (les marques les plus vendues à Lomé).
const PREFIXES: [RegExp, string][] = [
  [/^SM-/i, 'Samsung'],
  [/^TECNO\b/i, 'Tecno'],
  [/^Infinix\b/i, 'Infinix'],
  [/^itel\b/i, 'Itel'],
  [/^Redmi\b/i, 'Redmi'],
  [/^(Xiaomi|Mi |POCO)\b/i, 'Xiaomi'],
  [/^(Pixel)\b/i, 'Google'],
  [/^(CPH|OPPO)/i, 'Oppo'],
  [/^(RMX|realme)/i, 'Realme'],
  [/^(vivo|V2\d{3})/i, 'Vivo'],
  [/^(Nokia|TA-)/i, 'Nokia'],
  [/^(moto|motorola|XT\d)/i, 'Motorola'],
  [/^(HUAWEI|[A-Z]{3}-L\d)/i, 'Huawei'],
];

function brandOf(model: string): string | null {
  return PREFIXES.find(([re]) => re.test(model))?.[1] ?? null;
}

/** Retire le nom de marque répété en tête de la référence (« TECNO KJ5 » → « KJ5 »). */
function cleanModel(model: string, brand: string | null) {
  if (!brand) return model;
  return model.replace(new RegExp(`^${brand}\\s+`, 'i'), '').trim() || model;
}

type UAData = { platform?: string; mobile?: boolean; getHighEntropyValues?: (hints: string[]) => Promise<{ model?: string }> };

export async function detectDevice(): Promise<DetectedDevice | null> {
  if (typeof navigator === 'undefined') return null;
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return { brand: 'Apple', model: null, iphone: true };

  let model = '';
  const data = (navigator as Navigator & { userAgentData?: UAData }).userAgentData;
  if (data?.getHighEntropyValues) {
    try {
      model = (await data.getHighEntropyValues(['model'])).model?.trim() ?? '';
    } catch {
      model = '';
    }
  }
  // Repli : « (Linux; Android 13; SM-A546B) » dans le User-Agent (le « K » des navigateurs récents est ignoré).
  if (!model) {
    const m = ua.match(/Android [\d.]+; ([^;)]+?)(?: Build\/[^;)]*)?\)/);
    if (m && m[1].trim() !== 'K') model = m[1].trim();
  }
  if (!model) return null;
  const brand = brandOf(model);
  return { brand, model: cleanModel(model, brand), iphone: false };
}
