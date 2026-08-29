/** Interpreta un dictado como «dos kilos de harina 850 bolívares». */
export interface VoiceItem {
  name: string;
  quantity: number;
  amount: number | null;
  currency: 'VES' | 'USD' | null;
}

const WORD_NUMBERS: Record<string, number> = {
  un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6,
  siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, media: 0.5, medio: 0.5,
};

const CURRENCY_WORDS: { match: RegExp; currency: 'VES' | 'USD' }[] = [
  { match: /\b(bol[ií]var(es)?|bs|bolos)\b/i, currency: 'VES' },
  { match: /\b(d[oó]lar(es)?|verdes|usd)\b/i, currency: 'USD' },
];

export const parseVoiceItem = (raw: string): VoiceItem => {
  let text = raw.trim().toLowerCase();

  const currency = CURRENCY_WORDS.find((c) => c.match.test(text))?.currency ?? null;
  CURRENCY_WORDS.forEach((c) => { text = text.replace(c.match, ' '); });

  // El precio es el último número dicho; la cantidad, un número al inicio.
  const numbers = [...text.matchAll(/\d+(?:[.,]\d+)?/g)].map((m) => ({ value: Number(m[0].replace(',', '.')), index: m.index ?? 0 }));
  let amount: number | null = null;
  if (numbers.length > 0) {
    const last = numbers[numbers.length - 1];
    amount = last.value;
    text = `${text.slice(0, last.index)} ${text.slice(last.index + String(last.value).length)}`;
  }

  let quantity = 1;
  const leadingWord = text.trim().split(/\s+/)[0];
  if (leadingWord in WORD_NUMBERS) {
    quantity = WORD_NUMBERS[leadingWord];
    text = text.trim().slice(leadingWord.length);
  } else if (numbers.length > 1) {
    quantity = numbers[0].value;
    text = text.replace(String(numbers[0].value), ' ');
  }

  const name = text
    .replace(/\b(de|del|la|el|los|las|a|en|por|y|cada)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    name: name ? name.charAt(0).toUpperCase() + name.slice(1) : raw.trim(),
    quantity: quantity > 0 ? quantity : 1,
    amount,
    currency,
  };
};
