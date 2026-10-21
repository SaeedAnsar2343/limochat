import React from 'react';

export interface LimoEmojiDef {
  id: string;
  name: string;
  tag: string;
  subtitle: string;
  badge: string;
  glow: string;
  border: string;
  textColor: string;
}

export const LIMO_CRAFT_EMOJIS: LimoEmojiDef[] = [
  {
    id: 'limo_citrus',
    name: 'Limo Lime',
    tag: '::limo_citrus::',
    subtitle: 'Official Mascot',
    badge: 'Mascot',
    glow: 'from-emerald-500/30 to-lime-500/30',
    border: 'border-emerald-500/40',
    textColor: 'text-emerald-400'
  },
  {
    id: 'limo_vip_ride',
    name: 'VIP Limousine',
    tag: '::limo_vip_ride::',
    subtitle: 'Cyber Luxury Sedan',
    badge: 'VIP Ride',
    glow: 'from-amber-500/30 to-yellow-500/30',
    border: 'border-amber-500/40',
    textColor: 'text-amber-400'
  },
  {
    id: 'limo_shield_vault',
    name: 'Quantum Vault',
    tag: '::limo_shield_vault::',
    subtitle: 'End-to-End Vault',
    badge: 'Security',
    glow: 'from-cyan-500/30 to-blue-500/30',
    border: 'border-cyan-500/40',
    textColor: 'text-cyan-400'
  },
  {
    id: 'limo_crown_royal',
    name: 'Imperial Crown',
    tag: '::limo_crown_royal::',
    subtitle: 'Elite VIP Crown',
    badge: 'Royal',
    glow: 'from-amber-500/30 to-orange-500/30',
    border: 'border-amber-400/50',
    textColor: 'text-amber-300'
  },
  {
    id: 'limo_diamond_gem',
    name: 'Cyber Diamond',
    tag: '::limo_diamond_gem::',
    subtitle: 'Brilliant Cut Crystal',
    badge: 'Diamond',
    glow: 'from-sky-500/30 to-indigo-500/30',
    border: 'border-sky-400/40',
    textColor: 'text-sky-300'
  },
  {
    id: 'limo_rocket_hyper',
    name: 'Hyper Rocket',
    tag: '::limo_rocket_hyper::',
    subtitle: 'Galactic Hyperdrive',
    badge: 'Boosted',
    glow: 'from-purple-500/30 to-pink-500/30',
    border: 'border-purple-400/40',
    textColor: 'text-purple-300'
  },
  {
    id: 'limo_chat_bubble',
    name: 'Neon Soundwave',
    tag: '::limo_chat_bubble::',
    subtitle: 'Crystal Audio Wave',
    badge: 'Audio',
    glow: 'from-teal-500/30 to-emerald-500/30',
    border: 'border-teal-400/40',
    textColor: 'text-teal-300'
  },
  {
    id: 'limo_superstar',
    name: 'Supernova Star',
    tag: '::limo_superstar::',
    subtitle: '8-Point VIP Star',
    badge: 'Star',
    glow: 'from-yellow-500/30 to-amber-500/30',
    border: 'border-yellow-400/40',
    textColor: 'text-yellow-300'
  },
  {
    id: 'limo_martini_chill',
    name: 'Lounge Cocktail',
    tag: '::limo_martini_chill::',
    subtitle: 'VIP Chill Martini',
    badge: 'Chill',
    glow: 'from-blue-500/30 to-violet-500/30',
    border: 'border-blue-400/40',
    textColor: 'text-blue-300'
  },
  {
    id: 'limo_fire_hype',
    name: 'Neon Hype Flame',
    tag: '::limo_fire_hype::',
    subtitle: 'Dual-Core Fire',
    badge: 'Hype',
    glow: 'from-red-500/30 to-orange-500/30',
    border: 'border-red-400/40',
    textColor: 'text-red-400'
  },
  {
    id: 'limo_agent_secret',
    name: 'Secret VIP Agent',
    tag: '::limo_agent_secret::',
    subtitle: 'Stealth Shield',
    badge: 'Agent',
    glow: 'from-slate-500/30 to-zinc-500/30',
    border: 'border-slate-400/40',
    textColor: 'text-slate-300'
  },
  {
    id: 'limo_champagne_pop',
    name: 'Celebration Toast',
    tag: '::limo_champagne_pop::',
    subtitle: 'Popping Gold Cork',
    badge: 'Toast',
    glow: 'from-pink-500/30 to-rose-500/30',
    border: 'border-pink-400/40',
    textColor: 'text-pink-300'
  },
  {
    id: 'limo_hover_ship',
    name: 'Cyber Hover-Limo',
    tag: '::limo_hover_ship::',
    subtitle: 'Anti-Gravity Cruiser',
    badge: 'Future',
    glow: 'from-indigo-500/30 to-cyan-500/30',
    border: 'border-indigo-400/40',
    textColor: 'text-indigo-300'
  },
  {
    id: 'limo_golden_trophy',
    name: 'Champions Trophy',
    tag: '::limo_golden_trophy::',
    subtitle: 'Hall of Excellence',
    badge: 'Champion',
    glow: 'from-amber-500/30 to-yellow-500/30',
    border: 'border-amber-400/40',
    textColor: 'text-amber-300'
  },
  {
    id: 'limo_quantum_key',
    name: 'Hardware Token',
    tag: '::limo_quantum_key::',
    subtitle: 'Circuit Master Key',
    badge: 'Private',
    glow: 'from-emerald-500/30 to-teal-500/30',
    border: 'border-emerald-400/40',
    textColor: 'text-emerald-300'
  },
  {
    id: 'limo_neon_heart',
    name: 'Neon Limo Heart',
    tag: '::limo_neon_heart::',
    subtitle: 'Emerald Love Pulse',
    badge: 'Love',
    glow: 'from-rose-500/30 to-emerald-500/30',
    border: 'border-rose-400/40',
    textColor: 'text-rose-300'
  }
];

