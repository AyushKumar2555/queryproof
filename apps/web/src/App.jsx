import { useEffect, useRef, useState } from 'react'
import {
  analyzeQuestion,
  clearEmail,
  clearToken,
  loadHistory,
  login,
  readEmail,
  readToken,
  register,
  saveEmail,
  saveToken,
  scoreCases,
} from './api.js'

const SAMPLES = [
  'Class II progesterone injection recalls in Illinois',
  'Semaglutide recalls in Pennsylvania',
  'Hand sanitizer recalls from Mexico',
  'Insulin recalls',
  'Class I recalls in Texas',
]

const CHECK_LABELS = {
  classification: 'Class',
  state: 'State',
  recallingFirm: 'Firm',
  dateFrom: 'Start date',
  dateTo: 'End date',
  textMustContain: 'Product words',
}

export default function App() {
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [history, setHistory] = useState([])
  const [historyError, setHistoryError] = useState('')
  const [scores, setScores] = useState(null)
  const [scoreError, setScoreError] = useState('')
  const [scoring, setScoring] = useState(false)
  const [token, setToken] = useState(readToken)
  const [email, setEmail] = useState(readEmail)
  const [question, setQuestion] = useState('')
  const [authOpen, setAuthOpen] = useState(false)
  const authRef = useRef(null)

  useEffect(() => {
    if (token) refreshHistory()
  }, [token])

  function showAuth() {
    setAuthOpen(true)
    requestAnimationFrame(() => authRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  function onSignedIn(session) {
    saveToken(session.token)
    saveEmail(session.user?.email)
    setToken(session.token)
    setEmail(session.user?.email || '')
  }

  function onSignOut() {
    clearToken()
    clearEmail()
    setToken('')
    setEmail('')
    setResult(null)
    setError('')
    setHistory([])
    setHistoryError('')
    setScores(null)
    setScoreError('')
    setQuestion('')
    setAuthOpen(false)
  }

  function leaveIfSignedOut(err) {
    if (err.status !== 401) return false
    onSignOut()
    return true
  }

  async function refreshHistory() {
    try {
      const page = await loadHistory()
      setHistory(page.records)
      setHistoryError('')
    } catch (err) {
      if (leaveIfSignedOut(err)) return
      setHistoryError(err.message)
    }
  }

  async function onAsk(text) {
    setPending(true)
    setError('')
    setResult(null)
    try {
      setResult(await analyzeQuestion(text))
      refreshHistory()
    } catch (err) {
      if (leaveIfSignedOut(err)) return
      setError(err.message)
    } finally {
      setPending(false)
    }
  }

  async function onScore() {
    setScoring(true)
    setScoreError('')
    try {
      setScores(await scoreCases())
    } catch (err) {
      if (leaveIfSignedOut(err)) return
      setScoreError(err.message)
    } finally {
      setScoring(false)
    }
  }

  return (
    <>
      <SiteHeader signedIn={Boolean(token)} email={email} onSignIn={showAuth} onSignOut={onSignOut} />
      <main>
        {token ? (
          <SignedIn
            scores={scores}
            scoreError={scoreError}
            scoring={scoring}
            onScore={onScore}
            question={question}
            pending={pending}
            askError={error}
            onQuestion={setQuestion}
            onAsk={onAsk}
            result={result}
            history={history}
            historyError={historyError}
            onOpen={(record) => {
              setQuestion(record.naturalLanguageQuery || '')
              setResult(record.result)
            }}
          />
        ) : (
          <SignedOut authOpen={authOpen} authRef={authRef} onOpenAuth={showAuth} onSignedIn={onSignedIn} />
        )}
      </main>
      <footer>
        <div className="wrap">Queryproof is a small demo by Yushbyte. It uses about 300 real FDA drug-enforcement records.</div>
      </footer>
    </>
  )
}

function SiteHeader({ signedIn, email, onSignIn, onSignOut }) {
  return (
    <header>
      <div className="wrap">
        <span className="brand">Queryproof</span>
        {signedIn ? (
          <div className="who">
            <span>{email || 'Signed in'}</span>
            <button className="btn quiet" type="button" onClick={onSignOut}>Sign out</button>
          </div>
        ) : (
          <button className="btn quiet" type="button" onClick={onSignIn}>Sign in</button>
        )}
      </div>
    </header>
  )
}

function SignedOut({ authOpen, authRef, onOpenAuth, onSignedIn }) {
  return (
    <div className="wrap">
      <div className="hero">
        <h1>A query can be right and still find nothing.</h1>
        <p className="lead">
          Queryproof turns a plain-English question about an FDA drug recall into a search, then checks the search against the facts you asked for. <strong>The number of hits does not tell you if the query is correct.</strong>
        </p>
        <button className="btn" type="button" onClick={onOpenAuth}>Try it live</button>
      </div>
      <Proof />
      <div className="how">
        <h2>How it works</h2>
        <ol>
          <li>You type one question about an FDA drug recall.</li>
          <li>Queryproof writes a query for one index, drug_enforcement, and runs it on about 300 real FDA drug-enforcement records.</li>
          <li>It grades the query against a saved answer key. The grade checks facts, not JSON text: class, state, firm, start date, end date, and product words.</li>
          <li>You see the grade, then the recalls. The query itself is there if you want the evidence.</li>
        </ol>
      </div>
      <AuthForm open={authOpen} formRef={authRef} onSignedIn={onSignedIn} />
    </div>
  )
}

function Proof() {
  return (
    <>
      <div className="q"><small>The question</small>Class I insulin recalls in Texas during 2024</div>
      <div className="split">
        <section>
          <span className="tag">The grade: did the query ask for what you asked?</span>
          <div className="score">5 of 5</div>
          <ul className="facts">
            <li><span className="k">Class</span><span>I <span className="pill pass">Pass</span></span></li>
            <li><span className="k">State</span><span>Texas <span className="pill pass">Pass</span></span></li>
            <li><span className="k">Start date</span><span>1 Jan 2024 <span className="pill pass">Pass</span></span></li>
            <li><span className="k">End date</span><span>31 Dec 2024 <span className="pill pass">Pass</span></span></li>
            <li><span className="k">Product words</span><span>insulin <span className="pill pass">Pass</span></span></li>
            <li><span className="k">Firm</span><span><span className="pill skip">Not asked</span></span></li>
          </ul>
        </section>
        <section>
          <span className="tag">The result: what the stored records hold</span>
          <div className="score-none">No matching recalls</div>
          <p className="why">The query ran. The only insulin recall in the data is Class II, from Canada, in 2014. No stored record fits, so nothing comes back.</p>
        </section>
      </div>
      <div className="rule">
        <div className="m"><p><b>A miss means a wrong fact.</b>The query dropped or changed something you asked for, such as the class or the state.</p></div>
        <div className="e"><p><b>No matching recalls means no record.</b>The query was right. The data just has no such recall.</p></div>
      </div>
    </>
  )
}

function AuthForm({ open, formRef, onSignedIn }) {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const creating = mode === 'register'

  async function onSubmit(event) {
    event.preventDefault()
    setPending(true)
    setError('')
    try {
      const session = creating ? await register(email, password) : await login(email, password)
      onSignedIn(session)
    } catch (err) {
      setError(err.message)
    } finally {
      setPending(false)
    }
  }

  return (
    <div className={open ? 'auth open' : 'auth'} id="auth" ref={formRef}>
      <div className="box">
        <div className="tabs" role="tablist">
          <button type="button" role="tab" aria-selected={!creating} onClick={() => setMode('login')}>Sign in</button>
          <button type="button" role="tab" aria-selected={creating} onClick={() => setMode('register')}>Create account</button>
        </div>
        <form onSubmit={onSubmit}>
          <label htmlFor="email">Email</label>
          <input id="email" type="email" autoComplete="email" value={email} required onChange={(event) => setEmail(event.target.value)} />
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete={creating ? 'new-password' : 'current-password'}
            minLength={8}
            value={password}
            required
            onChange={(event) => setPassword(event.target.value)}
          />
          <p className="hint">At least 8 characters.</p>
          {error ? <p className="err show" role="alert">{error}</p> : null}
          <button className="btn" type="submit" disabled={pending || !email.trim() || password.length < 8}>
            {pending ? 'Please wait…' : creating ? 'Create account' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}

function SignedIn({
  scores,
  scoreError,
  scoring,
  onScore,
  question,
  pending,
  askError,
  onQuestion,
  onAsk,
  result,
  history,
  historyError,
  onOpen,
}) {
  return (
    <div className="wrap app">
      <GradeSection scores={scores} error={scoreError} pending={scoring} onScore={onScore} />
      <AskSection question={question} pending={pending} onQuestion={onQuestion} onAsk={onAsk} />
      {askError ? <p className="err show" role="alert">{askError}</p> : null}
      {pending ? <Waiting /> : null}
      {result ? <Answer question={question} result={result} /> : null}
      <HistoryList records={history} error={historyError} onOpen={onOpen} />
    </div>
  )
}

function GradeSection({ scores, error, pending, onScore }) {
  return (
    <section className="sec">
      <h2>Grade the answer keys</h2>
      <p className="mute">Every question is graded on the facts you asked for. Each one is Pass or Miss. A fact you did not ask for is skipped.</p>
      <button className="btn" type="button" onClick={onScore} disabled={pending}>
        {pending ? 'Grading…' : 'Grade the answer keys'}
      </button>
      {error ? <p className="err show" role="alert">{error}</p> : null}
      {scores ? <ScoreList scores={scores} /> : null}
    </section>
  )
}

function ScoreList({ scores }) {
  if (scores.length === 0) return <p className="hint">No answer keys yet.</p>
  return scores.map((score) => (
    <div className="grade-key" key={score.id}>
      <div className="score">{score.passed} of {score.total}</div>
      <p>{score.question}</p>
      <p className="hint">
        {score.passed === score.total ? 'Every fact is in the query.' : 'A missing fact is a wrong filter, even if the query ran.'}
      </p>
      <ul className="facts">
        {(score.checks || []).map((check) => (
          <li key={check.name}>
            <span className="k">{CHECK_LABELS[check.name] || check.name}</span>
            <span className={check.passed ? 'pill pass' : 'pill miss'}>{check.passed ? 'Pass' : 'Miss'}</span>
          </li>
        ))}
      </ul>
      <p className="hint">A graded query can still return no recalls. The facts can be right while no stored record matches them.</p>
    </div>
  ))
}

function AskSection({ question, pending, onQuestion, onAsk }) {
  function ask(text) {
    const trimmed = text.trim()
    if (trimmed.length < 5 || pending) return
    onQuestion(trimmed)
    onAsk(trimmed)
  }

  return (
    <section className="sec">
      <h2>Ask a question</h2>
      <p className="mute">Pick a sample or write your own. Asking can take a little while.</p>
      <ul className="samples">
        {SAMPLES.map((sample) => (
          <li key={sample}>
            <button type="button" disabled={pending} onClick={() => onQuestion(sample)}>{sample}</button>
          </li>
        ))}
      </ul>
      <form onSubmit={(event) => { event.preventDefault(); ask(question) }}>
        <label htmlFor="question">Your question</label>
        <textarea
          id="question"
          rows={2}
          value={question}
          placeholder="One question about an FDA drug recall"
          onChange={(event) => onQuestion(event.target.value)}
        />
        <div className="ask-row">
          <button className="btn" type="submit" disabled={pending || question.trim().length < 5}>
            {pending ? 'Working on it…' : 'Grade this question'}
          </button>
        </div>
      </form>
    </section>
  )
}

function Waiting() {
  return (
    <section className="wait show" aria-live="polite">
      <h3>Working on it</h3>
      <p className="mute">This usually takes a little while. Your question is still running.</p>
      <ol>
        <li className="on">Writing the query</li>
        <li>Running it on the recalls</li>
        <li>Reading the result</li>
      </ol>
      <div className="bar"><i /></div>
    </section>
  )
}

function Answer({ question, result }) {
  const hits = Array.isArray(result.hits) ? result.hits : null
  return (
    <section className="result show" aria-live="polite">
      <div className="card">
        <span className="tag">Your question</span>
        <p className="rq">{question}</p>
        {result.explanation ? <p className="explain">{result.explanation}</p> : null}
      </div>
      {hits === null ? <p className="hint">Recalls were not stored with this question.</p> : null}
      {hits && hits.length === 0 ? (
        <div className="empty">
          <h3>No matching recalls</h3>
          <p>The query ran, and no stored record fits it. This is not a failed grade.</p>
        </div>
      ) : null}
      {hits && hits.length > 0 ? (
        <div className="card">
          <h3>Matching recalls</h3>
          {hits.map((hit) => (
            <Hit key={hit._id} source={hit._source || {}} />
          ))}
        </div>
      ) : null}
      <details>
        <summary>The query that ran</summary>
        <pre>{JSON.stringify(result.esQuery, null, 2)}</pre>
      </details>
    </section>
  )
}

function Hit({ source }) {
  return (
    <article className="recall">
      <div className="firm">{source.recalling_firm || 'Unknown firm'}</div>
      <div className="meta">
        {source.classification ? <span>{source.classification}</span> : null}
        <span>{source.state || '—'}</span>
        {source.recall_number ? <span>{source.recall_number}</span> : null}
      </div>
      <p>{source.product_description}</p>
    </article>
  )
}

function HistoryList({ records, error, onOpen }) {
  return (
    <section className="sec">
      <h2>Your recent questions</h2>
      <p className="mute">Only you can see this list. Other accounts cannot.</p>
      {error ? <p className="err show" role="alert">{error}</p> : null}
      {records.length === 0 && !error ? <p className="hint">Your questions will appear here.</p> : null}
      <ul className="recent">
        {records.map((record) => (
          <li key={record._id}>
            <button type="button" onClick={() => onOpen(record)}>{record.naturalLanguageQuery}</button>
            <span className="mute">{formatWhen(record.createdAt)}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function formatWhen(value) {
  if (!value) return ''
  return new Date(value).toLocaleString()
}
