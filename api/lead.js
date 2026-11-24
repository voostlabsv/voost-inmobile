// Recibe los leads del formulario y los envía por correo con Resend.
// Envío por FormSubmit (activo). Si se configura RESEND_API_KEY en Vercel, se usa Resend en su lugar.
// LEAD_EMAIL en Vercel reemplaza el destino por defecto (también acepta el alias de FormSubmit).
const DEFAULT_TO = 'voost.lab@gmail.com';
const SITE = 'https://voost-inmobile.vercel.app/';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clip = (s, n = 300) => String(s ?? '').trim().slice(0, n);

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ ok: false, error: 'method' }); }
  const key = process.env.RESEND_API_KEY, to = process.env.LEAD_EMAIL || DEFAULT_TO;

  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch { b = {}; } }
  b = b || {};
  if (b._honey) return res.status(200).json({ ok: true });            // bot

  const lead = {
    'Nombre': clip(b.name, 120), 'Empresa o proyecto': clip(b.company, 160), 'Industria / negocio': clip(b.industry, 160),
    'Necesita': clip(b.need, 120), 'WhatsApp / teléfono': clip(b.phone, 40), 'Correo': clip(b.email, 160),
    'Presupuesto Meta Ads': clip(b.budget, 60), 'Página': clip(b.page, 300), 'Fecha': clip(b.date, 60)
  };
  if (!lead['Nombre'] || (!lead['WhatsApp / teléfono'] && !lead['Correo'])) return res.status(400).json({ ok: false, error: 'missing' });
  const replyTo = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead['Correo']) ? lead['Correo'] : undefined;

  const rows = Object.entries(lead).map(([k, v]) => `<tr><td style="padding:8px 12px;color:#666;border-bottom:1px solid #eee;white-space:nowrap">${esc(k)}</td><td style="padding:8px 12px;border-bottom:1px solid #eee;font-weight:600">${esc(v || '—')}</td></tr>`).join('');
  const html = `<div style="font-family:Arial,sans-serif;max-width:560px"><h2 style="margin:0 0 4px">Nuevo lead interesado</h2><p style="margin:0 0 16px;color:#666">VOOST Inmobile · formulario de la landing</p><table style="border-collapse:collapse;width:100%">${rows}</table></div>`;
  const text = Object.entries(lead).map(([k, v]) => `${k}: ${v || '—'}`).join('\n');

  const subject = `Nuevo lead interesado · ${lead['Nombre']}${lead['Empresa o proyecto'] ? ' · ' + lead['Empresa o proyecto'] : ''}`;
  if (!key) {
    try {
      const body = { _subject: subject, _template: 'table', _captcha: 'false', ...Object.fromEntries(Object.entries(lead).map(([k, v]) => [k, v || '—'])) };
      if (replyTo) body._replyto = replyTo;
      const r = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(to)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json', Origin: SITE.slice(0, -1), Referer: SITE },
        body: JSON.stringify(body)
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || String(j.success) !== 'true') { console.error('formsubmit', r.status, j); return res.status(502).json({ ok: false, error: 'send_failed' }); }
      return res.status(200).json({ ok: true });
    } catch (e) { console.error('formsubmit', e); return res.status(502).json({ ok: false, error: 'send_failed' }); }
  }
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.LEAD_FROM || 'VOOST Inmobile <onboarding@resend.dev>',
        to: [to], subject,
        html, text, ...(replyTo ? { reply_to: replyTo } : {})
      })
    });
    if (!r.ok) { console.error('resend', r.status, await r.text()); return res.status(502).json({ ok: false, error: 'send_failed' }); }
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('resend', e); return res.status(502).json({ ok: false, error: 'send_failed' });
  }
};
