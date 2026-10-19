import { app } from '../firebase';
import { compressImage } from '../utils/image';

export type ScanCurrency = 'USD' | 'VES';

export interface ScannedLine {
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

/** Lo que se pudo leer de la foto. Los montos vienen en `currency`. */
export interface ScannedInvoice {
  merchant: string;
  date?: string;
  number?: string;
  currency: ScanCurrency;
  items: ScannedLine[];
  /** Total a pagar impreso (con IVA o descuentos), si se ve. */
  total?: number;
}

/**
 * Modelo de Gemini. Se puede cambiar sin tocar código con VITE_GEMINI_MODEL
 * (Google retira modelos con el tiempo).
 */
const MODEL = import.meta.env.VITE_GEMINI_MODEL || 'gemini-3.5-flash';

const PROMPT = `Eres un lector de facturas y tickets de compra de Venezuela.
Extrae de la imagen:
- merchant: nombre del comercio o tienda.
- date: fecha de la compra en formato YYYY-MM-DD (omítela si no se lee).
- number: número de factura o ticket (omítelo si no se lee).
- currency: "VES" si los montos están en bolívares (Bs, Bs.S, Bs.D, VES); "USD" si están en dólares ($, USD, REF). Si la factura muestra ambas monedas, usa USD.
- items: cada producto comprado con name (nombre legible; expande abreviaturas obvias), quantity, unitPrice y total de la línea, en la moneda indicada.
- total: total a pagar impreso en la factura, en la misma moneda.
Reglas: no incluyas subtotales, IVA, descuentos, vueltos ni formas de pago como productos. Convierte números del formato venezolano (1.234,56) a punto decimal (1234.56). Si una línea no trae cantidad, usa 1. Si no ves productos, devuelve items vacío.`;

/** Se carga solo al escanear: el SDK de IA no pesa en el arranque de la app. */
const loadModel = async () => {
  const { getAI, getGenerativeModel, GoogleAIBackend, Schema } = await import('firebase/ai');
  const schema = Schema.object({
    properties: {
      merchant: Schema.string(),
      date: Schema.string(),
      number: Schema.string(),
      currency: Schema.enumString({ enum: ['USD', 'VES'] }),
      total: Schema.number(),
      items: Schema.array({
        items: Schema.object({
          properties: {
            name: Schema.string(),
            quantity: Schema.number(),
            unitPrice: Schema.number(),
            total: Schema.number(),
          },
        }),
      }),
    },
    optionalProperties: ['date', 'number', 'total'],
  });
  const ai = getAI(app, { backend: new GoogleAIBackend() });
  return getGenerativeModel(ai, {
    model: MODEL,
    generationConfig: { responseMimeType: 'application/json', responseSchema: schema, temperature: 0 },
  });
};

const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/** Normaliza la respuesta: el modelo a veces deja una línea sin total o sin precio. */
const parse = (raw: unknown): ScannedInvoice => {
  const o = (raw ?? {}) as Record<string, unknown>;
  const rawItems = Array.isArray(o.items) ? (o.items as Record<string, unknown>[]) : [];
  const items: ScannedLine[] = rawItems
    .map((it) => {
      const quantity = num(it.quantity) || 1;
      let unitPrice = num(it.unitPrice);
      let total = num(it.total);
      if (!total && unitPrice) total = unitPrice * quantity;
      if (!unitPrice && total) unitPrice = total / quantity;
      return { name: str(it.name), quantity, unitPrice, total };
    })
    .filter((it) => it.name && it.total > 0);
  const date = str(o.date);
  return {
    merchant: str(o.merchant),
    date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined,
    number: str(o.number) || undefined,
    currency: o.currency === 'VES' ? 'VES' : 'USD',
    items,
    total: num(o.total) || undefined,
  };
};

/** Traduce los errores del SDK a algo accionable. */
const friendly = (e: unknown): Error => {
  const msg = e instanceof Error ? e.message : String(e);
  if (/api-not-enabled|not been used|SERVICE_DISABLED|firebasevertexai|generativelanguage/i.test(msg)) {
    return new Error('La lectura de facturas no está activada en Firebase. Activa «AI Logic» (Gemini Developer API) en la consola del proyecto.');
  }
  if (/not found|404|is not supported/i.test(msg)) {
    return new Error(`El modelo ${MODEL} no está disponible. Cambia VITE_GEMINI_MODEL por uno vigente.`);
  }
  if (/quota|429|RESOURCE_EXHAUSTED/i.test(msg)) {
    return new Error('Se alcanzó el límite gratuito de lecturas por ahora. Prueba en unos minutos.');
  }
  if (/fetch|network|Failed to fetch/i.test(msg)) {
    return new Error('Sin conexión: la lectura de facturas necesita internet.');
  }
  return new Error(`No se pudo leer la factura: ${msg}`);
};

/** Lee una foto de factura y devuelve comercio, productos y precios. */
export const scanInvoice = async (file: File): Promise<ScannedInvoice> => {
  if (!navigator.onLine) throw new Error('Sin conexión: la lectura de facturas necesita internet.');
  try {
    const [model, image] = await Promise.all([loadModel(), compressImage(file)]);
    const result = await model.generateContent([PROMPT, { inlineData: { data: image.base64, mimeType: image.mimeType } }]);
    return parse(JSON.parse(result.response.text()));
  } catch (e) {
    throw friendly(e);
  }
};
