import { useState, useEffect } from 'react'
import axios from 'axios'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Loader2, CheckCircle, AlertCircle, MessageSquare, Clock } from 'lucide-react'
import { cn } from './lib/utils'

const API_URL = 'http://localhost:8000'

// World Clock Configuration
const WORLD_CLOCKS = [
  { city: 'San Jose', timezone: 'America/Los_Angeles', flag: '🌉' },
  { city: 'Dallas', timezone: 'America/Chicago', flag: '🤠' },
  { city: 'New York', timezone: 'America/New_York', flag: '🗽' },
  { city: 'Hyderabad', timezone: 'Asia/Kolkata', flag: '🇮🇳' },
]

function WorldClock() {
  const [times, setTimes] = useState({})

  useEffect(() => {
    const updateTimes = () => {
      const newTimes = {}
      WORLD_CLOCKS.forEach(({ city, timezone }) => {
        newTimes[city] = new Date().toLocaleTimeString('en-US', {
          timeZone: timezone,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        })
      })
      setTimes(newTimes)
    }

    updateTimes()
    const interval = setInterval(updateTimes, 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="flex items-center gap-4 text-xs">
      <Clock className="w-4 h-4 text-violet-500" />
      {WORLD_CLOCKS.map(({ city, flag }) => (
        <div key={city} className="flex items-center gap-1">
          <span>{flag}</span>
          <span className="font-medium text-gray-600">{city}:</span>
          <span className="font-mono text-gray-800">{times[city] || '--:--:--'}</span>
        </div>
      ))}
    </div>
  )
}

function App() {
  const [message, setMessage] = useState('')
  const [chatHistory, setChatHistory] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [testStatus, setTestStatus] = useState(null)

  const testBackend = async () => {
    try {
      setTestStatus('loading')
      const response = await axios.get(`${API_URL}/test`)
      setTestStatus('success')
      setTimeout(() => setTestStatus(null), 3000)
    } catch (err) {
      setTestStatus('error')
      setError('Failed to connect to backend')
      setTimeout(() => setTestStatus(null), 3000)
    }
  }

  const sendMessage = async (e) => {
    e.preventDefault()
    if (!message.trim() || loading) return

    const userMessage = message.trim()
    setMessage('')
    setError('')
    setLoading(true)

    // Add user message to history
    setChatHistory(prev => [...prev, { role: 'user', content: userMessage }])

    try {
      const response = await axios.post(`${API_URL}/chat`, {
        message: userMessage,
        model: 'gpt-4-turbo-preview'
      })

      // Add AI response to history
      setChatHistory(prev => [...prev, {
        role: 'assistant',
        content: response.data.response,
        usage: response.data.usage
      }])
    } catch (err) {
      const errorMessage = err.response?.data?.detail || 'Failed to get response'
      setError(errorMessage)
      // Remove the user message if there was an error
      setChatHistory(prev => prev.slice(0, -1))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MessageSquare className="w-6 h-6 text-violet-600" />
            <h1 className="text-xl font-semibold text-gray-900">Chat App</h1>
            <span className="px-2 py-0.5 text-xs font-medium bg-violet-100 text-violet-700 rounded-full">v1.3</span>
            <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded-full">Enterprise</span>
          </div>
          <button
            onClick={testBackend}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-all",
              testStatus === 'success' && "bg-green-100 text-green-700",
              testStatus === 'error' && "bg-red-100 text-red-700",
              testStatus === 'loading' && "bg-gray-100 text-gray-500",
              !testStatus && "bg-gray-100 hover:bg-gray-200 text-gray-700"
            )}
            disabled={testStatus === 'loading'}
          >
            {testStatus === 'loading' && <Loader2 className="w-4 h-4 animate-spin inline mr-2" />}
            {testStatus === 'success' && <CheckCircle className="w-4 h-4 inline mr-2" />}
            {testStatus === 'error' && <AlertCircle className="w-4 h-4 inline mr-2" />}
            {testStatus === 'success' ? 'Connected!' : testStatus === 'error' ? 'Failed' : 'Test Backend'}
          </button>
        </div>
        {/* World Clock Bar */}
        <div className="bg-gradient-to-r from-violet-50 to-indigo-50 border-t border-violet-100">
          <div className="max-w-4xl mx-auto px-4 py-2 flex justify-center">
            <WorldClock />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Chat Messages */}
        <div className="bg-white rounded-xl shadow-sm border min-h-[500px] max-h-[600px] overflow-y-auto p-4 mb-4">
          {chatHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[400px] text-gray-400">
              <MessageSquare className="w-12 h-12 mb-4" />
              <p className="text-lg">Start a conversation</p>
              <p className="text-sm">Send a message to begin chatting with AI</p>
            </div>
          ) : (
            <AnimatePresence>
              {chatHistory.map((msg, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className={cn(
                    "mb-4 p-4 rounded-xl max-w-[80%]",
                    msg.role === 'user'
                      ? "bg-blue-600 text-white ml-auto"
                      : "bg-gray-100 text-gray-900"
                  )}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  {msg.usage && (
                    <p className="text-xs mt-2 opacity-60">
                      Tokens: {msg.usage.total_tokens}
                    </p>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          )}

          {loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-2 text-gray-500 p-4"
            >
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>AI is thinking...</span>
            </motion.div>
          )}
        </div>

        {/* Error Message */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 flex items-center gap-2"
            >
              <AlertCircle className="w-5 h-5" />
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input Form */}
        <form onSubmit={sendMessage} className="flex gap-3">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !message.trim()}
            className={cn(
              "px-6 py-3 rounded-xl font-medium transition-all flex items-center gap-2",
              loading || !message.trim()
                ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm hover:shadow"
            )}
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
            Send
          </button>
        </form>
      </main>
    </div>
  )
}

export default App
