import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, 
  X, 
  Sparkles, 
  Smile, 
  Film, 
  Flame, 
  Heart, 
  Clock, 
  Car, 
  Coffee, 
  Send,
  Zap,
  Check
} from 'lucide-react';
import { LimoCraftEmoji, LIMO_CRAFT_EMOJIS, LimoEmojiDef } from './LimoCraftEmoji';

interface EmojiPickerDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectEmoji: (emoji: string) => void;
  onSelectGif?: (gifUrl: string, caption?: string) => void;
  onSendAnimatedEmoji?: (emoji: string, name: string) => void;
}

// ✨ 2. Animated Micro-Motion Emojis
const ANIMATED_EMOJIS = [
  { emoji: '🍋', name: 'Dancing Limo Lime', animClass: 'animate-emoji-pop', tag: 'limo lime fresh dance' },
  { emoji: '❤️', name: 'Beating Heart', animClass: 'animate-emoji-heartbeat', tag: 'love heart beat romance' },
  { emoji: '🔥', name: 'Dancing Flame', animClass: 'animate-emoji-wiggle', tag: 'fire hot lit hype' },
  { emoji: '🚀', name: 'Blasting Rocket', animClass: 'animate-emoji-float', tag: 'rocket launch fast space' },
  { emoji: '🎉', name: 'Popping Party', animClass: 'animate-emoji-wiggle', tag: 'party celebrate tada celebrate' },
  { emoji: '🌟', name: 'Spinning Star', animClass: 'animate-emoji-spin-slow', tag: 'star spin shine gold' },
  { emoji: '😂', name: 'Laughing Tears', animClass: 'animate-emoji-pop', tag: 'joy lol haha laugh tears' },
  { emoji: '👋', name: 'Waving Hand', animClass: 'animate-emoji-wiggle', tag: 'wave hi hello bye handshake' },
  { emoji: '🥳', name: 'Party Blower', animClass: 'animate-emoji-wiggle', tag: 'party yay celebration' },
  { emoji: '🤯', name: 'Mind Blown', animClass: 'animate-emoji-pop', tag: 'mind blown shock exploded' },
  { emoji: '👻', name: 'Floating Ghost', animClass: 'animate-emoji-float', tag: 'ghost boo spooky halloween' },
  { emoji: '💎', name: 'Pulsing Diamond', animClass: 'animate-emoji-heartbeat', tag: 'diamond gem rich luxury' },
  { emoji: '⚡', name: 'Spark Zap', animClass: 'animate-emoji-pop', tag: 'lightning bolt electricity zap' },
  { emoji: '👑', name: 'Floating Crown', animClass: 'animate-emoji-float', tag: 'crown king queen royal' },
  { emoji: '🍾', name: 'Popping Bottle', animClass: 'animate-emoji-wiggle', tag: 'champagne celebration toast' },
  { emoji: '🕺', name: 'Disco Groover', animClass: 'animate-emoji-wiggle', tag: 'dance music disco groove' },
  { emoji: '🐱', name: 'Wiggly Cat', animClass: 'animate-emoji-wiggle', tag: 'cat kitty pet cute meow' },
  { emoji: '🐶', name: 'Happy Puppy', animClass: 'animate-emoji-wiggle', tag: 'dog puppy cute woof' },
  { emoji: '🌈', name: 'Magic Rainbow', animClass: 'animate-emoji-heartbeat', tag: 'rainbow sky color pride' },
  { emoji: '💯', name: 'Keep It 100', animClass: 'animate-emoji-pop', tag: '100 percent perfect real' },
  { emoji: '✨', name: 'Sparkles Wave', animClass: 'animate-emoji-spin-slow', tag: 'sparkles magic glow clean' },
  { emoji: '🚗', name: 'Bouncing Limo', animClass: 'animate-emoji-pop', tag: 'car limo drive luxury' },
  { emoji: '😍', name: 'Heart Eyes Beat', animClass: 'animate-emoji-heartbeat', tag: 'heart eyes love crush' },
  { emoji: '😎', name: 'Cool Shades', animClass: 'animate-emoji-float', tag: 'cool shades boss swag' }
];

