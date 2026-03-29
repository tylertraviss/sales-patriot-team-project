const express = require('express');
const router  = express.Router();
const db      = require('../db/connection');

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'anthropic/claude-opus-4.6';

const BASE_SYSTEM_PROMPT = `You are a government contracting intelligence assistant built into Sales Patriot — a platform that helps BD and sales teams identify, analyze, and pursue federal contracting opportunities.

You have deep expertise in:
- Federal procurement: contract types (Definitive Contracts, Delivery Orders, IDIQs, BPA Calls, Purchase Orders), competition types (Full & Open, Sole Source, Set-Asides), and the acquisition lifecycle
- Agency structures: DoD, DLA, GSA, Army, Navy, Air Force, DHS, VA, and their sub-commands
- NAICS codes and how agencies map to industry sectors
- Vendor intelligence: reading contract history to identify growth trends, agency relationships, incumbency, and competitive positioning
- BD strategy: how to use USASpending data to find opportunities, target accounts, and time outreach

When analyzing vendors or opportunities:
- Be specific and actionable — give concrete takeaways a BD rep can use on a call
- Highlight signals: growing YoY spend, new agency relationships, sole-source awards, graduating set-asides
- Flag risks: high agency concentration, declining spend, heavy modification counts
- Reference actual vendors, agencies, and dollar amounts from the dataset below when relevant

Keep answers concise. Lead with the insight, not the explanation.`;

const fmt = (n) => {
  const num = parseFloat(n) || 0;
  if (num >= 1e9) return `$${(num / 1e9).toFixed(1)}B`;
  if (num >= 1e6) return `$${(num / 1e6).toFixed(1)}M`;
  if (num >= 1e3) return `$${(num / 1e3).toFixed(0)}K`;
  return `$${num.toFixed(0)}`;
};

async function buildContextBlock() {
  try {
    const [kpis, topVendors, topAgencies, topNaics, byType, yearRange] = await Promise.all([
      db.query(`
        SELECT
          COALESCE(SUM(award_amount), 0) AS total_obligated,
          COUNT(*)                        AS total_awards,
          COUNT(DISTINCT vendor_id)       AS total_vendors,
          ROUND(COUNT(*) FILTER (WHERE extent_competed_code = 'D') * 100.0 / NULLIF(COUNT(*), 0), 1) AS sole_source_rate
        FROM award_transactions
      `),
      db.query(`
        SELECT ve.vendor_name, ve.cage_code, ve.uei,
               COALESCE(SUM(at.award_amount), 0) AS total,
               COUNT(*) AS awards
        FROM award_transactions at
        JOIN vendor_entities ve ON ve.vendor_id = at.vendor_id
        GROUP BY ve.vendor_id, ve.vendor_name, ve.cage_code, ve.uei
        ORDER BY total DESC LIMIT 15
      `),
      db.query(`
        SELECT contracting_agency_name AS agency,
               COALESCE(SUM(award_amount), 0) AS total,
               COUNT(*) AS awards
        FROM award_transactions
        WHERE contracting_agency_name IS NOT NULL
        GROUP BY contracting_agency_name
        ORDER BY total DESC LIMIT 10
      `),
      db.query(`
        SELECT naics_code AS code, naics_description AS name,
               COALESCE(SUM(award_amount), 0) AS total,
               COUNT(*) AS awards
        FROM award_transactions
        WHERE naics_code IS NOT NULL
        GROUP BY naics_code, naics_description
        ORDER BY total DESC LIMIT 10
      `),
      db.query(`
        SELECT award_type_description AS type,
               COALESCE(SUM(award_amount), 0) AS total,
               COUNT(*) AS awards
        FROM award_transactions
        WHERE award_type_description IS NOT NULL
        GROUP BY award_type_description
        ORDER BY total DESC
      `),
      db.query(`
        SELECT
          MIN(COALESCE(award_fiscal_year, contract_fiscal_year)) AS first_year,
          MAX(COALESCE(award_fiscal_year, contract_fiscal_year)) AS last_year
        FROM award_transactions
      `),
    ]);

    const k      = kpis.rows[0];
    const yr     = yearRange.rows[0];
    const years  = yr.first_year && yr.last_year ? `FY${yr.first_year}–FY${yr.last_year}` : 'multiple fiscal years';

    const vendorLines = topVendors.rows
      .map((v, i) => `  ${i + 1}. ${v.vendor_name} (CAGE: ${v.cage_code || v.uei || 'N/A'}) — ${fmt(v.total)} across ${v.awards} awards`)
      .join('\n');

    const agencyLines = topAgencies.rows
      .map((a, i) => `  ${i + 1}. ${a.agency} — ${fmt(a.total)} (${a.awards} awards)`)
      .join('\n');

    const naicsLines = topNaics.rows
      .map((n, i) => `  ${i + 1}. ${n.code} — ${n.name} — ${fmt(n.total)} (${n.awards} awards)`)
      .join('\n');

    const typeLines = byType.rows
      .map((t) => `  - ${t.type}: ${fmt(t.total)} (${t.awards} awards)`)
      .join('\n');

    return `
---
## Live Sales Patriot Dataset Context (${years})

**Summary**
- Total obligated: ${fmt(k.total_obligated)}
- Total awards: ${parseInt(k.total_awards).toLocaleString()}
- Active vendors: ${parseInt(k.total_vendors).toLocaleString()}
- Sole-source rate: ${k.sole_source_rate}%

**Top 15 Vendors by Spend**
${vendorLines}

**Top 10 Contracting Agencies**
${agencyLines}

**Top 10 NAICS Sectors**
${naicsLines}

**Award Type Breakdown**
${typeLines}
---`;
  } catch (err) {
    // If DB context fails, proceed without it
    return '';
  }
}

