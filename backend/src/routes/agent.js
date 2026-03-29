const express = require('express');
const router  = express.Router();

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';

const SYSTEM_PROMPT = `You are a government contracting intelligence assistant built into Sales Patriot — a platform that helps BD and sales teams identify, analyze, and pursue federal contracting opportunities.

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
- Use dollar amounts and percentages when relevant

Keep answers concise. Lead with the insight, not the explanation.`;

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
        model: 'anthropic/claude-3.5-sonnet',
        stream: true,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
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

module.exports = router;
