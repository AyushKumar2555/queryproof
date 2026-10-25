import { useEffect, useState } from 'react'
import {
  analyzeQuestion,
  clearToken,
  loadHistory,
  login,
  readToken,
  register,
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
  const [question, setQuestion] = useState('')

  useEffect(() => {
    if (token) refreshHistory()
  }, [token])

  function onSignedIn(session) {
    saveToken(session.token)
    setToken(session.token)
  }

  function onSignOut() {
    clearToken()
    setToken('')
    setResult(null)
    setError('')
    setHistory([])
    setHistoryError('')
    setScores(null)
    setScoreError('')
    setQuestion('')
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
    <main className="page">
      <Hero signedIn={Boolean(token)} onSignOut={onSignOut} />
      <Proof />
      <Why />
      <How />
      <Stack />
      <section className="live" id="live">
        <h2>Try it live</h2>
        {token ? (
          <LiveApp
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
            onOpen={setResult}
          />
        ) : (
          <>
            <p className="muted">Create an account to ask your own question and run the grade.</p>
            <AuthForm onSignedIn={onSignedIn} />
          </>
        )}
      </section>
    </main>
  )
}

function Hero({ signedIn, onSignOut }) {
  return (
    <header className="hero">
      <p className="name">
        <span>Queryproof</span>
        {signedIn ? <button type="button" className="link" onClick={onSignOut}>Sign out</button> : null}
      </p>
      <h1>A query can run, find nothing, and still be right.</h1>
      <p className="lede">
        Queryproof turns one English question about an FDA drug recall into a search query, runs it, and grades whether the query kept the facts you asked for.
      </p>
      <a className="primary" href="#live">Try it live</a>
      <a className="primary ghost" href="#proof">See the proof</a>
      <ul className="facts">
        <li><b>~300</b> FDA drug-enforcement records</li>
        <li><b>1</b> index: drug_enforcement</li>
        <li><b>6</b> kinds of facts on an answer key</li>
        <li><b>0</b> JSON text comparisons</li>
      </ul>
    </header>
  )
}

function Proof() {
  return (
    <section id="proof">
      <h2>One question, graded two ways</h2>
      <p className="muted">
        The saved answer key asks for insulin recalls that are Class I, in Texas, during 2024. No stored record matches all of that. The grade and the result still tell the truth.
      </p>
      <div className="demo">
        <div className="panel">
          <h3>The grade: did the query keep the facts?</h3>
          <p className="q">Class I insulin recalls in Texas during 2024</p>
          <p className="big">5 of 5</p>
          <p className="muted tight">Every fact is in the query.</p>
          <ul>
            <li className="pass"><span>Class <code>Class I</code></span><b>Pass</b></li>
            <li className="pass"><span>State <code>TX</code></span><b>Pass</b></li>
            <li className="pass"><span>Start date <code>2024-01-01</code></span><b>Pass</b></li>
            <li className="pass"><span>End date <code>2024-12-31</code></span><b>Pass</b></li>
            <li className="pass"><span>Product words <code>insulin</code></span><b>Pass</b></li>
          </ul>
        </div>
        <div className="panel">
          <h3>The result: what the data holds</h3>
          <p className="q">Matching recalls</p>
          <p className="empty flat">
            <b>No matching recalls.</b> The query ran. No stored record fits it. This is not a grade miss.
          </p>
          <p className="muted spaced">
            The only insulin record is Class II, from Canada, in 2014. The query was right. The data simply has no such recall.
          </p>
        </div>
      </div>
      <div className="contrast">
        <div className="miss-note">
          <b>Miss</b>
          <p>The query dropped or changed a fact, such as the wrong class or state. It is a wrong filter, even if it returns recalls.</p>
        </div>
        <div className="empty-note">
          <b>No matching recalls</b>
          <p>The query kept every fact, and no stored record matches them. Nothing is wrong with the query.</p>
        </div>
      </div>
    </section>
  )
}

function Why() {
  return (
    <section>
      <h2>Why it is built this way</h2>
      <div className="why">
        <div>
          <h3>Grade facts, not text</h3>
          <p>Two different queries can mean the same thing. Queryproof asks the model the same question again and checks class, state, firm, dates, and product words.</p>
        </div>
        <div>
          <h3>Separate wrong from empty</h3>
          <p>A result count alone cannot tell a bad filter from a missing record. The grade and the recalls stay apart so each failure is readable.</p>
        </div>
        <div>
          <h3>Keep the evidence last</h3>
          <p>The raw query sits at the bottom of every result. You read the score and the recalls first, then open the query.</p>
        </div>
      </div>
    </section>
  )
}

function How() {
  return (
    <section>
      <h2>How it works</h2>
      <ol className="explainer">
        <li><strong>Ask</strong><span>Type a question about an FDA drug recall in plain English, or pick one of five stored questions.</span></li>
        <li><strong>Run</strong><span>Queryproof writes a query for the drug_enforcement index, runs it, and lists each recall with firm, class, state, recall number, and product.</span></li>
        <li><strong>Grade</strong><span>Every active answer key is graded Pass or Miss on each fact. Each account keeps its own question history.</span></li>
      </ol>
    </section>
  )
}

function Stack() {
  return (
    <section>
      <h2>What is under it</h2>
      <ul className="stack">
        <li>React 19</li>
        <li>Vite</li>
        <li>Express API</li>
        <li>Elasticsearch</li>
        <li>Token sign-in</li>
        <li>Per-account history</li>
      </ul>
    </section>
  )
}

function LiveApp({
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
    <>
      <EvalPanel scores={scores} error={scoreError} pending={scoring} onScore={onScore} />
      <QuestionForm question={question} pending={pending} onQuestion={onQuestion} onAsk={onAsk} />
      {askError ? <p className="error" role="alert">{askError}</p> : null}
      {pending ? <p className="waiting" role="status">Writing and running the query…</p> : null}
      {result ? <Answer result={result} /> : null}
      <HistoryList records={history} error={historyError} onOpen={onOpen} />
    </>
  )
}

