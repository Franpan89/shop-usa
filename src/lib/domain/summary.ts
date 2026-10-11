/** Texto del "Resumen para el cliente" (2.6), listo para pegar en WhatsApp. */
export function orderSummaryText(input: {
  code: string;
  clientName: string;
  typeLabel: string;
  items: { name: string; quantity: number; unitPrice: number }[];
  subtotal: number;
  taxRatePercent: number;
  tax: number;
  serviceLabel: string;
  serviceRatePercent: number;
  serviceFee: number;
  extraCharges: number;
  extraChargesNote?: string | null;
  discountAmount: number;
  total: number;
}): string {
  const m = (n: number) => `$${n.toFixed(2)}`;
  const lines = [
    `*${input.typeLabel} — Pedido ${input.code}*`,
    `Cliente: ${input.clientName}`,
    '',
    'PRODUCTOS',
    ...input.items.map((i) => `${i.name}${i.quantity > 1 ? ` (x${i.quantity})` : ''} — ${m(i.unitPrice * i.quantity)}`),
    '',
    `Subtotal: ${m(input.subtotal)}`,
    `Tax ${input.taxRatePercent}%: ${m(input.tax)}`,
    `Total factura: ${m(input.subtotal + input.tax)}`,
    `${input.serviceLabel} ${input.serviceRatePercent}%: ${m(input.serviceFee)}`,
  ];
  if (input.extraCharges > 0) lines.push(`${input.extraChargesNote || 'Otros costos'}: ${m(input.extraCharges)}`);
  lines.push(`Descuento: ${input.discountAmount > 0 ? `-${m(input.discountAmount)}` : m(0)}`);
  lines.push(`*TOTAL A PAGAR: ${m(input.total)}*`);
  return lines.join('\n');
}
