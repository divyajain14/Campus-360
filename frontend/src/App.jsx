import { useEffect, useMemo, useRef, useState } from 'react'
import { apiRequest } from './api'
import './App.css'

const TOKEN_KEY = 'campus360_token'
const CURRENT_YEAR = new Date().getFullYear()

function readTokenPayload(token) {
  try {
    const encodedPayload = token.split('.')[1]
    const base64 = encodedPayload.replace(/-/g, '+').replace(/_/g, '/')
    const payload = JSON.parse(window.atob(base64))

    if (payload.exp && payload.exp * 1000 <= Date.now()) {
      return null
    }

    return payload
  } catch {
    return null
  }
}

function getStoredSession() {
  const token = window.localStorage.getItem(TOKEN_KEY)
  if (!token) return null

  const user = readTokenPayload(token)
  if (!user) {
    window.localStorage.removeItem(TOKEN_KEY)
    return null
  }

  return { token, user }
}

function formatEventDate(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return { day: '--', month: 'TBA', full: 'Date to be announced' }
  }

  return {
    day: new Intl.DateTimeFormat('en', { day: '2-digit' }).format(date),
    month: new Intl.DateTimeFormat('en', { month: 'short' }).format(date),
    full: new Intl.DateTimeFormat('en', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(date),
  }
}

function formatDateTimeInput(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return localDate.toISOString().slice(0, 16)
}

