/**
 * Reduce una foto del teléfono (4000px, varios MB) a un JPEG liviano antes de
 * subirla: con datos móviles en Venezuela, 300 KB suben donde 5 MB se cuelgan.
 * Devuelve el contenido en base64, sin el prefijo `data:`.
 */
export const compressImage = async (file: File, maxSide = 1600, quality = 0.82): Promise<{ base64: string; mimeType: string }> => {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('El navegador no pudo procesar la imagen.');
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const dataUrl = canvas.toDataURL('image/jpeg', quality);
  return { base64: dataUrl.slice(dataUrl.indexOf(',') + 1), mimeType: 'image/jpeg' };
};