// POST /api/agent/chat  — streaming SSE
router.post('/chat', async (req, res, next) => {
  try {
    const { messages } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages array required' });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'OPENROUTER_API_KEY not configured' });
    }

    // Build enriched system prompt with live DB context
    const contextBlock  = await buildContextBlock();
    const systemContent = BASE_SYSTEM_PROMPT + contextBlock;

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const upstream = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization':  `Bearer ${apiKey}`,
        'Content-Type':   'application/json',
        'HTTP-Referer':   'https://salespatriot.com',
        'X-Title':        'Sales Patriot',
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        reasoning: { enabled: true },
        stream: true,
        messages: [
          { role: 'system', content: systemContent },
          ...messages,
        ],
      }),
    });

    if (!upstream.ok) {
      const err = await upstream.json().catch(() => ({}));
      res.write(`data: ${JSON.stringify({ error: err })}\n\n`);
      res.end();
      return;
    }

    // Pipe the OpenRouter SSE stream straight to the client
    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();

    const pump = async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(decoder.decode(value, { stream: true }));
      }
      res.end();
    };

    pump().catch((err) => {
      res.end();
      next(err);
    });

    req.on('close', () => reader.cancel());
  } catch (err) {
    next(err);
  }
});

// POST /api/agent/suggestions  — returns 3 follow-up question suggestions
router.post('/suggestions', async (req, res, next) => {
  try {
    const { messages } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages array required' });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'OPENROUTER_API_KEY not configured' });
    }

    const contextBlock  = await buildContextBlock();
    const systemContent = BASE_SYSTEM_PROMPT + contextBlock;

    const upstream = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type':  'application/json',
        'HTTP-Referer':  'https://salespatriot.com',
        'X-Title':       'Sales Patriot',
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        reasoning: { enabled: true },
        stream: false,
        messages: [
          { role: 'system', content: systemContent },
          ...messages,
          {
            role: 'user',
            content: 'Based on this conversation and the dataset above, suggest exactly 3 follow-up questions a BD rep would find valuable. Each must be 4–6 words max, specific to vendors or agencies in the data. Return ONLY a JSON array of 3 strings, no other text.',
          },
        ],
      }),
    });

    if (!upstream.ok) {
      const err = await upstream.json().catch(() => ({}));
      return res.status(502).json({ error: err });
    }

    const data = await upstream.json();
    const raw  = data.choices?.[0]?.message?.content?.trim() ?? '[]';

    let suggestions;
    try {
      suggestions = JSON.parse(raw);
    } catch {
      const match = raw.match(/\[[\s\S]*\]/);
      suggestions = match ? JSON.parse(match[0]) : [];
    }

    res.json({ suggestions: suggestions.slice(0, 3) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