function App() {
  const [session, setSession] = useState(getStoredSession)
  const [events, setEvents] = useState([])
  const [registrations, setRegistrations] = useState([])
  const [loadingEvents, setLoadingEvents] = useState(true)
  const [view, setView] = useState('all')
  const [search, setSearch] = useState('')
  const [authMode, setAuthMode] = useState(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingEvent, setEditingEvent] = useState(null)
  const [busyEventId, setBusyEventId] = useState(null)
  const [authError, setAuthError] = useState('')
  const [authSuccess, setAuthSuccess] = useState('')
  const [createError, setCreateError] = useState('')
  const [notice, setNotice] = useState(null)
  const [chatOpen, setChatOpen] = useState(false)
  const [chatInput, setChatInput] = useState('')
  const [chatMessages, setChatMessages] = useState([])
  const [chatSending, setChatSending] = useState(false)
  const [chatError, setChatError] = useState('')
  const chatMessagesRef = useRef(null)

  useEffect(() => {
    let active = true

    apiRequest('/api/events')
      .then((data) => {
        if (active) setEvents(data)
      })
      .catch((error) => {
        if (active) setNotice({ type: 'error', text: error.message })
      })
      .finally(() => {
        if (active) setLoadingEvents(false)
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true

    if (!session) {
      return () => {
        active = false
      }
    }

    apiRequest('/api/registrations/me', { token: session.token })
      .then((data) => {
        if (active) setRegistrations(data)
      })
      .catch((error) => {
        if (!active) return
        if (error.status === 401) {
          window.localStorage.removeItem(TOKEN_KEY)
          setSession(null)
          setRegistrations([])
          setNotice({ type: 'error', text: 'Your session expired. Please sign in again.' })
          return
        }
        setNotice({ type: 'error', text: error.message })
      })

    return () => {
      active = false
    }
  }, [session])

  useEffect(() => {
    if (chatOpen && chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight
    }
  }, [chatMessages, chatOpen, chatSending])

  const registeredEventIds = useMemo(
    () => new Set(registrations.map((registration) => {
      const event = registration.eventId
      return typeof event === 'object' && event ? event._id : event
    })),
    [registrations],
  )

  const visibleEvents = useMemo(() => {
    const term = search.trim().toLowerCase()

    return events.filter((event) => {
      const matchesView = view === 'all' || registeredEventIds.has(event._id)
      const matchesSearch = !term || [event.title, event.description, event.venue]
        .some((value) => value?.toLowerCase().includes(term))
      return matchesView && matchesSearch
    })
  }, [events, registeredEventIds, search, view])

  async function handleAuthSubmit(event) {
    event.preventDefault()
    setAuthError('')
    setAuthSuccess('')
    const form = new FormData(event.currentTarget)
    const isRegister = authMode === 'register'
    const body = {
      email: String(form.get('email')).trim(),
      password: String(form.get('password')),
    }

    if (isRegister) {
      body.name = String(form.get('name')).trim()
    }

    try {
      const result = await apiRequest(`/api/auth/${isRegister ? 'register' : 'login'}`, {
        method: 'POST',
        body: JSON.stringify(body),
      })

      if (isRegister) {
        setAuthMode('login')
        setAuthSuccess('Account created. Sign in to reserve your place.')
        return
      }

      const user = readTokenPayload(result.token)
      if (!user) {
        throw new Error('The server returned an invalid sign-in token.')
      }

      window.localStorage.setItem(TOKEN_KEY, result.token)
      setSession({ token: result.token, user })
      setAuthMode(null)
      setNotice({ type: 'success', text: 'Welcome to Campus 360.' })
    } catch (error) {
      setAuthError(error.message)
    }
  }

  function signOut() {
    window.localStorage.removeItem(TOKEN_KEY)
    setSession(null)
    setRegistrations([])
    setView('all')
    setNotice({ type: 'success', text: 'You have signed out.' })
  }

  function openAuth(mode) {
    setAuthError('')
    setAuthSuccess('')
    setAuthMode(mode)
  }

  async function refreshRegistrations(token = session?.token) {
    if (!token) return
    const data = await apiRequest('/api/registrations/me', { token })
    setRegistrations(data)
  }

  async function handleRegistration(eventId) {
    if (!session) {
      openAuth('login')
      return
    }

    setBusyEventId(eventId)
    try {
      if (registeredEventIds.has(eventId)) {
        await apiRequest(`/api/registrations/events/${eventId}`, {
          method: 'DELETE',
          token: session.token,
        })
        setNotice({ type: 'success', text: 'Your reservation was cancelled.' })
      } else {
        await apiRequest(`/api/registrations/events/${eventId}`, {
          method: 'POST',
          token: session.token,
        })
        setNotice({ type: 'success', text: 'You are on the guest list!' })
      }
      await refreshRegistrations()
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
    } finally {
      setBusyEventId(null)
    }
  }

  async function handleSaveEvent(event) {
    event.preventDefault()
    setCreateError('')
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const isEditing = Boolean(editingEvent)
    const localDate = new Date(String(form.get('date')))

    if (Number.isNaN(localDate.getTime())) {
      setCreateError('Choose a valid event date and time.')
      return
    }

    const body = {
      title: String(form.get('title')).trim(),
      description: String(form.get('description')).trim(),
      date: localDate.toISOString(),
      venue: String(form.get('venue')).trim(),
      capacity: Number(form.get('capacity')),
    }

    try {
      const savedEvent = await apiRequest(
        isEditing ? `/api/events/${editingEvent._id}` : '/api/events',
        {
          method: isEditing ? 'PUT' : 'POST',
          token: session.token,
          body: JSON.stringify(body),
        },
      )
      setEvents((current) => {
        const next = isEditing
          ? current.map((item) => item._id === savedEvent._id ? savedEvent : item)
          : [...current, savedEvent]
        return next.sort((a, b) => new Date(a.date) - new Date(b.date))
      })
      setShowCreateForm(false)
      setEditingEvent(null)
      formElement.reset()
      setNotice({
        type: 'success',
        text: isEditing ? 'Event changes saved.' : 'Your event is live.',
      })
    } catch (error) {
      setCreateError(error.message)
    }
  }

  async function handleDeleteEvent(event) {
    const confirmed = window.confirm(
      `Delete "${event.title}"? This will also remove its registrations.`,
    )
    if (!confirmed) return

    setBusyEventId(event._id)
    try {
      await apiRequest(`/api/events/${event._id}`, {
        method: 'DELETE',
        token: session.token,
      })
      setEvents((current) => current.filter((item) => item._id !== event._id))
      setRegistrations((current) => current.filter((registration) => {
        const registeredEvent = registration.eventId
        const registeredEventId = typeof registeredEvent === 'object' && registeredEvent
          ? registeredEvent._id
          : registeredEvent
        return registeredEventId !== event._id
      }))
      setNotice({ type: 'success', text: 'Event and its registrations were deleted.' })
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
    } finally {
      setBusyEventId(null)
    }
  }

  function closeEventForm() {
    setShowCreateForm(false)
    setEditingEvent(null)
    setCreateError('')
  }

  async function sendChatMessage(message) {
    const text = message.trim()
    if (!text || chatSending) return

    const history = chatMessages.slice(-8)
    setChatMessages((current) => [...current, { role: 'user', content: text }])
    setChatInput('')
    setChatError('')
    setChatSending(true)

    try {
      const result = await apiRequest('/api/chat', {
        method: 'POST',
        body: JSON.stringify({ message: text, history }),
      })
      setChatMessages((current) => [...current, { role: 'model', content: result.reply }])
    } catch (error) {
      setChatError(error.message)
    } finally {
      setChatSending(false)
    }
  }

  function handleChatSubmit(event) {
    event.preventDefault()
    sendChatMessage(chatInput)
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Campus 360 home">
          <span className="brand-mark" aria-hidden="true"><span /></span>
          <span>campus<span className="brand-light">360</span></span>
        </a>
        <nav className="desktop-nav" aria-label="Main navigation">
          <a className="nav-active" href="#events">Discover</a>
          <a href="#about">About</a>
        </nav>
        <div className="header-actions">
          {session ? (
            <>
              <span className="member-label">
                {session.user.role === 'admin' ? 'Admin' : 'Member'}
              </span>
              <button className="button button-outline button-small" onClick={signOut}>
                Sign out
              </button>
            </>
          ) : (
            <>
              <button className="button button-quiet" onClick={() => openAuth('login')}>
                Log in
              </button>
              <button className="button button-dark button-small" onClick={() => openAuth('register')}>
                Join campus
              </button>
            </>
          )}
        </div>
      </header>

      <main id="top">
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow"><span className="eyebrow-dot" /> YOUR CAMPUS, IN EVERY DIRECTION</p>
            <h1>Make room for<br /><em>what moves you.</em></h1>
            <p className="hero-description">
              Find your people, try something new, and make the most of every day on campus.
            </p>
            <div className="hero-actions">
              <a className="button button-lime" href="#events">Explore events <span aria-hidden="true">-&gt;</span></a>
              {!session && (
                <button className="button button-hero-quiet" onClick={() => openAuth('register')}>
                  Create an account
                </button>
              )}
            </div>
            <div className="hero-proof">
              <div className="avatar-stack" aria-hidden="true">
                <span>J</span><span>M</span><span>A</span><span>+</span>
              </div>
              <p><strong>A campus full of possibility.</strong><br />Your next chapter starts here.</p>
            </div>
          </div>
          <div className="hero-art" aria-label="Campus community illustration">
            <div className="art-sun" />
            <div className="art-orbit orbit-one" />
            <div className="art-orbit orbit-two" />
            <div className="art-card art-card-back">
              <span className="art-card-icon">+</span>
              <span>Find your next thing</span>
            </div>
            <div className="art-card art-card-main">
              <span className="art-label">A LITTLE MORE YOU</span>
              <span className="art-main-title">Good things<br />happen together.</span>
              <span className="art-main-footer"><span className="mini-avatars">● ● ●</span> See you out there</span>
            </div>
            <div className="art-sticker">SHOW UP<br />AS YOU ARE</div>
            <span className="art-spark spark-one">*</span>
            <span className="art-spark spark-two">+</span>
          </div>
          <div className="hero-index"><span>01</span> / FIND YOUR NEXT THING</div>
        </section>

        <section className="event-section" id="events">
          <div className="section-heading">
            <div>
              <p className="eyebrow eyebrow-dark">THE CAMPUS CALENDAR</p>
              <h2>Out there is <em>where it starts.</em></h2>
            </div>
            {session?.user.role === 'admin' && (
              <button className="button button-dark" onClick={() => {
                setCreateError('')
                setEditingEvent(null)
                setShowCreateForm(true)
              }}>
                <span aria-hidden="true">+</span> Create event
              </button>
            )}
          </div>

          <div className="event-toolbar">
            <div className="event-tabs" role="tablist" aria-label="Event view">
              <button
                className={view === 'all' ? 'tab-active' : ''}
                onClick={() => setView('all')}
                role="tab"
                aria-selected={view === 'all'}
              >
                All events <span>{events.length}</span>
              </button>
              <button
                className={view === 'mine' ? 'tab-active' : ''}
                onClick={() => {
                  if (!session) {
                    openAuth('login')
                    return
                  }
                  setView('mine')
                }}
                role="tab"
                aria-selected={view === 'mine'}
              >
                My schedule <span>{registrations.length}</span>
              </button>
            </div>
            <label className="search-box">
              <span className="search-icon" aria-hidden="true" />
              <input
                type="search"
                placeholder="Search events or places"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                aria-label="Search events"
              />
              <kbd>/</kbd>
            </label>
          </div>

          {notice && (
            <div className={`notice notice-${notice.type}`} role="status">
              <span>{notice.text}</span>
              <button aria-label="Dismiss message" onClick={() => setNotice(null)}>×</button>
            </div>
          )}

          {loadingEvents ? (
            <div className="loading-state"><span className="loading-spinner" /> Loading campus events...</div>
          ) : visibleEvents.length > 0 ? (
            <div className="event-grid">
              {visibleEvents.map((event, index) => {
                const date = formatEventDate(event.date)
                const isRegistered = registeredEventIds.has(event._id)
                return (
                  <article className={`event-card event-card-${index % 3}`} key={event._id}>
                    <div className="event-card-top">
                      <div className="date-tile">
                        <span>{date.month}</span>
                        <strong>{date.day}</strong>
                      </div>
                      <span className="event-type"><span /> CAMPUS EVENT</span>
                      <span className="event-card-mark" aria-hidden="true">{['*', 'o', '+'][index % 3]}</span>
                    </div>
                    <div className="event-card-content">
                      <p className="event-time">{date.full}</p>
                      <h3>{event.title}</h3>
                      <p className="event-description">{event.description}</p>
                      <div className="event-meta">
                        <span className="meta-pin" aria-hidden="true">@</span>
                        <span>{event.venue}</span>
                      </div>
                      <div className="event-card-footer">
                        <span className="capacity-label">Capacity {event.capacity}</span>
                        <button
                          className={`button ${isRegistered ? 'button-registered' : 'button-card'}`}
                          onClick={() => handleRegistration(event._id)}
                          disabled={busyEventId === event._id}
                        >
                          {busyEventId === event._id
                            ? 'Please wait...'
                            : isRegistered
                              ? 'Going'
                              : session
                                ? 'Save my spot'
                                : 'Join to attend'}
                        </button>
                      </div>
                      {session?.user.role === 'admin' && (
                        <div className="event-admin-actions">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCreateError('')
                                    setEditingEvent(event)
                                    setShowCreateForm(true)
                                  }}
                                >
                                  Edit event
                                </button>
                                <button
                                  type="button"
                                  className="event-delete-button"
                                  onClick={() => handleDeleteEvent(event)}
                                  disabled={busyEventId === event._id}
                                >
                                  {busyEventId === event._id ? 'Please wait...' : 'Delete event'}
                                </button>
                        </div>
                      )}
                    </div>
                  </article>
                )
              })}
            </div>
          ) : (
            <div className="empty-state">
              <span className="empty-mark">*</span>
              <h3>{view === 'mine' ? 'Your schedule is a blank page.' : 'No events found.'}</h3>
              <p>
                {view === 'mine'
                  ? 'Find an event that sounds like you and save your spot.'
                  : 'Try a different search, or check back soon for something new.'}
              </p>
              {view === 'mine' && (
                <button className="button button-dark" onClick={() => setView('all')}>Explore all events</button>
              )}
            </div>
          )}
        </section>

        <section className="about-strip" id="about">
          <div className="about-symbol" aria-hidden="true">C<span>360</span></div>
          <div>
            <p className="eyebrow eyebrow-dark">A CAMPUS THAT FEELS LIKE YOURS</p>
            <h2>There is a place for <em>you here.</em></h2>
          </div>
          <p className="about-copy">
            Campus 360 brings student events and your campus community together in one place.
          </p>
          {!session && (
            <button className="button button-dark" onClick={() => openAuth('register')}>
              Find your people <span aria-hidden="true">-&gt;</span>
            </button>
          )}
        </section>
      </main>

      <footer className="site-footer">
        <a className="brand brand-footer" href="#top">
          <span className="brand-mark" aria-hidden="true"><span /></span>
          <span>campus<span className="brand-light">360</span></span>
        </a>
        <span>Make the most of where you are.</span>
        <span>Campus 360 {CURRENT_YEAR}</span>
      </footer>

      {authMode && (
        <div className="modal-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setAuthMode(null)
        }}>
          <section className="dialog-card" role="dialog" aria-modal="true" aria-labelledby="auth-title">
            <button className="dialog-close" onClick={() => setAuthMode(null)} aria-label="Close dialog">x</button>
            <span className="dialog-mark">*</span>
            <p className="eyebrow eyebrow-dark">{authMode === 'register' ? 'YOUR CAMPUS IS CALLING' : 'GOOD TO SEE YOU'}</p>
            <h2 id="auth-title">{authMode === 'register' ? 'Find your people.' : 'Welcome back.'}</h2>
            <p className="dialog-intro">
              {authMode === 'register'
                ? 'Create an account to reserve your spot at campus events.'
                : 'Sign in to see your schedule and save your spot.'}
            </p>
            {authSuccess && <p className="form-success" role="status">{authSuccess}</p>}
            {authError && <p className="form-error" role="alert">{authError}</p>}
            <form className="auth-form" onSubmit={handleAuthSubmit}>
              {authMode === 'register' && (
                <label>
                  Your name
                  <input name="name" type="text" autoComplete="name" required maxLength="80" />
                </label>
              )}
              <label>
                Email address
                <input name="email" type="email" autoComplete="email" required />
              </label>
              <label>
                Password
                <input name="password" type="password" autoComplete={authMode === 'register' ? 'new-password' : 'current-password'} minLength="8" required />
                {authMode === 'register' && <span className="field-hint">At least 8 characters</span>}
              </label>
              <button className="button button-dark button-submit" type="submit">
                {authMode === 'register' ? 'Create my account' : 'Sign in'}
                <span aria-hidden="true">-&gt;</span>
              </button>
            </form>
            <p className="dialog-switch">
              {authMode === 'register' ? 'Already a member?' : 'New around here?'}
              <button onClick={() => {
                setAuthMode(authMode === 'register' ? 'login' : 'register')
                setAuthError('')
                setAuthSuccess('')
              }}>
                {authMode === 'register' ? 'Sign in' : 'Create an account'}
              </button>
            </p>
          </section>
        </div>
      )}

      {showCreateForm && (
        <div className="modal-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeEventForm()
        }}>
          <section className="dialog-card create-dialog" role="dialog" aria-modal="true" aria-labelledby="create-title">
            <button className="dialog-close" onClick={closeEventForm} aria-label="Close dialog">x</button>
            <p className="eyebrow eyebrow-dark">ADMIN EVENT TOOLS</p>
            <h2 id="create-title">{editingEvent ? 'Update the details.' : 'Put something on.'}</h2>
            <p className="dialog-intro">
              {editingEvent ? 'Edit this event for the campus community.' : 'Create an event for the campus community.'}
            </p>
            {createError && <p className="form-error" role="alert">{createError}</p>}
            <form className="auth-form" onSubmit={handleSaveEvent}>
              <label>Event title<input name="title" required maxLength="120" defaultValue={editingEvent?.title || ''} /></label>
              <label>Description<textarea name="description" rows="3" required maxLength="1000" defaultValue={editingEvent?.description || ''} /></label>
              <div className="form-row">
                <label>Date and time<input name="date" type="datetime-local" required defaultValue={editingEvent ? formatDateTimeInput(editingEvent.date) : ''} /></label>
                <label>Capacity<input name="capacity" type="number" min="1" step="1" required defaultValue={editingEvent?.capacity || ''} /></label>
              </div>
              <label>Venue<input name="venue" required maxLength="120" defaultValue={editingEvent?.venue || ''} /></label>
              <button className="button button-dark button-submit" type="submit">
                {editingEvent ? 'Save changes' : 'Publish event'} <span aria-hidden="true">-&gt;</span>
              </button>
            </form>
          </section>
        </div>
      )}

      <button
        className="chat-launcher"
        onClick={() => setChatOpen((open) => !open)}
        aria-expanded={chatOpen}
        aria-label={chatOpen ? 'Close Campus 360 assistant' : 'Open Campus 360 assistant'}
      >
        <span className="chat-launcher-mark" aria-hidden="true">?</span>
        <span>{chatOpen ? 'Close chat' : 'Ask Campus AI'}</span>
      </button>

      {chatOpen && (
        <section className="chat-panel" role="dialog" aria-label="Campus 360 event assistant">
          <header className="chat-header">
            <div className="chat-header-mark" aria-hidden="true">C</div>
            <div>
              <h2>Campus guide</h2>
              <p>Ask about events and registration</p>
            </div>
            <button
              className="chat-close"
              onClick={() => setChatOpen(false)}
              aria-label="Close chat"
            >
              x
            </button>
          </header>

          <div className="chat-messages" ref={chatMessagesRef} aria-live="polite">
            {chatMessages.length === 0 ? (
              <div className="chat-welcome">
                <p className="chat-assistant-message">
                  Hi! I can help you find campus events and explain how to register.
                </p>
                <div className="chat-prompts">
                  <button type="button" onClick={() => sendChatMessage('What events are coming up?')}>
                    What events are coming up?
                  </button>
                  <button type="button" onClick={() => sendChatMessage('How do I register for an event?')}>
                    How do I register?
                  </button>
                </div>
              </div>
            ) : (
              chatMessages.map((message, index) => (
                <p
                  className={`chat-message chat-message-${message.role}`}
                  key={`${message.role}-${index}`}
                >
                  {message.content}
                </p>
              ))
            )}
            {chatSending && <p className="chat-assistant-message chat-typing">Thinking...</p>}
          </div>

          {chatError && <p className="chat-error" role="alert">{chatError}</p>}

          <form className="chat-form" onSubmit={handleChatSubmit}>
            <textarea
              value={chatInput}
              onChange={(event) => setChatInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  event.currentTarget.form?.requestSubmit()
                }
              }}
              maxLength="500"
              rows="2"
              placeholder="Ask about campus events..."
              aria-label="Message Campus 360 assistant"
            />
            <button className="button button-dark" type="submit" disabled={chatSending || !chatInput.trim()}>
              Send
            </button>
          </form>
          <p className="chat-disclaimer">AI answers may be inaccurate. Confirm event details on the cards.</p>
        </section>
      )}
    </div>
  )
}

export default App