// 🎬 3. Curated High-Speed CDN GIFs
const CURATED_GIFS = [
  // Trending / Reactions
  { id: 'g1', title: 'Iron Man Thumbs Up', category: 'Thumbs Up', url: 'https://media.giphy.com/media/111ebonMs90YLu/giphy.gif', tags: 'thumbs up good job approve yes ok great' },
  { id: 'g2', title: 'DiCaprio Cheers', category: 'Party', url: 'https://media.giphy.com/media/XreQmk7ETCak0/giphy.gif', tags: 'cheers toast wine party celebrate gatsby' },
  { id: 'g3', title: 'Minion Thumbs Up', category: 'Thumbs Up', url: 'https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif', tags: 'thumbs up minion cute smile yes' },
  { id: 'g4', title: 'Steve Carell Thumbs Up', category: 'Thumbs Up', url: 'https://media.giphy.com/media/26gsvAm8UPaczzXz2/giphy.gif', tags: 'thumbs up office funny yeah' },
  // Laugh
  { id: 'g5', title: 'Hysterical Laugh', category: 'Laugh', url: 'https://media.giphy.com/media/GpyS1lJXJYupG/giphy.gif', tags: 'laugh lol haha hilarious funny joke' },
  { id: 'g6', title: 'Minions Laughing', category: 'Laugh', url: 'https://media.giphy.com/media/ZqlvCTNHpqrio/giphy.gif', tags: 'laugh minions funny lol haha' },
  { id: 'g7', title: 'Tom Cruise Laugh', category: 'Laugh', url: 'https://media.giphy.com/media/10JhviFuU2gWD6/giphy.gif', tags: 'laugh haha tom cruise chuckling' },
  { id: 'g8', title: 'Ryan Gosling Giggle', category: 'Laugh', url: 'https://media.giphy.com/media/1d5Zn8FqmJqApu4hnu/giphy.gif', tags: 'laugh giggle smile ryan funny' },
  // Love & Hugs
  { id: 'g9', title: 'Cat Kiss Love', category: 'Love', url: 'https://media.giphy.com/media/MDJ9IbxxvDUQM/giphy.gif', tags: 'love kiss cat cute heart romantic' },
  { id: 'g10', title: 'Warm Bear Hug', category: 'Love', url: 'https://media.giphy.com/media/3oriO6qJiXajN0TyDu/giphy.gif', tags: 'hug love care warmth bear friend' },
  { id: 'g11', title: 'Heart Sparkle', category: 'Love', url: 'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif', tags: 'heart sparkle love romantic shine' },
  { id: 'g12', title: 'Snoopy Heart Dance', category: 'Love', url: 'https://media.giphy.com/media/l4pTdcifPZLpDjL1e/giphy.gif', tags: 'snoopy love heart happy cute' },
  // Party & Celebration
  { id: 'g13', title: 'Great Gatsby Champagne', category: 'Party', url: 'https://media.giphy.com/media/artj92V8o75VPL7AeQ/giphy.gif', tags: 'celebrate toast cheers party wine gatsby' },
  { id: 'g14', title: 'Carlton Dance', category: 'Dance', url: 'https://media.giphy.com/media/DhstvI455Y0sE/giphy.gif', tags: 'dance happy groove moves fresh prince' },
  { id: 'g15', title: 'Kermit Yay', category: 'Party', url: 'https://media.giphy.com/media/blSTtZehjAZ8I/giphy.gif', tags: 'yay celebrate happy kermit frog' },
  { id: 'g16', title: 'Office Confetti', category: 'Party', url: 'https://media.giphy.com/media/IwAZ6dvvvaNN6/giphy.gif', tags: 'party confetti office celebration woo' },
  // Wow / Shocked
  { id: 'g17', title: 'Galaxy Mind Blown', category: 'Wow', url: 'https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy.gif', tags: 'mind blown wow explosion galaxy shock' },
  { id: 'g18', title: 'Andy Dwyer Shock', category: 'Wow', url: 'https://media.giphy.com/media/5VKbvrjxpVJCM/giphy.gif', tags: 'wow shocked excited amazing surprise' },
  { id: 'g19', title: 'Shocked Cat', category: 'Wow', url: 'https://media.giphy.com/media/oYtVHSxngR3lC/giphy.gif', tags: 'cat shocked eyes wide wow omg' },
  // Fire & Hype
  { id: 'g20', title: 'Elmo Fire Rise', category: 'Fire', url: 'https://media.giphy.com/media/nrXif9YExO9EI/giphy.gif', tags: 'fire flames hype elmo burn chaos' },
  { id: 'g21', title: 'This Is Fine', category: 'Fire', url: 'https://media.giphy.com/media/yoJC2GnSClbPOkV0eA/giphy.gif', tags: 'fire this is fine dog coffee chill' },
  { id: 'g22', title: 'Fiery Excitement', category: 'Fire', url: 'https://media.giphy.com/media/yr7n0u3qzO9nG/giphy.gif', tags: 'fire hype excited lit yes' },
  // Dance
  { id: 'g23', title: 'Baby Groot Dancing', category: 'Dance', url: 'https://media.giphy.com/media/mKMGLhoD8L4yc/giphy.gif', tags: 'groot dance cute music groove marvel' },
  { id: 'g24', title: 'Pikachu Happy Dance', category: 'Dance', url: 'https://media.giphy.com/media/3ohzdIuqJoo8QdKlnW/giphy.gif', tags: 'pikachu dance pokemon happy cute' },
  // Bye / Wave
  { id: 'g25', title: 'Forrest Gump Wave', category: 'Bye', url: 'https://media.giphy.com/media/xT9IgG50Fb7Mi0prBC/giphy.gif', tags: 'wave hi hello bye greeting forrest' },
  { id: 'g26', title: 'Homer Bush Fade', category: 'Bye', url: 'https://media.giphy.com/media/dzaUX7CAG0Ihi/giphy.gif', tags: 'bye disappear bush homer hide quiet' }
];

