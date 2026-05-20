'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

/* ===== 타입 정의 ===== */
interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}
type CoverStatus = 'idle' | 'streaming' | 'done' | 'error';

/* ===== 탭 목록 ===== */
const TABS = [
  { id: 'home',     label: 'Home' },
  { id: 'about',    label: 'About' },
  { id: 'skills',   label: 'Skills' },
  { id: 'projects', label: 'Projects' },
  { id: 'cover',    label: 'Cover Letter' },
  { id: 'ai',       label: 'Ask AI' },
  { id: 'contact',  label: 'Contact' },
];

const QUICK_QUESTIONS = [
  { label: '어떤 프로젝트를?', message: '어떤 프로젝트를 진행했나요?' },
  { label: '업무 스타일',     message: '업무 스타일이 어떤가요?' },
  { label: 'AI Lab 하는 일', message: 'AI Lab에서 어떤 일을 하나요?' },
  { label: '협업 방식',       message: '협업할 때 어떻게 일하나요?' },
];

export default function PortfolioPage() {
  /* ===== 탭 상태 ===== */
  const [activeTab, setActiveTab] = useState('home');
  const contentRef = useRef<HTMLDivElement>(null);

  /* ===== 기타 상태 ===== */
  const [typingText, setTypingText]   = useState('');
  const [coverCompany, setCoverCompany] = useState('');
  const [coverPosition, setCoverPosition] = useState('');
  const [coverTone, setCoverTone]     = useState('professional');
  const [coverText, setCoverText]     = useState('');
  const [coverLabel, setCoverLabel]   = useState('COVER LETTER OUTPUT');
  const [coverStatus, setCoverStatus] = useState<CoverStatus>('idle');
  const [coverCopied, setCoverCopied] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput]     = useState('');
  const [isAiTyping, setIsAiTyping]   = useState(false);
  const [emailCopied, setEmailCopied] = useState(false);

  const typingTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const coverTextRef    = useRef('');
  const convRef         = useRef<ChatMessage[]>([]);

  /* ===== 탭 전환 ===== */
  const switchTab = useCallback((id: string) => {
    setActiveTab(id);
    if (contentRef.current) contentRef.current.scrollTop = 0;
  }, []);

  /* ===== 탭 전환 시 fade-up 재적용 ===== */
  useEffect(() => {
    const timer = setTimeout(() => {
      const observer = new IntersectionObserver(
        (entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add('visible'); }),
        { threshold: 0.05 }
      );
      document.querySelectorAll('.fade-up').forEach((el) => {
        el.classList.remove('visible');
        observer.observe(el);
      });
      return () => observer.disconnect();
    }, 50);
    return () => clearTimeout(timer);
  }, [activeTab]);

  /* ===== 타이핑 애니메이션 (Home 탭에만) ===== */
  useEffect(() => {
    if (activeTab !== 'home') return;
    const words = ['Product Manager', 'Problem Solver', 'UX Thinker', 'Storyteller'];
    let wi = 0, ci = 0, del = false;
    function type() {
      const w = words[wi];
      if (!del) { ci++; setTypingText(w.slice(0, ci)); if (ci === w.length) { del = true; typingTimerRef.current = setTimeout(type, 1800); return; } }
      else { ci--; setTypingText(w.slice(0, ci)); if (ci === 0) { del = false; wi = (wi + 1) % words.length; } }
      typingTimerRef.current = setTimeout(type, del ? 50 : 90);
    }
    typingTimerRef.current = setTimeout(type, 300);
    return () => { if (typingTimerRef.current) clearTimeout(typingTimerRef.current); };
  }, [activeTab]);

  /* ===== 채팅 자동 스크롤 ===== */
  useEffect(() => {
    if (chatContainerRef.current) chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
  }, [chatMessages, isAiTyping]);

  /* ===== 이메일 복사 ===== */
  const copyEmail = useCallback(() => {
    navigator.clipboard.writeText('hello@yhkim.me');
    setEmailCopied(true); setTimeout(() => setEmailCopied(false), 2000);
  }, []);

  /* ===== 커버레터 생성 ===== */
  const generateCoverLetter = useCallback(async () => {
    if (!coverCompany.trim() || !coverPosition.trim()) return;
    setCoverStatus('streaming'); setCoverText(''); coverTextRef.current = '';
    setCoverLabel(`${coverCompany.toUpperCase()} · ${coverPosition.toUpperCase()}`);
    try {
      const res = await fetch('/api/cover-letter', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company: coverCompany, position: coverPosition, tone: coverTone }),
      });
      if (!res.ok || !res.body) throw new Error('오류');
      const reader = res.body.getReader(); const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        const lines = decoder.decode(value, { stream: true }).split('\n');
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6).trim(); if (payload === '[DONE]') break;
          try { const d = JSON.parse(payload); if (d.text) { coverTextRef.current += d.text; setCoverText(coverTextRef.current); } } catch { /**/ }
        }
      }
      setCoverStatus('done');
    } catch { setCoverStatus('error'); }
  }, [coverCompany, coverPosition, coverTone]);

  const copyCoverLetter = useCallback(() => {
    if (!coverTextRef.current) return;
    navigator.clipboard.writeText(coverTextRef.current);
    setCoverCopied(true); setTimeout(() => setCoverCopied(false), 2000);
  }, []);

  /* ===== AI 채팅 ===== */
  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isAiTyping) return;
    const userMsg: ChatMessage = { role: 'user', content: text };
    setChatMessages((p) => [...p, userMsg]); convRef.current = [...convRef.current, userMsg];
    setChatInput(''); setIsAiTyping(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: convRef.current }),
      });
      const data = await res.json();
      const reply = data.content?.[0]?.text || '일시적 오류가 발생했습니다.';
      const aiMsg: ChatMessage = { role: 'assistant', content: reply };
      setChatMessages((p) => [...p, aiMsg]); convRef.current = [...convRef.current, aiMsg];
    } catch {
      setChatMessages((p) => [...p, { role: 'assistant', content: '일시적으로 응답하지 못했습니다.' }]);
    }
    setIsAiTyping(false);
  }, [isAiTyping]);

  /* ===== JSX ===== */
  return (
    <div className="portfolio-layout">

      {/* ─── 탭 헤더 ─── */}
      <header className="tab-header">
        <button className="nav-logo" onClick={() => switchTab('home')}>이현<span>.</span></button>
        <nav className="tab-nav">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`tab-btn${activeTab === t.id ? ' active' : ''}`}
              onClick={() => switchTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      {/* ─── 탭 콘텐츠 영역 ─── */}
      <main className="tab-content-area" ref={contentRef}>
        <div key={activeTab} className="tab-panel">

          {/* ══ HOME ══ */}
          {activeTab === 'home' && (
            <div className="tab-home">
              <div className="hero-left">
                <p className="hero-eyebrow fade-up">Product Manager · AI Lab</p>
                <h1 className="hero-name fade-up" style={{ transitionDelay: '.08s' }}>김이현</h1>
                <p className="hero-role fade-up" style={{ transitionDelay: '.16s' }}>
                  <span>{typingText}</span><span className="cursor" />
                </p>
                <p className="hero-sub fade-up" style={{ transitionDelay: '.24s' }}>
                  YBM AI Lab에서 에듀테크 콘텐츠를 기획합니다.<br />
                  사람이 더 잘 배울 수 있는 경험을 만드는 일을 합니다.
                </p>
                <div className="hero-actions fade-up" style={{ transitionDelay: '.32s' }}>
                  <button className="btn-primary" onClick={() => switchTab('projects')}>프로젝트 보기 →</button>
                  <button className="btn-ghost" onClick={() => switchTab('contact')}>연락하기</button>
                </div>
              </div>
              <div className="hero-right fade-up" style={{ transitionDelay: '.2s' }}>
                <div className="hero-card">
                  <div className="hero-card-header">
                    <div className="dot r" /><div className="dot y" /><div className="dot g" />
                  </div>
                  <div className="hero-card-body">
                    <p className="code-line"><span className="kw">const</span> <span className="fn">planner</span> = {'{'}</p>
                    <p className="code-line">&nbsp;&nbsp;<span className="str">name</span>: <span className="val">&quot;김이현&quot;</span>,</p>
                    <p className="code-line">&nbsp;&nbsp;<span className="str">role</span>: <span className="val">&quot;PM / Content Planner&quot;</span>,</p>
                    <p className="code-line">&nbsp;&nbsp;<span className="str">org</span>: <span className="val">&quot;YBM AI Lab&quot;</span>,</p>
                    <p className="code-line">&nbsp;&nbsp;<span className="str">domain</span>: <span className="val">&quot;Edutech&quot;</span>,</p>
                    <p className="code-line">&nbsp;&nbsp;<span className="fn">focus</span>: () <span className="kw">=&gt;</span> <span className="val">&quot;learning UX&quot;</span></p>
                    <p className="code-line">{'}'}</p>
                  </div>
                  <div className="hero-stats">
                    <div className="stat"><p className="stat-num">3+</p><p className="stat-label">PROJECTS</p></div>
                    <div className="stat"><p className="stat-num">AI</p><p className="stat-label">EDU TECH</p></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══ ABOUT ══ */}
          {activeTab === 'about' && (
            <div className="tab-section">
              <div className="section-header fade-up">
                <p className="section-tag">About</p>
                <h2 className="section-title">사람이 더 잘 배울 수 있는<br />경험을 설계합니다.</h2>
              </div>
              <div className="about-grid fade-up" style={{ transitionDelay: '.1s' }}>
                <div>
                  <p className="about-intro">YBM <strong>AI Lab</strong>에서 에듀테크 콘텐츠 기획자로 일하고 있습니다. 학습 경험을 설계하고, AI 기술이 교육에 자연스럽게 스며들 수 있는 서비스와 콘텐츠를 만들어갑니다.</p>
                  <p className="about-detail">게임화, AI 피드백, 맞춤형 학습 경로까지—다양한 형태의 에듀테크 콘텐츠를 기획하며 &apos;어떻게 하면 더 잘 배울 수 있을까&apos;를 항상 고민합니다. 데이터와 사용자 맥락을 함께 보며 제품을 개선하는 일을 좋아합니다.</p>
                  <div className="tag-row">
                    {['에듀테크', 'AI 기획', '학습 경험 설계', '콘텐츠 기획'].map((t) => <span key={t} className="info-tag">{t}</span>)}
                  </div>
                </div>
                <div className="about-sidebar">
                  {[{ label: 'ORGANIZATION', value: 'YBM · AI Lab' }, { label: 'LOCATION', value: '서울, 대한민국' }, { label: 'DOMAIN', value: 'Edutech · AI Content Planning' }].map(({ label, value }) => (
                    <div key={label} className="sidebar-block">
                      <p className="sidebar-label">{label}</p><p className="sidebar-value">{value}</p>
                    </div>
                  ))}
                  <div className="sidebar-divider" />
                  <p className="sidebar-label" style={{ marginBottom: '.75rem' }}>LINKS</p>
                  <div className="social-links">
                    {['LinkedIn', 'Notion', 'GitHub'].map((s) => <a key={s} href="#" className="social-link">{s}</a>)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══ SKILLS ══ */}
          {activeTab === 'skills' && (
            <div className="tab-section">
              <div className="section-header fade-up">
                <p className="section-tag">Skills</p>
                <h2 className="section-title">역량 &amp; 툴</h2>
              </div>
              <div className="skills-grid fade-up" style={{ transitionDelay: '.1s' }}>
                <div className="skill-col">
                  <p className="skill-col-label">PLANNING · STRATEGY</p>
                  <ul className="skill-list">
                    {['서비스 기획', '콘텐츠 기획', '사용자 리서치', '학습 경험 설계 (LXD)', '기획서 작성', 'Product Roadmap'].map((s) => <li key={s}>{s}</li>)}
                  </ul>
                </div>
                <div className="skill-col">
                  <p className="skill-col-label">AI · EDUTECH</p>
                  <ul className="skill-list">
                    {['AI 프롬프트 기획', 'LLM 활용 기획', 'AI Writing 설계', '에듀테크 도메인', '데이터 기반 의사결정', '게임화 (Gamification)'].map((s) => <li key={s}>{s}</li>)}
                  </ul>
                </div>
                <div className="skill-col">
                  <p className="skill-col-label">TOOLS · COLLABORATION</p>
                  <ul className="skill-list">
                    {['Notion', 'Figma', 'Jira / Confluence', 'Slack', 'Google Workspace', 'Claude / ChatGPT'].map((s) => <li key={s}>{s}</li>)}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* ══ PROJECTS ══ */}
          {activeTab === 'projects' && (
            <div className="tab-section">
              <div className="section-header fade-up">
                <p className="section-tag">Projects</p>
                <h2 className="section-title">대표 프로젝트</h2>
              </div>
              <div className="projects-list fade-up" style={{ transitionDelay: '.1s' }}>
                {[
                  { num: '01', title: '클래스 게임', desc: 'Y클라우드 에듀테크 플랫폼 내 영어 학습 클래스 게임 기획. 게임 메커니즘을 통한 학습 참여율 및 재방문율 향상.', tags: ['Gamification', '에듀테크', 'UX 기획'] },
                  { num: '02', title: '매쓰큐', desc: 'AI 기반 수학 학습 콘텐츠 기획. 맞춤형 문제 추천 시스템과 학습 경로 설계로 개인화 학습 경험 구현.', tags: ['수학 에듀테크', 'AI 추천', '개인화 학습'] },
                  { num: '03', title: 'AI Writing', desc: 'LLM 기반 영어 글쓰기 학습 콘텐츠 기획. 즉각적인 AI 피드백 시스템과 단계별 라이팅 커리큘럼 설계.', tags: ['AI Writing', 'LLM 기획', '커리큘럼 설계'] },
                ].map(({ num, title, desc, tags }) => (
                  <div key={num} className="project-row">
                    <p className="proj-num">{num}</p>
                    <div className="proj-body">
                      <h3 className="proj-title">{title}</h3>
                      <p className="proj-desc">{desc}</p>
                      <div className="proj-tags">{tags.map((t) => <span key={t} className="proj-tag">{t}</span>)}</div>
                    </div>
                    <span className="proj-arrow">→</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ══ COVER LETTER ══ */}
          {activeTab === 'cover' && (
            <div className="tab-section">
              <div className="section-header fade-up">
                <p className="section-tag">Cover Letter</p>
                <h2 className="section-title">맞춤형 커버레터를<br />바로 생성해보세요.</h2>
              </div>
              <div className="cover-layout">
                <div className="fade-up" style={{ transitionDelay: '.1s' }}>
                  <p style={{ fontSize: '0.88rem', color: 'var(--muted)', lineHeight: '1.8', marginBottom: '1.75rem' }}>
                    채용담당자이신가요? 회사와 포지션을 입력하시면 김이현의 경력과 프로젝트를 바탕으로 맞춤형 커버레터를 실시간으로 생성합니다.
                  </p>
                  <div className="cover-form">
                    <div>
                      <p className="cover-field-label">COMPANY NAME</p>
                      <input className="cover-input" placeholder="예: 카카오, 토스, 라인..." value={coverCompany} onChange={(e) => setCoverCompany(e.target.value)} />
                    </div>
                    <div>
                      <p className="cover-field-label">POSITION</p>
                      <input className="cover-input" placeholder="예: 서비스 기획자, PM, 콘텐츠 기획..." value={coverPosition} onChange={(e) => setCoverPosition(e.target.value)} />
                    </div>
                    <div>
                      <p className="cover-field-label">TONE</p>
                      <select className="cover-select" value={coverTone} onChange={(e) => setCoverTone(e.target.value)}>
                        <option value="professional">전문적이고 격식체</option>
                        <option value="friendly">친근하고 활기차게</option>
                        <option value="concise">간결하고 임팩트 있게</option>
                      </select>
                    </div>
                    <button className="cover-btn" onClick={generateCoverLetter} disabled={coverStatus === 'streaming'}>
                      {coverStatus === 'streaming' ? '생성 중...' : coverStatus === 'done' ? '다시 생성하기 →' : '커버레터 생성하기 →'}
                    </button>
                  </div>
                </div>
                <div className="fade-up" style={{ transitionDelay: '.15s' }}>
                  <div className="cover-output-wrap">
                    <div className="cover-output-header">
                      <span className="cover-output-label">{coverLabel}</span>
                      <button className="cover-copy-btn" onClick={copyCoverLetter} style={coverCopied ? { color: 'var(--blue)', borderColor: 'var(--blue)' } : {}}>
                        {coverCopied ? '복사됨 ✓' : '복사'}
                      </button>
                    </div>
                    <div className="cover-output-body">
                      {coverStatus === 'idle' && <div className="cover-placeholder"><span>회사명과 포지션을 입력하고<br />생성 버튼을 눌러주세요</span></div>}
                      {(coverStatus === 'streaming' || coverStatus === 'done') && <>{coverText}{coverStatus === 'streaming' && <span className="blink-cur" />}</>}
                      {coverStatus === 'error' && <p style={{ color: 'var(--muted)', fontSize: '0.83rem' }}>일시적 오류가 발생했습니다. 잠시 후 다시 시도해주세요.</p>}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══ ASK AI ══ */}
          {activeTab === 'ai' && (
            <div className="tab-section tab-ai">
              <div className="ai-bg-glow" /><div className="ai-bg-glow2" />
              <div className="ai-layout">
                <div>
                  <div className="section-header fade-up">
                    <p className="section-tag">Ask AI</p>
                    <h2 className="section-title">이현에 대해<br />무엇이든<br />물어보세요.</h2>
                  </div>
                  <p className="ai-desc fade-up" style={{ transitionDelay: '.1s' }}>저에 대해 학습한 AI 어시스턴트가 답변합니다. 경력, 프로젝트, 업무 방식, 협업 스타일 등 궁금한 것을 자유롭게 질문해보세요.</p>
                  <ul className="ai-features fade-up" style={{ transitionDelay: '.15s' }}>
                    {['프로젝트 및 경력 상세 안내', '업무 방식 & 협업 스타일', '에듀테크·AI 도메인 관점 공유', '실시간 Claude AI 기반 응답'].map((f) => <li key={f}>{f}</li>)}
                  </ul>
                </div>
                <div className="fade-up" style={{ transitionDelay: '.2s' }}>
                  <div className="chat-box">
                    <div className="chat-topbar"><div className="ai-dot" /><span className="chat-topbar-label">이현.ai — online</span></div>
                    <div className="chat-messages" ref={chatContainerRef}>
                      <div className="msg"><div className="msg-avatar ai">AI</div><div className="msg-bubble">안녕하세요! 김이현의 포트폴리오 AI입니다. YBM AI Lab에서의 경험이나 프로젝트에 대해 궁금한 점이 있으시면 편하게 물어보세요.</div></div>
                      {chatMessages.map((msg, i) => (
                        <div key={i} className={`msg${msg.role === 'user' ? ' user' : ''}`}>
                          <div className={`msg-avatar ${msg.role === 'assistant' ? 'ai' : 'user'}`}>{msg.role === 'assistant' ? 'AI' : 'ME'}</div>
                          <div className="msg-bubble">{msg.content}</div>
                        </div>
                      ))}
                      {isAiTyping && <div className="msg"><div className="msg-avatar ai">AI</div><div className="msg-bubble"><div className="typing-dots"><span /><span /><span /></div></div></div>}
                    </div>
                    <div className="chat-input-row">
                      <input className="chat-input" placeholder="질문을 입력하세요..." value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) sendMessage(chatInput); }} disabled={isAiTyping} />
                      <button className="chat-send-btn" onClick={() => sendMessage(chatInput)} disabled={isAiTyping}>→</button>
                    </div>
                  </div>
                  <div className="quick-questions">
                    {QUICK_QUESTIONS.map(({ label, message }) => (
                      <button key={label} className="quick-q" onClick={() => sendMessage(message)} disabled={isAiTyping}>{label}</button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══ CONTACT ══ */}
          {activeTab === 'contact' && (
            <div className="tab-section">
              <div className="contact-grid">
                <div className="fade-up">
                  <h2 className="contact-big">함께<br />만들어요<span>.</span></h2>
                  <button className="email-btn" onClick={copyEmail}>
                    hello@yhkim.me
                    <span className={`copy-badge${emailCopied ? ' show' : ''}`}>복사됨</span>
                  </button>
                  <div className="contact-socials">
                    {['LinkedIn', 'Notion', 'GitHub'].map((s) => <a key={s} href="#" className="contact-social">{s}</a>)}
                  </div>
                </div>
                <div className="contact-right fade-up" style={{ transitionDelay: '.1s' }}>
                  {[{ label: 'ORGANIZATION', value: 'YBM · AI Lab' }, { label: 'DOMAIN', value: 'Edutech · AI Content Planning' }, { label: 'OPEN TO', value: '협업 제안 · 네트워킹 · 커피챗' }].map(({ label, value }) => (
                    <div key={label} className="contact-info-block"><p className="ci-label">{label}</p><p className="ci-value">{value}</p></div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>{/* end tab-panel */}
      </main>

      {/* ─── Footer ─── */}
      <footer className="tab-footer">
        <p className="footer-l">© 2025 김이현</p>
        <p className="footer-r">YBM · AI Lab</p>
      </footer>

    </div>
  );
}
