'use client';

import { usePathname, useRouter } from 'next/navigation';

const NAV_ITEMS = [
  {
    label: 'Billy',
    href: '/billy',
    icon: (active: boolean) => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? '#FFFFFF' : '#9CA3AF'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
    ),
  },
];

export default function Navbar() {
  const router   = useRouter();
  const pathname = usePathname();

  return (
    <div style={{
      width: 64,
      minHeight: '100vh',
      background: '#111827',
      borderRight: '1px solid #1F2937',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      position: 'fixed',
      top: 0,
      left: 0,
      zIndex: 50,
      flexShrink: 0,
    }}>

      {/* Logo avatar */}
      <div
        onClick={() => router.push('/search')}
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: '#00D4AA',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          margin: '16px 0',
          fontWeight: 900,
          fontSize: 13,
          color: '#000000',
          fontFamily: 'Arial Black, sans-serif',
          flexShrink: 0,
        }}
      >
        FS
      </div>

      {/* Divider */}
      <div style={{ width: 32, height: 1, background: '#1F2937', marginBottom: 8 }} />

      {/* Nav items */}
      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '8px 0', width: '100%' }}>
        {NAV_ITEMS.map(({ label, href, icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/');
          return (
            <div
              key={href}
              onClick={() => router.push(href)}
              title={label}
              style={{
                width: 42,
                height: 42,
                borderRadius: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                background: isActive ? '#374151' : 'transparent',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#1F2937'; }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
            >
              {icon(isActive)}
            </div>
          );
        })}
      </nav>

      {/* Avatar usuario abajo */}
      <div style={{ marginBottom: 16 }}>
        <div
          title="Coach Rivera"
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: '#E6FBF7',
            border: '2px solid #00D4AA',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            fontWeight: 700,
            color: '#00A88A',
            cursor: 'pointer',
          }}
        >
          CR
        </div>
      </div>

      {/* Settings */}
      <div style={{ marginBottom: 16 }}>
        <div
          title="Settings"
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = '#1F2937')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
          </svg>
        </div>
      </div>

    </div>
  );
}