// Standard Emoji Categorized Packs
const STANDARD_EMOJI_CATEGORIES = [
  {
    id: 'smileys',
    name: 'Smileys & Emotion',
    icon: Smile,
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇',
      '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '😋', '😛', '😜', '🤪', '😝', '🤑',
      '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬',
      '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵',
      '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '🥸', '😎', '🤓', '🧐', '😕', '😟', '🙁',
      '😮', '😯', '😲', '😳', '🥺', '😦', '😧', '😨', '😰', '😥', '😢', '😭', '😱',
      '😖', '😣', '😞', '😓', '😩', '😫', '🥱', '😤', '😡', '😠', '🤬', '😈', '👿',
      '💀', '☠️', '💩', '🤡', '👻', '👽', '👾', '🤖'
    ]
  },
  {
    id: 'people',
    name: 'People & Hands',
    icon: Heart,
    emojis: [
      '👋', '🤚', '🖐️', '✋', '🖖', '🫱', '🫲', '🫳', '🫴', '👌', '🤌', '🤏', '✌️',
      '🤞', '🫰', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '🫵', '👍',
      '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '🫶', '👐', '🤲', '🤝', '🙏', '✍️',
      '💅', '🤳', '💪', '🦾', '🦿', '🦵', '🦶', '👂', '🦻', '👃', '🧠', '🫀', '🫁',
      '🦷', '🦴', '👀', '👁️', '👅', '👄'
    ]
  },
  {
    id: 'hearts',
    name: 'Hearts & Vibes',
    icon: Flame,
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞',
      '💓', '💗', '💖', '💘', '💝', '💟', '💌', '💋', '🫂', '💯', '✨', '💥', '💫',
      '💤', '💢', '💣', '💐', '🌸', '💮', '🪷', '🌹', '🌺', '🌻', '🌼', '🌷'
    ]
  },
  {
    id: 'animals',
    name: 'Animals & Nature',
    icon: Coffee,
    emojis: [
      '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐻‍❄️', '🐨', '🐯', '🦁', '🐮',
      '🐷', '🐸', '🐵', '🐒', '🐔', '🐧', '🐦', '🐤', '🦆', '🦅', '🦉', '🦇', '🐺',
      '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐢', '🐍', '🐙', '🦑', '🦐',
      '🦀', '🐡', '🐠', '🐟', '🐬', '🐳', '🦈', '🐊', '🐅', '🐆', '🐘', '🦒', '🦘',
      '🌲', '🌴', '🌵', '🍀', '🍁', '🍂', '🍃'
    ]
  },
  {
    id: 'food',
    name: 'Food & Drinks',
    icon: Coffee,
    emojis: [
      '🍏', '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑',
      '🥭', '🍍', '🥥', '🥝', '🍅', '🥑', '🥦', '🌶️', '🌽', '🥕', '🥔', '🥐', '🍞',
      '🥖', '🥨', '🧀', '🥚', '🍳', '🥞', '🧇', '🥓', '🥩', '🍗', '🍖', '🌭', '🍔',
      '🍟', '🍕', '🥪', '🥙', '🌮', '🌯', '🥗', '🍿', '🍣', '🍱', '🍦', '🍧', '🍨',
      '🍩', '🍪', '🎂', '🍰', '🧁', '🍫', '🍬', '🍭', '☕', '🍵', '🧃', '🥤', '🧋',
      '🍺', '🍻', '🥂', '🍷', '🥃', '🍸', '🍹'
    ]
  },
  {
    id: 'activities',
    name: 'Activities & Travel',
    icon: Car,
    emojis: [
      '⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🏓', '🏸', '🏒',
      '🥊', '🥋', '🛹', '🛼', '⛷️', '🏂', '🏋️', '🚴', '🏆', '🥇', '🥈', '🥉', '🎮',
      '🎲', '🎧', '🎤', '🎬', '🚗', '🚕', '🚙', '🏎️', '🚓', '🚑', '🚒', '🚐', '🛻',
      '🚚', '🚜', '🛵', '🏍️', '🚲', '🚨', '✈️', '🚀', '🛸', '🚁', '⛵', '🚤', '🚢'
    ]
  }
];