function AuthForm({ onSignedIn }) {
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
    <div className="panel">
      <h2>{creating ? 'Create an account' : 'Sign in to ask a question'}</h2>
      <form onSubmit={onSubmit}>
        <label htmlFor="email">
          Email
          <input id="email" type="email" value={email} autoComplete="email" onChange={(event) => setEmail(event.target.value)} />
        </label>
        <label htmlFor="password">
          Password
          <input
            id="password"
            type="password"
            value={password}
            autoComplete={creating ? 'new-password' : 'current-password'}
            onChange={(event) => setPassword(event.target.value)}
          />
          <small>At least 8 characters.</small>
        </label>
        {error ? <p className="error" role="alert">{error}</p> : null}
        <div className="row">
          <button className="primary" type="submit" disabled={pending || !email.trim() || password.length < 8}>
            {pending ? 'Please wait…' : creating ? 'Create account' : 'Sign in'}
          </button>
          <button
            type="button"
            className="link"
            onClick={() => {
              setMode(creating ? 'login' : 'register')
              setError('')
            }}
          >
            {creating ? 'Have an account? Sign in' : 'Need an account? Create one'}
          </button>
        </div>
      </form>
    </div>
  )
}

function EvalPanel({ scores, error, pending, onScore }) {
  return (
    <div className="panel">
      <h2>Did the query keep the facts?</h2>
      <p className="muted">Each answer key lists the facts a query must contain. We never compare JSON text.</p>
      <button type="button" className="primary" onClick={onScore} disabled={pending}>
        {pending ? 'Grading…' : 'Grade the answer keys'}
      </button>
      {error ? <p className="error" role="alert">{error}</p> : null}
      {scores ? <ScoreList scores={scores} /> : null}
    </div>
  )
}

function ScoreList({ scores }) {
  if (scores.length === 0) return <p>No answer keys yet.</p>
  return (
    <div className="score">
      {scores.map((score) => (
        <div className="key" key={score.id}>
          <p className="score-num">{score.passed} of {score.total}</p>
          <p className="key-q">{score.question}</p>
          <p className="muted tight">
            {score.passed === score.total ? 'Every fact is in the query.' : 'A missing fact is a wrong filter, even if the query ran.'}
          </p>
          <ul>
            {(score.checks || []).map((check) => (
              <li key={check.name} className={check.passed ? 'pass' : 'miss'}>
                <span>{CHECK_LABELS[check.name] || check.name}</span>
                <b>{check.passed ? 'Pass' : 'Miss'}</b>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <p className="muted note">A graded query can still return no recalls. The facts can be right while no stored record matches them.</p>
    </div>
  )
}

function QuestionForm({ question, pending, onQuestion, onAsk }) {
  function onSubmit(event) {
    event.preventDefault()
    ask(question)
  }

  function ask(text) {
    const trimmed = text.trim()
    if (trimmed.length < 5 || pending) return
    onQuestion(trimmed)
    onAsk(trimmed)
  }

  return (
    <section>
      <h2>Try a stored recall</h2>
      <div className="samples">
        {SAMPLES.map((sample) => (
          <button key={sample} type="button" disabled={pending} onClick={() => ask(sample)}>
            {sample}
          </button>
        ))}
      </div>
      <form onSubmit={onSubmit}>
        <label htmlFor="question">
          Or ask your own
          <textarea
            id="question"
            rows={2}
            value={question}
            placeholder="Class III recalls in California"
            onChange={(event) => onQuestion(event.target.value)}
          />
        </label>
        <button className="primary" type="submit" disabled={pending || question.trim().length < 5}>
          {pending ? 'Running the query…' : 'Ask'}
        </button>
      </form>
    </section>
  )
}

function Answer({ result }) {
  const hits = Array.isArray(result.hits) ? result.hits : null
  return (
    <section className="result" aria-live="polite">
      <h2>Matching recalls</h2>
      {result.explanation ? <p className="explanation">{result.explanation}</p> : null}
      {hits === null ? (
        <p className="muted">Recalls were not stored with this question.</p>
      ) : null}
      {hits && hits.length === 0 ? (
        <p className="empty">
          <b>No matching recalls.</b> The query ran. No stored record fits it. This is not a grade miss.
        </p>
      ) : null}
      {hits && hits.length > 0 ? (
        <ul className="recalls">
          {hits.map((hit) => (
            <Hit key={hit._id} source={hit._source || {}} />
          ))}
        </ul>
      ) : null}
      <details className="evidence">
        <summary>The query that ran on drug_enforcement</summary>
        <pre>{JSON.stringify(result.esQuery, null, 2)}</pre>
      </details>
    </section>
  )
}

function Hit({ source }) {
  return (
    <li>
      <p className="firm">{source.recalling_firm || 'Unknown firm'}</p>
      <p className="meta">
        {[source.classification, source.state || '—', source.recall_number].filter(Boolean).join(' · ')}
      </p>
      <p>{source.product_description}</p>
    </li>
  )
}

function HistoryList({ records, error, onOpen }) {
  return (
    <section className="history">
      <h2>Recent questions</h2>
      {error ? <p className="error" role="alert">{error}</p> : null}
      {records.length === 0 && !error ? <p className="muted">Your questions will appear here.</p> : null}
      <ul>
        {records.map((record) => (
          <li key={record._id}>
            <button type="button" className="link" onClick={() => onOpen(record.result)}>
              {record.naturalLanguageQuery}
            </button>
            <p className="meta">{formatWhen(record.createdAt)}</p>
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
