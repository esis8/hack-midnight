import React from 'react';

export default function LandingPage({ onOpenApp }: { onOpenApp: () => void }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #181c2a 0%, #23294a 100%)',
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'Inter, Arial, sans-serif',
        padding: '2rem',
      }}
    >
      <div
        style={{
          background: 'rgba(20, 24, 40, 0.95)',
          borderRadius: '1.5rem',
          boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
          padding: '2.5rem 2rem',
          maxWidth: '420px',
          width: '100%',
          textAlign: 'left',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1.5rem' }}>
          <span
            style={{
              background: '#2d3a5a',
              borderRadius: '0.75rem',
              padding: '0.7rem',
              marginRight: '1rem',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {/* Simple voting icon */}
            <svg width="32" height="32" fill="none" viewBox="0 0 32 32">
              <rect x="6" y="12" width="20" height="14" rx="2" fill="#4f6cb3" />
              <rect x="10" y="6" width="12" height="8" rx="2" fill="#8fc1ff" />
              <path d="M16 14v-4" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
              <path d="M13 10l3-3 3 3" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </span>
          <h1 style={{ fontSize: '2rem', fontWeight: 700, margin: 0 }}>Midnight Voting App</h1>
        </div>
        <h2 style={{ color: '#7ee0ff', fontSize: '1.35rem', fontWeight: 600, marginBottom: '0.5rem' }}>
          Vote with Confidence.
          <br />
          Vote with Privacy.
        </h2>
        <p style={{ color: '#bfc8e6', marginBottom: '2rem', fontSize: '1rem' }}>
          Built at the Midnight Hackathon, our dApp empowers communities to make decisions in a way that&#39;s:
        </p>
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1.2rem' }}>
            <span style={{ marginRight: '0.8rem' }}>
              {/* Lock icon */}
              <svg width="28" height="28" fill="none" viewBox="0 0 28 28">
                <rect x="6" y="12" width="16" height="10" rx="2" fill="#4f6cb3" />
                <rect x="9" y="8" width="10" height="6" rx="2" fill="#8fc1ff" />
              </svg>
            </span>
            <div>
              <div style={{ fontWeight: 700 }}>PRIVATE</div>
              <div style={{ color: '#bfc8e6', fontSize: '0.98rem' }}>
                Your vote stays yours, protected by Midnight’s zero-knowledge tech.
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1.2rem' }}>
            <span style={{ marginRight: '0.8rem' }}>
              {/* Lightning icon */}
              <svg width="28" height="28" fill="none" viewBox="0 0 28 28">
                <polygon points="14,4 22,14 16,14 18,24 6,14 12,14" fill="#7ee0ff" />
              </svg>
            </span>
            <div>
              <div style={{ fontWeight: 700 }}>SEAMLESS</div>
              <div style={{ color: '#bfc8e6', fontSize: '0.98rem' }}>
                Cast your vote directly from your wallet, no friction.
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span style={{ marginRight: '0.8rem' }}>
              {/* Globe icon */}
              <svg width="28" height="28" fill="none" viewBox="0 0 28 28">
                <circle cx="14" cy="14" r="12" stroke="#7ee0ff" strokeWidth="2" />
                <ellipse cx="14" cy="14" rx="7" ry="12" stroke="#4f6cb3" strokeWidth="2" />
                <line x1="2" y1="14" x2="26" y2="14" stroke="#4f6cb3" strokeWidth="2" />
              </svg>
            </span>
            <div>
              <div style={{ fontWeight: 700 }}>TRUSTLESS</div>
              <div style={{ color: '#bfc8e6', fontSize: '0.98rem' }}>
                Decentralized, transparent, and community-driven.
              </div>
            </div>
          </div>
        </div>
        <button
          onClick={onOpenApp}
          style={{
            width: '100%',
            padding: '0.9rem 0',
            background: 'linear-gradient(90deg, #7ee0ff 0%, #4f6cb3 100%)',
            color: '#181c2a',
            fontWeight: 700,
            fontSize: '1.1rem',
            border: 'none',
            borderRadius: '0.7rem',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            marginTop: '1rem',
          }}
        >
          Open App
        </button>
      </div>
    </div>
  );
}