export const EmojiPickerDrawer: React.FC<EmojiPickerDrawerProps> = ({
  isOpen,
  onClose,
  onSelectEmoji,
  onSelectGif,
  onSendAnimatedEmoji
}) => {
  const [activeTab, setActiveTab] = useState<'limo' | 'animated' | 'gifs' | 'standard'>('limo');
  const [animateAll, setAnimateAll] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [gifCategory, setGifCategory] = useState<string>('All');
  const [recentEmojis, setRecentEmojis] = useState<string[]>([]);
  const [copiedNotification, setCopiedNotification] = useState<string | null>(null);

  // Load recents on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('limochat_recent_emojis');
      if (stored) {
        setRecentEmojis(JSON.parse(stored));
      }
    } catch (e) {}
  }, []);

  const handleEmojiClick = (emoji: string) => {
    onSelectEmoji(emoji);
    // Update recents
    try {
      const updated = [emoji, ...recentEmojis.filter(e => e !== emoji)].slice(0, 16);
      setRecentEmojis(updated);
      localStorage.setItem('limochat_recent_emojis', JSON.stringify(updated));
    } catch (e) {}
  };

  const handleAnimatedEmojiClick = (item: typeof ANIMATED_EMOJIS[0]) => {
    if (onSendAnimatedEmoji) {
      onSendAnimatedEmoji(item.emoji, item.name);
      setCopiedNotification(`Sent ${item.name}!`);
      setTimeout(() => setCopiedNotification(null), 1800);
    } else {
      handleEmojiClick(item.emoji);
    }
  };

  const handleGifClick = (gif: typeof CURATED_GIFS[0]) => {
    if (onSelectGif) {
      onSelectGif(gif.url, gif.title);
    }
  };

  // Filtered curated GIFs
  const filteredGifs = useMemo(() => {
    let list = CURATED_GIFS;
    if (gifCategory !== 'All') {
      list = list.filter(g => g.category.toLowerCase() === gifCategory.toLowerCase());
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(g => 
        g.title.toLowerCase().includes(q) || 
        g.tags.toLowerCase().includes(q) ||
        g.category.toLowerCase().includes(q)
      );
    }
    return list;
  }, [gifCategory, searchQuery]);

  // Filtered animated emojis
  const filteredAnimated = useMemo(() => {
    if (!searchQuery.trim()) return ANIMATED_EMOJIS;
    const q = searchQuery.toLowerCase();
    return ANIMATED_EMOJIS.filter(e => e.name.toLowerCase().includes(q) || e.tag.toLowerCase().includes(q));
  }, [searchQuery]);

  // Filtered LimoCraft exclusive emojis
  const filteredLimo = useMemo(() => {
    if (!searchQuery.trim()) return LIMO_CRAFT_EMOJIS;
    const q = searchQuery.toLowerCase();
    return LIMO_CRAFT_EMOJIS.filter(e => 
      e.name.toLowerCase().includes(q) || 
      e.subtitle.toLowerCase().includes(q) ||
      e.badge.toLowerCase().includes(q) ||
      e.tag.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  if (!isOpen) return null;

  return (
    <div className="bg-white/95 dark:bg-[#182229]/95 backdrop-blur-2xl border border-gray-200 dark:border-white/10 rounded-3xl shadow-[0_12px_45px_rgba(0,0,0,0.3)] dark:shadow-[0_12px_45px_rgba(0,0,0,0.55)] overflow-hidden flex flex-col z-40 transition-all select-none animate-scale-in max-h-[440px] sm:max-h-[480px]">
      {/* Top Header & Search Bar */}
      <div className="p-3 bg-gray-50/90 dark:bg-[#111b21]/90 border-b border-gray-200 dark:border-white/10 flex items-center justify-between gap-2.5">
        <div className="flex-1 relative flex items-center">
          <Search className="w-4 h-4 text-gray-500 dark:text-[#8696a0] absolute left-3 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              activeTab === 'gifs'
                ? 'Search animated GIFs...'
                : activeTab === 'animated'
                ? 'Search animated stickers...'
                : 'Search emojis & LimoCraft...'
            }
            className="w-full pl-9 pr-3 py-1.5 bg-gray-100 dark:bg-white/[0.06] hover:bg-gray-200/60 dark:hover:bg-white/[0.09] focus:bg-white dark:focus:bg-white/[0.12] border border-gray-300 dark:border-white/10 focus:border-[#00a884] dark:focus:border-[#00a884]/60 rounded-xl text-xs text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-[#8696a0] focus:outline-none transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 text-gray-500 dark:text-[#8696a0] hover:text-gray-900 dark:hover:text-white transition cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Live Animation Toggle Switch */}
        <button
          type="button"
          onClick={() => setAnimateAll((prev) => !prev)}
          className={`px-2 sm:px-2.5 py-1 rounded-xl text-[11px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer flex-shrink-0 active:scale-95 ${
            animateAll
              ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/40 shadow-sm'
              : 'bg-gray-200 dark:bg-white/10 text-gray-600 dark:text-[#8696a0]'
          }`}
          title="Toggle continuous motion animation for all emojis"
        >
          <Sparkles className={`w-3.5 h-3.5 text-amber-500 ${animateAll ? 'animate-spin-slow' : ''}`} />
          <span className="hidden sm:inline">Motion</span>
          <span className="text-[10px] font-mono font-bold uppercase">{animateAll ? 'ON' : 'OFF'}</span>
        </button>

        <button
          onClick={onClose}
          className="p-1.5 rounded-full text-gray-500 dark:text-[#8696a0] hover:text-gray-900 dark:hover:text-white hover:bg-gray-200/60 dark:hover:bg-white/10 transition cursor-pointer"
          title="Close drawer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Main Tab Switcher Ribbon */}
      <div className="px-3 py-2 bg-gray-50/70 dark:bg-[#182229] border-b border-gray-200 dark:border-white/5 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        {/* Limo Exclusive Tab */}
        <button
          onClick={() => setActiveTab('limo')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex-shrink-0 ${
            activeTab === 'limo'
              ? 'bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-500/50 text-emerald-600 dark:text-emerald-400 shadow-[0_0_12px_rgba(0,168,132,0.25)]'
              : 'text-gray-600 dark:text-[#8696a0] hover:text-gray-900 dark:hover:text-white hover:bg-gray-200/50 dark:hover:bg-white/[0.05]'
          }`}
        >
          <span className="text-sm">🍋</span>
          <span>LimoChat</span>
          <span className="text-[9px] bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold px-1.5 py-0.2 rounded-full uppercase tracking-wider">
            VIP
          </span>
        </button>

        {/* Animated Stickers Tab */}
        <button
          onClick={() => setActiveTab('animated')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex-shrink-0 ${
            activeTab === 'animated'
              ? 'bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/50 text-purple-600 dark:text-purple-300 shadow-[0_0_12px_rgba(168,85,247,0.25)]'
              : 'text-gray-600 dark:text-[#8696a0] hover:text-gray-900 dark:hover:text-white hover:bg-gray-200/50 dark:hover:bg-white/[0.05]'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-purple-500 dark:text-purple-400" />
          <span>Animated</span>
          <span className="text-[9px] bg-purple-500/20 text-purple-700 dark:text-purple-300 font-bold px-1.5 py-0.2 rounded-full uppercase tracking-wider">
            Live
          </span>
        </button>

        {/* GIFs Tab */}
        <button
          onClick={() => setActiveTab('gifs')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex-shrink-0 ${
            activeTab === 'gifs'
              ? 'bg-gradient-to-r from-blue-500/20 to-indigo-500/20 border border-blue-500/50 text-blue-600 dark:text-blue-300 shadow-[0_0_12px_rgba(59,130,246,0.25)]'
              : 'text-gray-600 dark:text-[#8696a0] hover:text-gray-900 dark:hover:text-white hover:bg-gray-200/50 dark:hover:bg-white/[0.05]'
          }`}
        >
          <Film className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
          <span>GIFs</span>
        </button>

        {/* Full Standard Pack Tab */}
        <button
          onClick={() => setActiveTab('standard')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex-shrink-0 ${
            activeTab === 'standard'
              ? 'bg-gray-200 dark:bg-white/[0.12] border border-gray-300 dark:border-white/20 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-600 dark:text-[#8696a0] hover:text-gray-900 dark:hover:text-white hover:bg-gray-200/50 dark:hover:bg-white/[0.05]'
          }`}
        >
          <Smile className="w-3.5 h-3.5" />
          <span>Full Pack</span>
        </button>
      </div>

      {/* Copied/Sent Toast Banner */}
      {copiedNotification && (
        <div className="bg-emerald-500/20 border-b border-emerald-500/30 px-3 py-1 text-center text-xs text-emerald-300 font-medium flex items-center justify-center gap-1.5 animate-fade-in">
          <Check className="w-3.5 h-3.5 text-emerald-400" />
          <span>{copiedNotification}</span>
        </div>
      )}

      {/* Content Body */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* ======================= TAB 1: LIMO EXCLUSIVES ======================= */}
        {activeTab === 'limo' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-[#8696a0] px-1">
              <span className="font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
                <span className="text-base">🍋</span> LimoChat Official Signature Emojis
              </span>
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono font-medium">Exclusive Pack</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {filteredLimo.map((item) => (
                <div
                  key={item.id}
                  className={`group relative p-3 rounded-2xl bg-gradient-to-br ${item.glow} bg-gray-50/80 dark:bg-[#1f2c34]/70 border ${item.border} hover:scale-[1.02] transition-all flex flex-col items-center justify-center text-center shadow-sm dark:shadow-lg`}
                >
                  <div 
                    onClick={() => onSelectEmoji(item.tag)}
                    className="py-1 cursor-pointer hover:scale-120 transition-transform select-none"
                    title={`Tap to insert ${item.name}`}
                  >
                    <LimoCraftEmoji id={item.id} size={50} animated={animateAll} />
                  </div>
                  <div className="font-semibold text-xs text-gray-900 dark:text-white truncate w-full mt-1">
                    {item.name}
                  </div>
                  <div className="text-[10px] text-gray-500 dark:text-[#8696a0] truncate w-full">
                    {item.subtitle}
                  </div>
                  <div className={`my-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/10 ${item.textColor} uppercase tracking-wider`}>
                    {item.badge}
                  </div>
                  <div className="flex items-center gap-1 w-full mt-1.5">
                    <button
                      type="button"
                      onClick={() => onSelectEmoji(item.tag)}
                      className="flex-1 py-1 px-1 rounded-lg bg-gray-200 dark:bg-white/10 hover:bg-gray-300 dark:hover:bg-white/20 text-[10px] font-medium text-gray-700 dark:text-white transition cursor-pointer"
                      title="Insert into text message"
                    >
                      Insert
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (onSendAnimatedEmoji) {
                          onSendAnimatedEmoji(item.tag, item.name);
                        } else {
                          onSelectEmoji(item.tag);
                        }
                      }}
                      className="flex-1 py-1 px-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-[10px] font-medium text-white transition cursor-pointer shadow-sm"
                      title="Send as custom sticker"
                    >
                      Send
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {recentEmojis.length > 0 && (
              <div className="pt-2 border-t border-gray-200 dark:border-white/10">
                <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-[#8696a0] font-semibold mb-2 px-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Recently Used</span>
                </div>
                <div className="grid grid-cols-8 gap-1.5">
                  {recentEmojis.map((emoji, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleEmojiClick(emoji)}
                      className="text-2xl p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-white/[0.08] active:scale-125 transition flex items-center justify-center cursor-pointer"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ======================= TAB 2: ANIMATED EMOJIS ======================= */}
        {activeTab === 'animated' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-[#8696a0] px-1">
              <span className="font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-purple-500 dark:text-purple-400" />
                Live Animated Emojis & Stickers
              </span>
              <span className="text-[11px] text-purple-600 dark:text-purple-400 font-mono font-medium">Micro-Motion</span>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
              {filteredAnimated.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-2xl bg-gray-50/80 dark:bg-[#1f2c34]/70 hover:bg-gray-100 dark:hover:bg-[#2a3942] border border-gray-200 dark:border-white/10 hover:border-purple-500/40 transition-all flex flex-col items-center justify-center text-center group shadow-sm dark:shadow-md"
                >
                  <div 
                    onClick={() => handleAnimatedEmojiClick(item)}
                    className={`text-4xl py-1.5 ${item.animClass} select-none cursor-pointer hover:scale-125 transition-transform`}
                    title="Tap to send sticker"
                  >
                    {item.emoji}
                  </div>
                  <span className="text-[11px] font-medium text-gray-800 dark:text-white/90 truncate w-full mt-1 group-hover:text-purple-600 dark:group-hover:text-purple-300 transition">
                    {item.name}
                  </span>
                  
                  <div className="flex items-center gap-1 mt-2 w-full">
                    <button
                      type="button"
                      onClick={() => handleEmojiClick(item.emoji)}
                      className="flex-1 py-1 px-1 rounded-lg bg-gray-200 dark:bg-white/10 hover:bg-gray-300 dark:hover:bg-white/20 text-[10px] font-medium text-gray-700 dark:text-white transition cursor-pointer"
                      title="Insert emoji into text"
                    >
                      Insert
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAnimatedEmojiClick(item)}
                      className="flex-1 py-1 px-1 rounded-lg bg-purple-600 hover:bg-purple-700 text-[10px] font-medium text-white transition cursor-pointer shadow-sm"
                      title="Send as animated message"
                    >
                      Send
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ======================= TAB 3: GIFS ======================= */}
        {activeTab === 'gifs' && (
          <div className="space-y-3">
            {/* Quick Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
              {['All', 'Thumbs Up', 'Laugh', 'Love', 'Party', 'Dance', 'Wow', 'Fire', 'Bye'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setGifCategory(cat)}
                  className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                    gifCategory === cat
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-gray-100 dark:bg-white/[0.06] text-gray-600 dark:text-[#8696a0] hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-white/[0.1]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* GIFs Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {filteredGifs.map((gif) => (
                <div
                  key={gif.id}
                  onClick={() => handleGifClick(gif)}
                  className="group relative rounded-2xl overflow-hidden aspect-video bg-gray-200 dark:bg-[#111b21] border border-gray-200 dark:border-white/10 hover:border-blue-500/60 transition cursor-pointer shadow-md hover:scale-[1.02] active:scale-95"
                >
                  <img
                    src={gif.url}
                    alt={gif.title}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:brightness-105 transition"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition flex items-end p-2">
                    <span className="text-[11px] text-white font-medium truncate flex-1">
                      {gif.title}
                    </span>
                    <Send className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 ml-1" />
                  </div>
                </div>
              ))}
            </div>

            {filteredGifs.length === 0 && (
              <div className="py-8 text-center text-xs text-gray-500 dark:text-[#8696a0]">
                No GIFs matching "{searchQuery}". Try "thumbs up", "laugh", or "fire".
              </div>
            )}
          </div>
        )}

        {/* ======================= TAB 4: FULL STANDARD PACK ======================= */}
        {activeTab === 'standard' && (
          <div className="space-y-4">
            {recentEmojis.length > 0 && !searchQuery && (
              <div>
                <div className="text-xs text-gray-500 dark:text-[#8696a0] font-semibold mb-2 px-1 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Recently Used</span>
                </div>
                <div className="grid grid-cols-8 sm:grid-cols-10 gap-1.5">
                  {recentEmojis.map((emoji, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleEmojiClick(emoji)}
                      className="text-2xl p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-white/[0.08] active:scale-125 transition flex items-center justify-center cursor-pointer"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {STANDARD_EMOJI_CATEGORIES.map((category) => {
              const matches = searchQuery.trim()
                ? category.emojis
                : category.emojis;

              return (
                <div key={category.id} className="space-y-1.5">
                  <div className="text-xs font-semibold text-gray-600 dark:text-[#8696a0] px-1 sticky top-0 bg-white/95 dark:bg-[#182229]/95 backdrop-blur-md py-1 z-10">
                    {category.name}
                  </div>
                  <div className="grid grid-cols-8 sm:grid-cols-10 gap-1">
                    {matches.map((emoji, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleEmojiClick(emoji)}
                        className={`text-2xl p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-white/[0.08] active:scale-125 transition flex items-center justify-center cursor-pointer hover:scale-140 hover:-rotate-6 ${
                          animateAll ? 'animate-emoji-pop' : ''
                        }`}
                        style={{
                          animationDelay: animateAll ? `${(idx % 12) * 0.08}s` : undefined
                        }}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
