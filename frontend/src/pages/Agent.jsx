import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2 } from 'lucide-react';

const BASE_URL = import.meta.env.VITE_API_URL || '/api';

function Message({ role, content, streaming }) {
  const isUser = role === 'user';
  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
        isUser ? 'bg-blue-600' : 'bg-gray-800'
      }`}>
        {isUser
          ? <User className="h-4 w-4 text-white" />
          : <Bot  className="h-4 w-4 text-white" />
        }
      </div>

      {/* Bubble */}
      <div className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
        isUser
          ? 'bg-blue-600 text-white rounded-tr-sm'
          : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm'
      }`}>
        {content}
        {streaming && (
          <span className="inline-block w-1.5 h-4 ml-0.5 bg-gray-400 animate-pulse rounded-sm align-middle" />
        )}
      </div>
    </div>
  );
}

export default function Agent() {
  const [messages,   setMessages]   = useState([]);
  const [input,      setInput]      = useState('');
  const [streaming,  setStreaming]  = useState(false);
  const bottomRef  = useRef(null);
  const inputRef   = useRef(null);
  const abortRef   = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || streaming) return;

    const userMsg   = { role: 'user', content: text };
    const history   = [...messages, userMsg];
    setMessages(history);
    setInput('');
    setStreaming(true);

    // Add empty assistant message to stream into
    setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

    try {
      const controller = new AbortController();
      abortRef.current = controller;

      const res = await fetch(`${BASE_URL}/agent/chat`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        signal:  controller.signal,
        body:    JSON.stringify({ messages: history }),
      });

      if (!res.ok) throw new Error(`Agent error: ${res.status}`);

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let   buffer  = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep incomplete line

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (raw === '[DONE]') break;
          try {
            const chunk = JSON.parse(raw);
            const delta = chunk.choices?.[0]?.delta?.content;
            if (delta) {
              setMessages((prev) => {
                const next = [...prev];
                next[next.length - 1] = {
                  ...next[next.length - 1],
                  content: next[next.length - 1].content + delta,
                };
                return next;
              });
            }
          } catch {
            // ignore parse errors on partial chunks
          }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = {
            role:    'assistant',
            content: 'Sorry, something went wrong. Please try again.',
          };
          return next;
        });
      }
    } finally {
      setStreaming(false);
      inputRef.current?.focus();
    }
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">

      {/* Header */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Agent</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Government contracting intelligence — ask about vendors, agencies, or BD strategy.
        </p>
      </div>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto rounded-xl bg-gray-50 border border-gray-200 p-6 flex flex-col gap-4">
        {isEmpty && (
          <div className="flex-1 flex flex-col items-center justify-center gap-6 text-center">
            <div className="w-14 h-14 rounded-2xl bg-gray-800 flex items-center justify-center">
              <Bot className="h-7 w-7 text-white" />
            </div>
            <div>
              <p className="text-lg font-semibold text-gray-800">Sales Patriot Agent</p>
              <p className="text-sm text-gray-400 mt-1 max-w-sm">
                Ask about vendor trends, agency spend, NAICS sectors, or how to position for an opportunity.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
              {[
                'What makes a vendor a good BD target?',
                'How do I read a vendor\'s contract history?',
                'Explain sole source vs full and open competition',
                'What is a CAGE code and why does it matter?',
              ].map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => { setInput(prompt); inputRef.current?.focus(); }}
                  className="text-left text-xs text-gray-600 bg-white border border-gray-200 rounded-lg px-3 py-2.5 hover:border-blue-300 hover:text-blue-700 transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <Message
            key={i}
            role={msg.role}
            content={msg.content}
            streaming={streaming && i === messages.length - 1 && msg.role === 'assistant'}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="mt-3 flex gap-2 items-end">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Ask anything about government contracting…"
          rows={1}
          className="flex-1 resize-none rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-blue-400 shadow-sm max-h-36 overflow-y-auto"
          style={{ height: 'auto' }}
          onInput={(e) => {
            e.target.style.height = 'auto';
            e.target.style.height = `${e.target.scrollHeight}px`;
          }}
          disabled={streaming}
        />
        <button
          onClick={send}
          disabled={!input.trim() || streaming}
          className="shrink-0 w-11 h-11 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 flex items-center justify-center transition-colors"
        >
          {streaming
            ? <Loader2 className="h-4 w-4 text-white animate-spin" />
            : <Send className="h-4 w-4 text-white" />
          }
        </button>
      </div>
      <p className="text-[10px] text-gray-300 text-center mt-1.5">
        Press Enter to send · Shift+Enter for new line
      </p>
    </div>
  );
}
