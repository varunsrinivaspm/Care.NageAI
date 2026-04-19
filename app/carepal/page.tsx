'use client'

import { useState, useRef, useEffect } from 'react'
import { MessageCircle, Send, Bot, User, Loader2, Trash2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const suggestions = [
  'My HRV is below average today — should I skip my workout?',
  'What can I do to improve my deep sleep percentage?',
  'How does my recovery score affect what exercise I should do?',
  'Give me a 3-step morning routine based on my current scores',
]

const MORNING_PROMPT = 'Generate my morning health summary with my top 3 action items based on today\'s scores and recent trends. Keep it warm, motivating, and concise.'

export default function CarePalPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [morningLoading, setMorningLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const hasSentMorning = useRef(false)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Morning check-in: auto-generate health summary on first load
  useEffect(() => {
    if (hasSentMorning.current) return
    hasSentMorning.current = true
    setMorningLoading(true)

    const runMorning = async () => {
      const userMsg: Message = { role: 'user', content: MORNING_PROMPT }
      const assistantMsg: Message = { role: 'assistant', content: '' }
      setMessages([userMsg, assistantMsg])

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: [userMsg] }),
        })
        if (!res.body) throw new Error('No body')
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const chunk = decoder.decode(value)
          setMessages(prev => {
            const updated = [...prev]
            updated[updated.length - 1] = {
              ...updated[updated.length - 1],
              content: updated[updated.length - 1].content + chunk,
            }
            return updated
          })
        }
      } catch {
        setMessages(prev => {
          const updated = [...prev]
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            content: 'Good morning! I had trouble loading your health summary. Try asking me anything.',
          }
          return updated
        })
      } finally {
        setMorningLoading(false)
      }
    }

    runMorning()
  }, [])

  const sendMessage = async (text?: string) => {
    const content = text ?? input.trim()
    if (!content || loading) return

    const userMsg: Message = { role: 'user', content }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    const assistantMsg: Message = { role: 'assistant', content: '' }
    setMessages(prev => [...prev, assistantMsg])

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      })

      if (!res.body) throw new Error('No response body')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        setMessages(prev => {
          const updated = [...prev]
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            content: updated[updated.length - 1].content + chunk,
          }
          return updated
        })
      }
    } catch {
      setMessages(prev => {
        const updated = [...prev]
        updated[updated.length - 1] = {
          ...updated[updated.length - 1],
          content: 'Sorry, I encountered an error. Please try again.',
        }
        return updated
      })
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <MessageCircle className="w-6 h-6 text-indigo-500" />
            CarePal
          </h1>
          <p className="text-slate-500 mt-1 text-sm">Your personal AI health advisor</p>
        </div>
        {messages.length > 0 && (
          <button
            onClick={() => setMessages([])}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors px-3 py-1.5 rounded-lg hover:bg-slate-100"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear chat
          </button>
        )}
      </div>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto scrollbar-hide space-y-4 pb-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-6">
            <div className="bg-indigo-50 rounded-3xl p-6">
              <Bot className="w-12 h-12 text-indigo-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-800">How can I help you today?</h2>
              <p className="text-slate-500 text-sm mt-1 max-w-sm">
                Ask about your scores, workouts, sleep, nutrition, or anything health-related. I have your full biometric context.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 gap-2 w-full max-w-lg">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  className="text-left text-sm text-slate-600 bg-white border border-slate-200 rounded-xl px-4 py-3 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 transition-all"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 mt-1">
                  <Bot className="w-4 h-4 text-indigo-600" />
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-indigo-600 text-white rounded-tr-sm'
                    : 'bg-white border border-slate-200 text-slate-800 rounded-tl-sm shadow-sm'
                }`}
              >
                {msg.role === 'user' ? (
                  msg.content || (
                    <span className="flex items-center gap-1.5 text-white/70">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Thinking...
                    </span>
                  )
                ) : msg.content ? (
                  <ReactMarkdown
                    components={{
                      p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
                      strong: ({ children }) => <strong className="font-semibold text-slate-900">{children}</strong>,
                      em: ({ children }) => <em className="italic text-slate-600">{children}</em>,
                      h1: ({ children }) => <h1 className="text-base font-bold text-slate-900 mt-3 mb-1 first:mt-0">{children}</h1>,
                      h2: ({ children }) => <h2 className="text-sm font-bold text-slate-900 mt-3 mb-1 first:mt-0">{children}</h2>,
                      h3: ({ children }) => <h3 className="text-sm font-semibold text-indigo-700 mt-3 mb-1 first:mt-0">{children}</h3>,
                      ul: ({ children }) => <ul className="space-y-1 my-2 ml-1">{children}</ul>,
                      ol: ({ children }) => <ol className="space-y-1 my-2 ml-1 list-decimal list-inside">{children}</ol>,
                      li: ({ children }) => (
                        <li className="flex items-start gap-2 text-slate-700">
                          <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0" />
                          <span>{children}</span>
                        </li>
                      ),
                      hr: () => <hr className="my-3 border-slate-200" />,
                      blockquote: ({ children }) => (
                        <blockquote className="border-l-2 border-indigo-300 pl-3 my-2 text-slate-600 italic">{children}</blockquote>
                      ),
                      table: ({ children }) => (
                        <div className="overflow-x-auto my-3 rounded-lg border border-slate-200">
                          <table className="w-full text-xs">{children}</table>
                        </div>
                      ),
                      thead: ({ children }) => <thead className="bg-indigo-50">{children}</thead>,
                      th: ({ children }) => <th className="px-3 py-2 text-left font-semibold text-indigo-700 border-b border-slate-200">{children}</th>,
                      td: ({ children }) => <td className="px-3 py-2 border-b border-slate-100 text-slate-700">{children}</td>,
                      code: ({ children }) => <code className="bg-slate-100 text-indigo-600 px-1 py-0.5 rounded text-xs font-mono">{children}</code>,
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                ) : (
                  <span className="flex items-center gap-1.5 text-slate-400">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Thinking...
                  </span>
                )}
              </div>
              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0 mt-1">
                  <User className="w-4 h-4 text-slate-600" />
                </div>
              )}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="mt-4 bg-white border border-slate-200 rounded-2xl shadow-sm flex items-end gap-3 px-4 py-3">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about your scores, sleep, workouts, or symptoms..."
          rows={1}
          className="flex-1 resize-none outline-none text-sm text-slate-800 placeholder-slate-400 max-h-32 bg-transparent"
          style={{ height: 'auto' }}
          onInput={e => {
            const t = e.target as HTMLTextAreaElement
            t.style.height = 'auto'
            t.style.height = t.scrollHeight + 'px'
          }}
        />
        <button
          onClick={() => sendMessage()}
          disabled={!input.trim() || loading}
          className="bg-indigo-600 text-white rounded-xl p-2.5 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex-shrink-0"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
      <p className="text-xs text-slate-400 text-center mt-2">
        CarePal is an AI assistant. Always consult a qualified healthcare professional for medical decisions.
      </p>
    </div>
  )
}
