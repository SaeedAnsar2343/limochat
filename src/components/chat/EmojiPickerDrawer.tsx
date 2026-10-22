import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Search, 
  X, 
  Smile, 
  Film, 
  Heart, 
  Clock, 
  Flame, 
  Coffee, 
  Car, 
  Smartphone, 
  Compass,
  Check, 
  Send
} from 'lucide-react';
import { LimoCraftEmoji, LIMO_CRAFT_EMOJIS } from './LimoCraftEmoji';

interface EmojiPickerDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectEmoji: (emoji: string) => void;
  onSelectGif?: (gifUrl: string, caption?: string) => void;
  onSendAnimatedEmoji?: (emoji: string, name: string) => void;
}

// 🎬 Curated High-Speed CDN GIFs
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

// Full Pack Categorized Standard Emojis
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
    name: 'People & Gestures',
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
    name: 'Hearts & Love',
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
    name: 'Food & Drink',
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
    name: 'Activities & Sports',
    icon: Car,
    emojis: [
      '⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🏓', '🏸', '🏒',
      '🥊', '🥋', '🛹', '🛼', '⛷️', '🏂', '🏋️', '🚴', '🏆', '🥇', '🥈', '🥉', '🎮',
      '🎲', '🎧', '🎤', '🎬'
    ]
  },
  {
    id: 'travel',
    name: 'Travel & Places',
    icon: Compass,
    emojis: [
      '🚗', '🚕', '🚙', '🏎️', '🚓', '🚑', '🚒', '🚐', '🛻', '🚚', '🚜', '🛵', '🏍️',
      '🚲', '🚨', '✈️', '🚀', '🛸', '🚁', '⛵', '🚤', '🚢', '⚓', '⛽', '🏰', '🗽',
      '🗼', '🏔️', '🌋', '🏕️', '🏖️', '🏝️', '🌅', '🌄', '🌃', '🏙️'
    ]
  },
  {
    id: 'objects',
    name: 'Objects & Tech',
    icon: Smartphone,
    emojis: [
      '💻', '📱', '🖥️', '⌚', '📷', '📹', '🔍', '💡', '🔦', '🔑', '🔒', '🔓', '🎁',
      '💎', '📦', '💰', '💳', '✉️', '📝', '📁', '📊', '📈', '🛠️', '⚙️', '🧪', '🔮',
      '📌', '📎', '✏️', '📚', '🔔', '📣', '🔥', '⭐', '⚡', '🎯'
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
  // STRICTLY 3 TABS: 'limo' | 'gifs' | 'standard'
  const [activeTab, setActiveTab] = useState<'limo' | 'gifs' | 'standard'>('limo');
  const [searchQuery, setSearchQuery] = useState('');
  const [gifCategory, setGifCategory] = useState<string>('All');
  const [recentEmojis, setRecentEmojis] = useState<string[]>([]);
  const [notification, setNotification] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

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

  const handleLimoSelect = (item: typeof LIMO_CRAFT_EMOJIS[0]) => {
    onSelectEmoji(item.tag);
    setNotification(`Selected ${item.name}`);
    setTimeout(() => setNotification(null), 1200);
  };

  const handleGifClick = (gif: typeof CURATED_GIFS[0]) => {
    if (onSelectGif) {
      onSelectGif(gif.url, gif.title);
    }
  };

  const scrollToCategory = (catId: string) => {
    const el = document.getElementById(`emoji-cat-${catId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
    <div className="bg-white/95 dark:bg-[#182229]/95 backdrop-blur-2xl border border-gray-200 dark:border-white/10 rounded-2xl sm:rounded-3xl shadow-[0_12px_45px_rgba(0,0,0,0.25)] dark:shadow-[0_12px_45px_rgba(0,0,0,0.55)] overflow-hidden flex flex-col z-40 transition-all select-none animate-scale-in h-[320px] sm:h-[350px] max-h-[42vh] w-full">
      
      {/* Top Header & Search Bar */}
      <div className="p-3 bg-gray-50/90 dark:bg-[#111b21]/90 border-b border-gray-200 dark:border-white/10 flex items-center justify-between gap-2.5">
        <div className="flex-1 relative flex items-center">
          <Search className="w-4 h-4 text-gray-500 dark:text-[#8696a0] absolute left-3 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              activeTab === 'limo'
                ? 'Search LimoCraft emojis...'
                : activeTab === 'gifs'
                ? 'Search animated GIFs...'
                : 'Search full emoji pack...'
            }
            className="w-full pl-9 pr-8 py-2 bg-gray-100 dark:bg-white/[0.06] hover:bg-gray-200/60 dark:hover:bg-white/[0.09] focus:bg-white dark:focus:bg-white/[0.12] border border-gray-300 dark:border-white/10 focus:border-[#00a884] dark:focus:border-[#00a884]/60 rounded-xl text-xs text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-[#8696a0] focus:outline-none transition-all shadow-inner"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 text-gray-500 dark:text-[#8696a0] hover:text-gray-900 dark:hover:text-white transition cursor-pointer p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <button
          onClick={onClose}
          className="p-2 rounded-xl text-gray-500 dark:text-[#8696a0] hover:text-gray-900 dark:hover:text-white hover:bg-gray-200/60 dark:hover:bg-white/10 active:scale-90 transition cursor-pointer flex-shrink-0"
          title="Close picker"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Main Tab Switcher Ribbon (Strictly 3 Tabs) */}
      <div className="px-3 py-2 bg-gray-50/70 dark:bg-[#182229] border-b border-gray-200 dark:border-white/5 flex items-center justify-between gap-1.5 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1.5 w-full">
          {/* TAB 1: Limo Emoji */}
          <button
            onClick={() => setActiveTab('limo')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-2xl text-xs font-semibold transition-all cursor-pointer active:scale-95 ${
              activeTab === 'limo'
                ? 'bg-gradient-to-r from-emerald-500/15 to-teal-500/15 border border-emerald-500/50 text-emerald-600 dark:text-emerald-400 shadow-[0_2px_12px_rgba(0,168,132,0.2)] font-bold'
                : 'text-gray-600 dark:text-[#8696a0] hover:text-gray-900 dark:hover:text-white hover:bg-gray-200/50 dark:hover:bg-white/[0.05]'
            }`}
          >
            <span className="text-sm">🍋</span>
            <span>Limo Emoji</span>
            <span className="text-[9px] bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold px-1.5 py-0.2 rounded-full uppercase tracking-wider hidden sm:inline">
              Exclusive
            </span>
          </button>

          {/* TAB 2: GIFs */}
          <button
            onClick={() => setActiveTab('gifs')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-2xl text-xs font-semibold transition-all cursor-pointer active:scale-95 ${
              activeTab === 'gifs'
                ? 'bg-gradient-to-r from-blue-500/15 to-indigo-500/15 border border-blue-500/50 text-blue-600 dark:text-blue-300 shadow-[0_2px_12px_rgba(59,130,246,0.2)] font-bold'
                : 'text-gray-600 dark:text-[#8696a0] hover:text-gray-900 dark:hover:text-white hover:bg-gray-200/50 dark:hover:bg-white/[0.05]'
            }`}
          >
            <Film className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
            <span>GIFs</span>
          </button>

          {/* TAB 3: Full Pack */}
          <button
            onClick={() => setActiveTab('standard')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-2xl text-xs font-semibold transition-all cursor-pointer active:scale-95 ${
              activeTab === 'standard'
                ? 'bg-gray-200/90 dark:bg-white/[0.14] border border-gray-300 dark:border-white/20 text-gray-900 dark:text-white shadow-sm font-bold'
                : 'text-gray-600 dark:text-[#8696a0] hover:text-gray-900 dark:hover:text-white hover:bg-gray-200/50 dark:hover:bg-white/[0.05]'
            }`}
          >
            <Smile className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
            <span>Full Pack</span>
          </button>
        </div>
      </div>

      {/* Subtle feedback toast */}
      {notification && (
        <div className="bg-emerald-500/15 border-b border-emerald-500/30 px-3 py-1 text-center text-xs text-emerald-700 dark:text-emerald-300 font-medium flex items-center justify-center gap-1.5 animate-fade-in">
          <Check className="w-3.5 h-3.5 text-emerald-500" />
          <span>{notification}</span>
        </div>
      )}

      {/* Content Body */}
      <div ref={contentRef} className="flex-1 overflow-y-auto p-3 space-y-4">
        
        {/* ======================= TAB 1: LIMO EMOJI (CLEAN TAP-TO-SELECT GRID) ======================= */}
        {activeTab === 'limo' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-[#8696a0] px-1">
              <span className="font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
                <span className="text-base">🍋</span> Tap an emoji to insert
              </span>
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono font-medium">
                {filteredLimo.length} Exclusive Designs
              </span>
            </div>

            {/* Direct Tap-To-Select Sticker Grid - Clean & Modern */}
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 sm:gap-2.5">
              {filteredLimo.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleLimoSelect(item)}
                  className="group relative p-2.5 rounded-2xl bg-gray-50/90 hover:bg-emerald-50/70 dark:bg-white/[0.04] dark:hover:bg-white/[0.09] border border-gray-200/90 dark:border-white/10 hover:border-emerald-500/50 dark:hover:border-emerald-500/50 active:scale-90 transition-all flex flex-col items-center justify-center text-center cursor-pointer shadow-sm hover:shadow-md select-none touch-manipulation"
                  title={`Tap to select ${item.name}`}
                >
                  <div className="py-1 transform group-hover:scale-120 group-hover:-rotate-3 group-active:scale-95 transition-transform duration-200">
                    <LimoCraftEmoji id={item.id} size={50} animated={true} />
                  </div>
                  
                  <span className="text-[11px] font-semibold text-gray-800 dark:text-[#e9edef] group-hover:text-emerald-600 dark:group-hover:text-emerald-400 truncate w-full mt-1.5">
                    {item.name}
                  </span>

                  <span className="text-[9px] text-gray-500 dark:text-[#8696a0] truncate w-full">
                    {item.subtitle}
                  </span>

                  {/* Subtle instant insert indicator on hover */}
                  <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-full p-0.5">
                    <Check className="w-2.5 h-2.5" />
                  </div>
                </button>
              ))}
            </div>

            {filteredLimo.length === 0 && (
              <div className="py-8 text-center text-xs text-gray-500 dark:text-[#8696a0]">
                No LimoCraft emojis matching "{searchQuery}".
              </div>
            )}
          </div>
        )}

        {/* ======================= TAB 2: GIFS ======================= */}
        {activeTab === 'gifs' && (
          <div className="space-y-3">
            {/* Quick Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
              {['All', 'Thumbs Up', 'Laugh', 'Love', 'Party', 'Dance', 'Wow', 'Fire', 'Bye'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setGifCategory(cat)}
                  className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer active:scale-95 ${
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
                  title={`Send GIF: ${gif.title}`}
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
                No GIFs matching "{searchQuery}". Try "thumbs up", "laugh", or "party".
              </div>
            )}
          </div>
        )}

        {/* ======================= TAB 3: FULL PACK ======================= */}
        {activeTab === 'standard' && (
          <div className="space-y-4">
            
            {/* Quick Category Icons Strip */}
            {!searchQuery && (
              <div className="flex items-center justify-between gap-1 px-1 py-1.5 bg-gray-100/70 dark:bg-white/[0.04] rounded-2xl border border-gray-200/60 dark:border-white/5 overflow-x-auto no-scrollbar sticky top-0 backdrop-blur-md z-20">
                {STANDARD_EMOJI_CATEGORIES.map((cat) => {
                  const Icon = cat.icon;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => scrollToCategory(cat.id)}
                      className="p-1.5 rounded-xl hover:bg-gray-200 dark:hover:bg-white/10 text-gray-600 dark:text-[#8696a0] hover:text-emerald-600 dark:hover:text-emerald-400 active:scale-90 transition flex-shrink-0 cursor-pointer"
                      title={cat.name}
                    >
                      <Icon className="w-4 h-4" />
                    </button>
                  );
                })}
              </div>
            )}

            {/* Recently Used Emojis */}
            {recentEmojis.length > 0 && !searchQuery && (
              <div className="space-y-1.5">
                <div className="text-xs text-gray-500 dark:text-[#8696a0] font-semibold px-1 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Recently Used</span>
                </div>
                <div className="grid grid-cols-8 sm:grid-cols-10 gap-1.5">
                  {recentEmojis.map((emoji, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleEmojiClick(emoji)}
                      className="text-2xl p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-white/[0.08] active:scale-125 transition flex items-center justify-center cursor-pointer hover:scale-130 select-none"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Categorized Emojis */}
            {STANDARD_EMOJI_CATEGORIES.map((category) => {
              const list = searchQuery.trim()
                ? category.emojis.filter(() => true) // search through full pack
                : category.emojis;

              return (
                <div key={category.id} id={`emoji-cat-${category.id}`} className="space-y-1.5 pt-1">
                  <div className="text-xs font-semibold text-gray-700 dark:text-[#d1d7db] px-1 flex items-center gap-1.5">
                    <span>{category.name}</span>
                  </div>
                  <div className="grid grid-cols-8 sm:grid-cols-10 gap-1">
                    {list.map((emoji, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleEmojiClick(emoji)}
                        className="text-2xl p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-white/[0.08] active:scale-90 transition-transform duration-150 flex items-center justify-center cursor-pointer hover:scale-135 hover:-rotate-6 select-none"
                        title={emoji}
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