interface LimoCraftEmojiProps {
  id: string;
  size?: number;
  className?: string;
  animated?: boolean;
}

export const LimoCraftEmoji: React.FC<LimoCraftEmojiProps> = ({
  id,
  size = 48,
  className = '',
  animated = true,
}) => {
  const animClass = animated ? 'transition-transform duration-200' : '';

  switch (id) {
    // 🍋 1. LIMO CITRUS (Official Mascot with Cool Shades)
    case 'limo_citrus':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`${animClass} ${animated ? 'animate-emoji-pop' : ''} ${className}`}
        >
          <defs>
            <radialGradient id="limeGrad" cx="36%" cy="32%" r="68%">
              <stop offset="0%" stopColor="#76f747" />
              <stop offset="60%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#047857" />
            </radialGradient>
            <linearGradient id="shadesGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#18181b" />
              <stop offset="50%" stopColor="#09090b" />
              <stop offset="100%" stopColor="#27272a" />
            </linearGradient>
            <linearGradient id="glint" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#818cf8" stopOpacity="0.1" />
            </linearGradient>
          </defs>
          {/* Stem & Leaf */}
          <path d="M32 10 C32 4, 38 4, 42 6 C40 10, 36 11, 32 11" fill="#15803d" />
          <path d="M32 11 C30 8, 25 8, 22 11 C26 13, 29 13, 32 11" fill="#22c55e" />
          {/* Lime Body */}
          <ellipse cx="32" cy="36" rx="24" ry="22" fill="url(#limeGrad)" stroke="#047857" strokeWidth="1.5" />
          <ellipse cx="28" cy="24" rx="14" ry="7" fill="#86efac" opacity="0.3" />
          {/* Sunglasses frame */}
          <rect x="14" y="27" width="16" height="11" rx="4" fill="url(#shadesGrad)" stroke="#09090b" strokeWidth="1.2" />
          <rect x="34" y="27" width="16" height="11" rx="4" fill="url(#shadesGrad)" stroke="#09090b" strokeWidth="1.2" />
          <path d="M30 31 L34 31" stroke="#09090b" strokeWidth="2" strokeLinecap="round" />
          {/* Sunglasses glint */}
          <path d="M16 29 L22 29 L18 36 L16 36 Z" fill="url(#glint)" />
          <path d="M36 29 L42 29 L38 36 L36 36 Z" fill="url(#glint)" />
          {/* Cool Smirk Smile */}
          <path d="M26 46 Q34 52 40 46" stroke="#064e3b" strokeWidth="2" strokeLinecap="round" fill="none" />
          {/* Rosy Cheeks */}
          <circle cx="18" cy="42" r="3" fill="#bef264" opacity="0.5" />
          <circle cx="46" cy="42" r="3" fill="#bef264" opacity="0.5" />
        </svg>
      );

    // 🚗 2. VIP LIMOUSINE (Futuristic stretch sedan with neon underglow)
    case 'limo_vip_ride':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`${animClass} ${animated ? 'animate-emoji-pop' : ''} ${className}`}
        >
          <defs>
            <linearGradient id="limoBody" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#1e293b" />
              <stop offset="50%" stopColor="#0f172a" />
              <stop offset="100%" stopColor="#334155" />
            </linearGradient>
            <linearGradient id="neonGlow" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#00a884" />
              <stop offset="50%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#06b6d4" />
            </linearGradient>
          </defs>
          {/* Neon Underglow */}
          <ellipse cx="32" cy="46" rx="26" ry="3" fill="url(#neonGlow)" opacity="0.7" filter="blur(1px)" />
          {/* Limo Body Stretch */}
          <path
            d="M6 38 L14 26 L48 26 L56 34 L58 41 L6 41 Z"
            fill="url(#limoBody)"
            stroke="#475569"
            strokeWidth="1.2"
          />
          {/* Chrome Trim Strip */}
          <path d="M6 37 L58 37" stroke="#94a3b8" strokeWidth="1" />
          {/* Windows (VIP Tint) */}
          <rect x="16" y="28" width="8" height="7" rx="1.5" fill="#0284c7" opacity="0.4" />
          <rect x="26" y="28" width="9" height="7" rx="1.5" fill="#0284c7" opacity="0.4" />
          <rect x="37" y="28" width="9" height="7" rx="1.5" fill="#0284c7" opacity="0.4" />
          {/* Wheels */}
          <circle cx="16" cy="42" r="5" fill="#09090b" stroke="#00a884" strokeWidth="1.5" />
          <circle cx="16" cy="42" r="2" fill="#e2e8f0" />
          <circle cx="48" cy="42" r="5" fill="#09090b" stroke="#00a884" strokeWidth="1.5" />
          <circle cx="48" cy="42" r="2" fill="#e2e8f0" />
          {/* Headlights & Taillights */}
          <rect x="56" y="36" width="2" height="3" rx="1" fill="#38bdf8" />
          <rect x="6" y="36" width="2" height="3" rx="1" fill="#ef4444" />
        </svg>
      );

    // 🛡️ 3. QUANTUM VAULT (Cyber Security Shield)
    case 'limo_shield_vault':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`${animClass} ${animated ? 'animate-emoji-pop' : ''} ${className}`}
        >
          <defs>
            <linearGradient id="shieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#059669" />
              <stop offset="50%" stopColor="#047857" />
              <stop offset="100%" stopColor="#0f172a" />
            </linearGradient>
          </defs>
          {/* Shield Outline */}
          <path
            d="M32 8 L50 14 C50 34, 38 48, 32 54 C26 48, 14 34, 14 14 Z"
            fill="url(#shieldGrad)"
            stroke="#34d399"
            strokeWidth="2"
          />
          {/* Inner Circuit */}
          <path d="M32 16 L44 20 C44 32, 36 42, 32 46 C28 42, 20 32, 20 20 Z" fill="#064e3b" opacity="0.6" />
          {/* Central Padlock */}
          <rect x="27" y="28" width="10" height="9" rx="2" fill="#facc15" stroke="#ca8a04" strokeWidth="1" />
          <path d="M29 28 V24 A3 3 0 0 1 35 24 V28" stroke="#facc15" strokeWidth="2" fill="none" />
          <circle cx="32" cy="32" r="1.5" fill="#713f12" />
        </svg>
      );

    // 👑 4. IMPERIAL CROWN (Royal VIP Crown with Diamonds)
    case 'limo_crown_royal':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`${animClass} ${animated ? 'animate-emoji-float' : ''} ${className}`}
        >
          <defs>
            <linearGradient id="crownGold" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fef08a" />
              <stop offset="50%" stopColor="#eab308" />
              <stop offset="100%" stopColor="#ca8a04" />
            </linearGradient>
          </defs>
          {/* Crown Base and Peaks */}
          <path
            d="M10 44 L14 22 L23 32 L32 16 L41 32 L50 22 L54 44 Z"
            fill="url(#crownGold)"
            stroke="#a16207"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <rect x="10" y="44" width="44" height="6" rx="2" fill="#ca8a04" stroke="#a16207" strokeWidth="1" />
          {/* Jewels */}
          <circle cx="32" cy="16" r="3" fill="#38bdf8" stroke="#0284c7" strokeWidth="0.8" />
          <circle cx="14" cy="22" r="2.5" fill="#10b981" stroke="#047857" strokeWidth="0.8" />
          <circle cx="50" cy="22" r="2.5" fill="#10b981" stroke="#047857" strokeWidth="0.8" />
          <circle cx="21" cy="47" r="1.5" fill="#ef4444" />
          <circle cx="32" cy="47" r="2" fill="#38bdf8" />
          <circle cx="43" cy="47" r="1.5" fill="#10b981" />
        </svg>
      );

    // 💎 5. CYBER DIAMOND (Faceted Sparkling Gem)
    case 'limo_diamond_gem':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`${animClass} ${animated ? 'animate-emoji-heartbeat' : ''} ${className}`}
        >
          <defs>
            <linearGradient id="diaTop" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#e0f2fe" />
              <stop offset="100%" stopColor="#38bdf8" />
            </linearGradient>
            <linearGradient id="diaBot" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#0284c7" />
              <stop offset="100%" stopColor="#0c4a6e" />
            </linearGradient>
          </defs>
          {/* Top Crown Facets */}
          <polygon points="20,16 44,16 54,28 10,28" fill="url(#diaTop)" stroke="#38bdf8" strokeWidth="1" />
          <polygon points="20,16 32,28 10,28" fill="#bae6fd" opacity="0.6" />
          <polygon points="44,16 32,28 54,28" fill="#7dd3fc" opacity="0.6" />
          {/* Bottom Pavilion Facets */}
          <polygon points="10,28 54,28 32,52" fill="url(#diaBot)" stroke="#0284c7" strokeWidth="1" />
          <polygon points="10,28 32,28 32,52" fill="#0369a1" opacity="0.8" />
          <polygon points="54,28 32,28 32,52" fill="#0284c7" opacity="0.8" />
          {/* Sparkle Glint */}
          <path d="M46 12 L48 16 L52 18 L48 20 L46 24 L44 20 L40 18 L44 16 Z" fill="#ffffff" />
        </svg>
      );

    // 🚀 6. HYPERDRIVE ROCKET
    case 'limo_rocket_hyper':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`${animClass} ${animated ? 'animate-emoji-float' : ''} ${className}`}
        >
          <defs>
            <linearGradient id="rocketBody" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#f8fafc" />
              <stop offset="50%" stopColor="#cbd5e1" />
              <stop offset="100%" stopColor="#64748b" />
            </linearGradient>
            <linearGradient id="thrusterFlame" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#facc15" />
              <stop offset="50%" stopColor="#f97316" />
              <stop offset="100%" stopColor="#dc2626" />
            </linearGradient>
          </defs>
          {/* Rocket Flames */}
          <path d="M22 42 Q14 54 18 58 Q24 50 28 46 Z" fill="url(#thrusterFlame)" />
          {/* Fins */}
          <path d="M18 36 L12 44 L20 42 Z" fill="#ef4444" />
          <path d="M38 22 L44 30 L36 34 Z" fill="#ef4444" />
          {/* Main Hull */}
          <path d="M48 16 C38 18 24 28 22 42 L34 40 C42 30 46 22 48 16 Z" fill="url(#rocketBody)" stroke="#475569" strokeWidth="1.2" />
          {/* Nose Cone */}
          <path d="M48 16 C46 18 42 20 40 22 L46 28 C48 26 49 22 48 16 Z" fill="#ef4444" />
          {/* Port Window */}
          <circle cx="34" cy="28" r="4" fill="#38bdf8" stroke="#0284c7" strokeWidth="1" />
          <circle cx="33" cy="27" r="1.5" fill="#ffffff" />
        </svg>
      );

    // 💬 7. NEON SOUNDWAVE (Crystal Speech Bubble)
    case 'limo_chat_bubble':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`${animClass} ${animated ? 'animate-emoji-pop' : ''} ${className}`}
        >
          <defs>
            <linearGradient id="bubbleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#0d9488" />
            </linearGradient>
          </defs>
          <path
            d="M12 18 C12 12, 18 8, 32 8 C46 8, 52 12, 52 18 C52 28, 44 38, 34 38 L22 48 L22 38 C14 38, 12 30, 12 18 Z"
            fill="url(#bubbleGrad)"
            stroke="#34d399"
            strokeWidth="1.5"
          />
          {/* Equalizer Waveform Bars */}
          <rect x="22" y="20" width="3" height="8" rx="1.5" fill="#ffffff" />
          <rect x="28" y="16" width="3" height="15" rx="1.5" fill="#ffffff" />
          <rect x="34" y="14" width="3" height="19" rx="1.5" fill="#ffffff" />
          <rect x="40" y="19" width="3" height="10" rx="1.5" fill="#ffffff" />
        </svg>
      );

    // 🌟 8. SUPERNOVA STAR (8-Point Golden Star)
    case 'limo_superstar':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`${animClass} ${animated ? 'animate-emoji-spin-slow' : ''} ${className}`}
        >
          <defs>
            <linearGradient id="starGold" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fef08a" />
              <stop offset="50%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#d97706" />
            </linearGradient>
          </defs>
          <path
            d="M32 6 L36 24 L54 28 L38 36 L44 54 L32 42 L20 54 L26 36 L10 28 L28 24 Z"
            fill="url(#starGold)"
            stroke="#b45309"
            strokeWidth="1.2"
          />
          <circle cx="32" cy="32" r="5" fill="#fef9c3" />
        </svg>
      );

    // 🍸 9. VIP LOUNGE COCKTAIL
    case 'limo_martini_chill':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`${animClass} ${animated ? 'animate-emoji-wiggle' : ''} ${className}`}
        >
          {/* Glass Bowl */}
          <polygon points="12,18 52,18 32,38" fill="#38bdf8" opacity="0.25" stroke="#bae6fd" strokeWidth="1.5" />
          {/* Cocktail Liquid */}
          <polygon points="18,24 46,24 32,38" fill="#10b981" opacity="0.8" />
          {/* Stem & Base */}
          <line x1="32" y1="38" x2="32" y2="52" stroke="#bae6fd" strokeWidth="2" />
          <ellipse cx="32" cy="52" rx="12" ry="2.5" fill="#bae6fd" opacity="0.7" />
          {/* Lime Wheel Garnish */}
          <circle cx="48" cy="18" r="6" fill="#84cc16" stroke="#4d7c0f" strokeWidth="1" />
          <circle cx="48" cy="18" r="3" fill="#a3e635" />
        </svg>
      );

    // 🔥 10. NEON HYPE FLAME
    case 'limo_fire_hype':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`${animClass} ${animated ? 'animate-emoji-wiggle' : ''} ${className}`}
        >
          <defs>
            <linearGradient id="outerFlame" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#f43f5e" />
              <stop offset="50%" stopColor="#ea580c" />
              <stop offset="100%" stopColor="#c026d3" />
            </linearGradient>
            <linearGradient id="innerFlame" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fef08a" />
              <stop offset="100%" stopColor="#10b981" />
            </linearGradient>
          </defs>
          <path
            d="M32 8 C36 18, 50 24, 48 38 C46 50, 38 56, 32 56 C24 56, 14 48, 16 36 C18 26, 26 20, 32 8 Z"
            fill="url(#outerFlame)"
          />
          <path
            d="M32 24 C34 30, 42 34, 40 42 C38 48, 34 50, 32 50 C28 50, 24 46, 25 40 C26 34, 30 30, 32 24 Z"
            fill="url(#innerFlame)"
          />
        </svg>
      );

    // 🕶️ 11. SECRET VIP AGENT
    case 'limo_agent_secret':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`${animClass} ${animated ? 'animate-emoji-float' : ''} ${className}`}
        >
          {/* Fedora Hat */}
          <ellipse cx="32" cy="22" rx="20" ry="4" fill="#0f172a" stroke="#334155" strokeWidth="1" />
          <path d="M20 22 C20 12, 24 8, 32 8 C40 8, 44 12, 44 22 Z" fill="#1e293b" />
          <path d="M20 19 L44 19" stroke="#00a884" strokeWidth="1.5" />
          {/* Head & Dark Sunglasses */}
          <circle cx="32" cy="34" r="10" fill="#f8fafc" />
          <rect x="24" y="32" width="7" height="5" rx="1.5" fill="#09090b" />
          <rect x="33" y="32" width="7" height="5" rx="1.5" fill="#09090b" />
          <line x1="31" y1="34" x2="33" y2="34" stroke="#09090b" strokeWidth="1" />
          {/* Coat Collar */}
          <path d="M22 46 L32 40 L42 46 L32 54 Z" fill="#0f172a" />
        </svg>
      );

    // 🍾 12. CELEBRATION TOAST
    case 'limo_champagne_pop':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`${animClass} ${animated ? 'animate-emoji-wiggle' : ''} ${className}`}
        >
          {/* Flying Cork */}
          <rect x="42" y="10" width="6" height="5" rx="1" fill="#ca8a04" transform="rotate(25 42 10)" />
          {/* Sparkles & Foam */}
          <circle cx="38" cy="14" r="2" fill="#fef08a" />
          <circle cx="48" cy="18" r="1.5" fill="#38bdf8" />
          <circle cx="44" cy="22" r="2" fill="#10b981" />
          {/* Bottle */}
          <path
            d="M32 24 L36 28 L30 46 L20 40 L26 22 Z"
            fill="#065f46"
            stroke="#047857"
            strokeWidth="1.2"
          />
          {/* Gold Foil Neck */}
          <polygon points="30,22 34,26 31,29 27,25" fill="#facc15" />
        </svg>
      );

    // 🛸 13. CYBER HOVER-LIMO
    case 'limo_hover_ship':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`${animClass} ${animated ? 'animate-emoji-float' : ''} ${className}`}
        >
          {/* Anti-Grav Glow */}
          <ellipse cx="32" cy="48" rx="20" ry="3" fill="#06b6d4" opacity="0.6" filter="blur(1px)" />
          {/* Flying Saucer / Hover Craft Body */}
          <ellipse cx="32" cy="34" rx="24" ry="7" fill="#1e293b" stroke="#38bdf8" strokeWidth="1.5" />
          <ellipse cx="32" cy="30" rx="12" ry="7" fill="#0284c7" opacity="0.5" stroke="#38bdf8" strokeWidth="1" />
          {/* Lights */}
          <circle cx="16" cy="36" r="1.5" fill="#22c55e" />
          <circle cx="24" cy="38" r="1.5" fill="#38bdf8" />
          <circle cx="32" cy="39" r="1.5" fill="#facc15" />
          <circle cx="40" cy="38" r="1.5" fill="#38bdf8" />
          <circle cx="48" cy="36" r="1.5" fill="#22c55e" />
        </svg>
      );

    // 🏆 14. CHAMPIONS TROPHY
    case 'limo_golden_trophy':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`${animClass} ${animated ? 'animate-emoji-pop' : ''} ${className}`}
        >
          <defs>
            <linearGradient id="trophyGold" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fef08a" />
              <stop offset="50%" stopColor="#eab308" />
              <stop offset="100%" stopColor="#b45309" />
            </linearGradient>
          </defs>
          {/* Handles */}
          <path d="M16 22 C10 22 10 32 18 34" stroke="#ca8a04" strokeWidth="2.5" fill="none" />
          <path d="M48 22 C54 22 54 32 46 34" stroke="#ca8a04" strokeWidth="2.5" fill="none" />
          {/* Cup */}
          <path d="M18 16 H46 V28 C46 38 38 42 32 42 C26 42 18 38 18 28 Z" fill="url(#trophyGold)" stroke="#a16207" strokeWidth="1.2" />
          {/* Stem & Base */}
          <rect x="29" y="42" width="6" height="8" fill="#ca8a04" />
          <rect x="20" y="50" width="24" height="6" rx="2" fill="#1e293b" stroke="#ca8a04" strokeWidth="1" />
          <circle cx="32" cy="26" r="4" fill="#00a884" />
        </svg>
      );

    // 🔒 15. HARDWARE TOKEN (Circuit Master Key)
    case 'limo_quantum_key':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`${animClass} ${animated ? 'animate-emoji-pop' : ''} ${className}`}
        >
          {/* Key Ring */}
          <circle cx="24" cy="28" r="10" fill="none" stroke="#facc15" strokeWidth="3.5" />
          <circle cx="24" cy="28" r="5" fill="#00a884" />
          {/* Key Shaft */}
          <path d="M34 28 L52 28 L52 34 L48 34 L48 30 L44 30 L44 34 L40 34 L40 28" fill="#facc15" stroke="#ca8a04" strokeWidth="1.5" />
        </svg>
      );

    // ❤️ 16. NEON LIMO HEART
    case 'limo_neon_heart':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`${animClass} ${animated ? 'animate-emoji-heartbeat' : ''} ${className}`}
        >
          <defs>
            <linearGradient id="neonHeart" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#f43f5e" />
              <stop offset="50%" stopColor="#fb7185" />
              <stop offset="100%" stopColor="#00a884" />
            </linearGradient>
          </defs>
          <path
            d="M32 52 C24 44 12 34 12 22 A10 10 0 0 1 32 16 A10 10 0 0 1 52 22 C52 34 40 44 32 52 Z"
            fill="url(#neonHeart)"
            stroke="#ffffff"
            strokeWidth="1.5"
            filter="drop-shadow(0 0 6px rgba(244,63,94,0.5))"
          />
        </svg>
      );

    default:
      return null;
  }
};
