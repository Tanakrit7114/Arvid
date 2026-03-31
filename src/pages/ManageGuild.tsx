import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Settings, Shield, Music, Bell, Hash,
  Users, Sliders, ToggleLeft, ToggleRight, Save,
  ChevronRight, Zap, Volume2, MessageSquare, Star,
  AlertTriangle, Search, Globe, LayoutDashboard, Crown,
  UserCircle, Megaphone, PenTool, FileText, Bot,
  Ticket, Terminal, Command, Lock, Trophy, BarChart3,
  Mic, UserPlus, MousePointer2, Clock, ShieldCheck, Tag,
  Swords, Type, ShieldAlert, Hammer, AlertCircle, History,
  Youtube, Twitch, Gamepad2, Share2, Cloud, Rss, Music2,
  Disc, Heart, MoreHorizontal
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../AuthContext';
import { db } from '../firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { ARVID_ICON_URL } from '../constants';

/* ─── Types ─── */
interface GuildData {
  id: string;
  name: string;
  icon: string | null;
  memberCount: number;
  prefix: string;
  language: string;
  modules: {
    music: boolean;
    moderation: boolean;
    welcome: boolean;
    leveling: boolean;
    automod: boolean;
  };
  welcomeChannel: string;
  logChannel: string;
}

/* ─── Nav sections ─── */
const NAV_SECTIONS = [
  {
    title: 'General',
    items: [
      { id: 'main',             icon: LayoutDashboard, label: 'Main'             },
      { id: 'settings',         icon: Settings,        label: 'Settings'         },
      { id: 'premium',          icon: Crown,           label: 'Premium'          },
      { id: 'custom-profile',   icon: UserCircle,      label: 'Custom Profile', isNew: true },
    ],
  },
  {
    title: 'Messaging',
    items: [
      { id: 'announcements',    icon: Megaphone,       label: 'Announcements'    },
      { id: 'message-builder',  icon: PenTool,         label: 'Message Builder'  },
      { id: 'templates',        icon: FileText,        label: 'Templates'        },
      { id: 'actions',          icon: Zap,             label: 'Actions'          },
      { id: 'auto-responders',  icon: Bot,             label: 'Auto Responders', isNew: true },
      { id: 'ticketing',        icon: Ticket,          label: 'Ticketing'        },
    ],
  },
  {
    title: 'Commands',
    items: [
      { id: 'custom-commands',  icon: Terminal,        label: 'Custom Commands'  },
      { id: 'commands',         icon: Command,         label: 'Commands',       isNew: true },
      { id: 'command-perms',    icon: Lock,            label: 'Permissions'      },
    ],
  },
  {
    title: 'Server Engagement',
    items: [
      { id: 'levels',           icon: Trophy,          label: 'Levels'           },
      { id: 'leaderboard',      icon: Trophy,          label: 'Leaderboard'      },
      { id: 'stats',            icon: BarChart3,       label: 'Stats'            },
      { id: 'temp-voice',       icon: Mic,             label: 'Temporary Voice', isNew: true },
      { id: 'starboard',        icon: Star,            label: 'Starboard',       isNew: true },
    ],
  },
  {
    title: 'Roles',
    items: [
      { id: 'auto-roles',       icon: UserPlus,        label: 'Auto Roles'       },
      { id: 'reaction-roles',   icon: MousePointer2,   label: 'Reaction Roles'   },
      { id: 'temp-roles',       icon: Clock,           label: 'Temporary Roles', isNew: true },
      { id: 'persistent-roles', icon: ShieldCheck,     label: 'Persistent Roles',isNew: true },
      { id: 'tag-role',         icon: Tag,             label: 'Tag Role',        isNew: true },
      { id: 'factions',         icon: Swords,          label: 'Factions'         },
    ],
  },
  {
    title: 'Moderation',
    items: [
      { id: 'auto-nicks',       icon: Type,            label: 'Auto Nicks'       },
      { id: 'automod',          icon: ShieldAlert,     label: 'Auto Mod',        isNew: true },
      { id: 'moderation',       icon: Hammer,          label: 'Moderation'       },
      { id: 'warnings',         icon: AlertCircle,     label: 'Warnings'         },
      { id: 'logs',             icon: History,         label: 'Logs'             },
    ],
  },
  {
    title: 'Social Feeds',
    items: [
      { id: 'youtube',          icon: Youtube,         label: 'YouTube'          },
      { id: 'twitch',           icon: Twitch,          label: 'Twitch'           },
      { id: 'kick',             icon: Gamepad2,        label: 'Kick'             },
      { id: 'reddit',           icon: Share2,          label: 'Reddit'           },
      { id: 'bluesky',          icon: Cloud,           label: 'Bluesky',         isNew: true },
      { id: 'rss',              icon: Rss,             label: 'RSS'              },
      { id: 'spotify',          icon: Music2,          label: 'Spotify'          },
      { id: 'tidal',            icon: Disc,            label: 'TIDAL',           isNew: true },
      { id: 'soundcloud',       icon: Cloud,           label: 'SoundCloud',      isNew: true },
    ],
  },
  {
    title: 'Utilities',
    items: [
      { id: 'lovecalc',         icon: Heart,           label: 'LoveCalc'         },
      { id: 'misc',             icon: MoreHorizontal,  label: 'Misc'             },
    ],
  },
];

/* ─── Toggle Switch ─── */
const Toggle = ({ enabled, onChange }: { enabled: boolean; onChange: () => void }) => (
  <button
    onClick={onChange}
    className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${enabled ? 'bg-blue-500' : 'bg-white/10'}`}
  >
    <span
      className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${enabled ? 'translate-x-5' : 'translate-x-0'}`}
    />
  </button>
);

/* ─── Module Card ─── */
const ModuleCard = ({
  icon: Icon, label, description, enabled, color, onToggle,
}: {
  icon: React.ElementType; label: string; description: string;
  enabled: boolean; color: string; onToggle: () => void;
}) => (
  <motion.div
    layout
    className={`p-5 rounded-2xl border transition-all duration-300 ${
      enabled
        ? 'bg-white/[0.05] border-white/[0.12]'
        : 'bg-white/[0.02] border-white/[0.05] opacity-60'
    }`}
  >
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-xl ${color} flex items-center justify-center shrink-0 mt-0.5`}>
          <Icon size={16} />
        </div>
        <div>
          <p className="text-sm font-bold mb-0.5">{label}</p>
          <p className="text-[11px] text-white/40 leading-relaxed">{description}</p>
        </div>
      </div>
      <Toggle enabled={enabled} onChange={onToggle} />
    </div>
  </motion.div>
);

/* ─── Input Field ─── */
const Field = ({
  label, value, onChange, placeholder, hint,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; hint?: string;
}) => (
  <div>
    <label className="block text-[11px] font-bold uppercase tracking-widest text-white/40 mb-2">{label}</label>
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm font-medium placeholder:text-white/20 focus:outline-none focus:border-blue-500/50 focus:bg-white/[0.06] transition-all"
    />
    {hint && <p className="text-[10px] text-white/25 mt-1.5">{hint}</p>}
  </div>
);

/* ═══════════════════════════════════ MAIN PAGE ═══════════════════════════════════ */
const ManageGuild = () => {
  const { guildId } = useParams<{ guildId: string }>();
  const { isAdmin, isAuthReady } = useAuth();
  const navigate = useNavigate();

  const [activeSection, setActiveSection] = useState('main');
  const [loading, setLoading]             = useState(true);
  const [saving, setSaving]               = useState(false);
  const [saved, setSaved]                 = useState(false);

  const [guild, setGuild] = useState<GuildData>({
    id: guildId ?? '',
    name: 'Loading...',
    icon: null,
    memberCount: 0,
    prefix: '!',
    language: 'en',
    modules: { music: true, moderation: false, welcome: true, leveling: false, automod: false },
    welcomeChannel: '',
    logChannel: '',
  });

  /* Auth guard */
  useEffect(() => {
    if (isAuthReady && !isAdmin) navigate('/dashboard');
  }, [isAdmin, isAuthReady, navigate]);

  /* Fetch guild */
  useEffect(() => {
    if (!guildId) return;
    const fetchGuild = async () => {
      try {
        // 1. Fetch from Firestore first for settings
        const snap = await getDoc(doc(db, 'guilds', guildId));
        if (snap.exists()) {
          setGuild(prev => ({ ...prev, ...snap.data(), id: snap.id } as GuildData));
        }

        // 2. Fetch from API for latest Discord info (name, icon, memberCount)
        const response = await fetch(`/api/guilds/${guildId}`);
        if (response.ok) {
          const data = await response.json();
          setGuild(prev => ({
            ...prev,
            ...data,
            // Ensure memberCount is correctly mapped from API (which uses memberCount or members)
            memberCount: data.memberCount || data.members || prev.memberCount || 0,
          }));
        }
      } catch (e) {
        console.error("Error fetching guild info:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchGuild();
  }, [guildId]);

  const toggleModule = (key: keyof GuildData['modules']) => {
    setGuild(prev => ({
      ...prev,
      modules: { ...prev.modules, [key]: !prev.modules[key] },
    }));
  };

  const handleSave = async () => {
    if (!guildId) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'guilds', guildId), {
        prefix: guild.prefix,
        language: guild.language,
        modules: guild.modules,
        welcomeChannel: guild.welcomeChannel,
        logChannel: guild.logChannel,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  /* ── Guild Avatar ── */
  const avatarUrl = guild.icon
    ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.webp?size=64`
    : ARVID_ICON_URL;

  /* ── Section renderer ── */
  const renderSection = () => {
    const sectionTitle = NAV_SECTIONS.flatMap(s => s.items).find(i => i.id === activeSection)?.label || 'Module';

    switch (activeSection) {

      /* ── Main (Overview) ── */
      case 'main':
        return (
          <motion.div key="main" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <h2 className="text-lg font-black mb-1">Main Overview</h2>
            <p className="text-xs text-white/35 mb-6">Quick status of this server's Arvid configuration.</p>

            {/* Server card */}
            <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-6 mb-8 flex items-center gap-5">
              {avatarUrl
                ? <img src={avatarUrl} alt="" className="w-16 h-16 rounded-2xl object-cover border border-white/10 shadow-xl" />
                : <div className="w-16 h-16 rounded-2xl bg-blue-500/20 flex items-center justify-center text-blue-400 font-black text-2xl">
                    {guild.name[0]}
                  </div>
              }
              <div>
                <h3 
                  className="font-black text-xl text-white"
                  style={guild.name === 'Loading...' ? { textShadow: '2px 2px #5865f2, -2px -2px #57c9a4' } : {}}
                >
                  {guild.name}
                </h3>
                <p className="text-xs text-white/35 mt-1 font-medium">{guild.memberCount.toLocaleString()} members · ID: {guild.id}</p>
                <div className="flex items-center gap-2 mt-3">
                  <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg text-[10px] font-black uppercase tracking-wider">Active</span>
                  <span className="px-2.5 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-lg text-[10px] font-black uppercase tracking-wider">Prefix: {guild.prefix}</span>
                </div>
              </div>
            </div>

            {/* Module status grid */}
            <p className="text-[10px] uppercase tracking-widest font-bold text-white/30 mb-3">Module Status</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {Object.entries(guild.modules).map(([key, val]) => (
                <div key={key} className={`flex items-center gap-2.5 p-3 rounded-xl border ${val ? 'bg-white/[0.04] border-white/[0.08]' : 'bg-white/[0.01] border-white/[0.04] opacity-50'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${val ? 'bg-emerald-500' : 'bg-white/20'}`} />
                  <span className="text-xs font-semibold capitalize">{key}</span>
                </div>
              ))}
            </div>
          </motion.div>
        );

      /* ── Settings ── */
      case 'settings':
        return (
          <motion.div key="settings" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <h2 className="text-lg font-black mb-1">Settings</h2>
            <p className="text-xs text-white/35 mb-6">Configure basic bot behaviour for this server.</p>
            <div className="space-y-4 max-w-lg">
              <Field label="Command Prefix" value={guild.prefix} onChange={v => setGuild(g => ({ ...g, prefix: v }))} placeholder="!" hint="Character used before every command (e.g. !play)" />
              <Field label="Language" value={guild.language} onChange={v => setGuild(g => ({ ...g, language: v }))} placeholder="en" hint="Primary language for bot responses" />
              <Field label="Welcome Channel" value={guild.welcomeChannel} onChange={v => setGuild(g => ({ ...g, welcomeChannel: v }))} placeholder="#welcome" hint="Channel ID or name where join messages are sent" />
              <Field label="Log Channel" value={guild.logChannel} onChange={v => setGuild(g => ({ ...g, logChannel: v }))} placeholder="#logs" hint="Channel where audit events are logged" />
            </div>
          </motion.div>
        );

      /* ── Premium ── */
      case 'premium':
        return (
          <motion.div key="premium" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <h2 className="text-lg font-black mb-1">Arvid Premium</h2>
            <p className="text-xs text-white/35 mb-8">Unlock exclusive features and support the bot's development.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-6 rounded-3xl bg-gradient-to-br from-blue-500/20 to-blue-500/5 border border-blue-500/20">
                <Crown className="text-blue-400 mb-4" size={32} />
                <h3 className="text-base font-black mb-2">Guild Premium</h3>
                <p className="text-xs text-white/50 leading-relaxed mb-6">
                  Enable premium features for every member in this server. Includes custom branding, 24/7 music, and more.
                </p>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-2xl font-black">$4.99</span>
                  <span className="text-[10px] text-white/30 uppercase font-bold tracking-widest">/ month</span>
                </div>
                <button className="w-full py-3 bg-blue-500 hover:bg-blue-400 text-white text-xs font-black rounded-xl transition-all shadow-lg shadow-blue-500/20">
                  Upgrade Now
                </button>
              </div>

              <div className="space-y-4">
                <p className="text-[10px] uppercase tracking-widest font-bold text-white/30 mb-2">Premium Features</p>
                {[
                  { label: '24/7 Music', desc: 'Bot stays in voice even when empty.' },
                  { label: 'Custom Profile', desc: 'Personalize your bot profile card.' },
                  { label: 'Advanced Logs', desc: 'Keep logs for up to 90 days.' },
                  { label: 'Priority Support', desc: 'Get help faster from our team.' },
                ].map(f => (
                  <div key={f.label} className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                      <Zap size={14} className="text-blue-400" />
                    </div>
                    <div>
                      <p className="text-xs font-bold">{f.label}</p>
                      <p className="text-[10px] text-white/30">{f.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        );

      /* ── Announcements ── */
      case 'announcements':
        return (
          <motion.div key="announcements" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <h2 className="text-lg font-black mb-1">Announcements</h2>
            <p className="text-xs text-white/35 mb-8">Automate messages for new members, level ups, and more.</p>

            <div className="space-y-6">
              <div className="p-6 rounded-3xl bg-white/[0.03] border border-white/[0.07]">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                      <Bell size={18} className="text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm font-bold">Welcome Messages</p>
                      <p className="text-[11px] text-white/30">Send a message when someone joins.</p>
                    </div>
                  </div>
                  <Toggle enabled={guild.modules.welcome} onChange={() => toggleModule('welcome')} />
                </div>
                <div className="space-y-4 pt-4 border-t border-white/[0.05]">
                  <Field label="Channel" value={guild.welcomeChannel} onChange={v => setGuild(g => ({ ...g, welcomeChannel: v }))} placeholder="#welcome" />
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-widest text-white/40 mb-2">Message Template</label>
                    <textarea
                      rows={3}
                      defaultValue="Welcome to the server, {user}! 🎉"
                      className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:border-blue-500/50 transition-all resize-none"
                    />
                  </div>
                </div>
              </div>

              <div className="p-6 rounded-3xl bg-white/[0.03] border border-white/[0.07]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                      <Zap size={18} className="text-purple-400" />
                    </div>
                    <div>
                      <p className="text-sm font-bold">Level Up Messages</p>
                      <p className="text-[11px] text-white/30">Announce when members reach a new level.</p>
                    </div>
                  </div>
                  <Toggle enabled={guild.modules.leveling} onChange={() => toggleModule('leveling')} />
                </div>
              </div>
            </div>
          </motion.div>
        );

      /* ── Levels ── */
      case 'levels':
        return (
          <motion.div key="levels" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-lg font-black">Leveling System</h2>
              <Toggle enabled={guild.modules.leveling} onChange={() => toggleModule('leveling')} />
            </div>
            <p className="text-xs text-white/35 mb-8">Reward active members with XP and roles.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="space-y-4">
                <p className="text-[10px] uppercase tracking-widest font-bold text-white/30">Configuration</p>
                <Field label="XP per Message" value="15-25" onChange={() => {}} hint="Random XP range per message" />
                <Field label="XP Cooldown" value="60s" onChange={() => {}} hint="Time between XP gains" />
              </div>
              <div className="space-y-4">
                <p className="text-[10px] uppercase tracking-widest font-bold text-white/30">Visuals</p>
                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.07]">
                  <p className="text-xs font-bold mb-2">Rank Card Theme</p>
                  <div className="flex gap-2">
                    {['#5865f2', '#57c9a4', '#10b981', '#a855f7'].map(c => (
                      <div key={c} className="w-8 h-8 rounded-full cursor-pointer border-2 border-transparent hover:border-white transition-all" style={{ backgroundColor: c }} />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <p className="text-[10px] uppercase tracking-widest font-bold text-white/30 mb-4">Role Rewards</p>
            <div className="space-y-2">
              {[
                { level: 5, role: 'Active Member', color: 'text-blue-400' },
                { level: 10, role: 'Veteran', color: 'text-purple-400' },
                { level: 25, role: 'Elite', color: 'text-blue-500' },
              ].map(r => (
                <div key={r.level} className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.03] border border-white/[0.07]">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-white/[0.05] flex items-center justify-center font-black text-xs">
                      LVL {r.level}
                    </div>
                    <span className={`text-sm font-bold ${r.color}`}>{r.role}</span>
                  </div>
                  <button className="text-[10px] font-bold text-white/30 hover:text-white transition-colors">Edit</button>
                </div>
              ))}
              <button className="w-full py-4 border border-dashed border-white/10 rounded-2xl text-xs font-bold text-white/20 hover:text-white/40 hover:bg-white/[0.01] transition-all">
                + Add Role Reward
              </button>
            </div>
          </motion.div>
        );

      /* ── Moderation ── */
      case 'moderation':
        return (
          <motion.div key="moderation" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-lg font-black">Moderation</h2>
              <Toggle enabled={guild.modules.moderation} onChange={() => toggleModule('moderation')} />
            </div>
            <p className="text-xs text-white/35 mb-8">Keep your community safe with powerful tools.</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              {[
                { label: 'Warnings', val: '12', icon: AlertCircle, color: 'text-yellow-400' },
                { label: 'Mutes', val: '4', icon: Mic, color: 'text-blue-400' },
                { label: 'Bans', val: '2', icon: Hammer, color: 'text-red-400' },
              ].map(s => (
                <div key={s.label} className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.07]">
                  <div className="flex items-center justify-between mb-2">
                    <s.icon size={14} className={s.color} />
                    <span className="text-[10px] font-bold text-white/20 uppercase">Total</span>
                  </div>
                  <p className="text-xl font-black">{s.val}</p>
                  <p className="text-[10px] text-white/30 font-bold">{s.label}</p>
                </div>
              ))}
            </div>

            <div className="space-y-4">
              <p className="text-[10px] uppercase tracking-widest font-bold text-white/30">Auto-Moderation Rules</p>
              {[
                { label: 'Anti-Spam', desc: 'Prevents users from spamming messages.', enabled: true },
                { label: 'Bad Words', desc: 'Automatically deletes messages with slurs.', enabled: true },
                { label: 'Invite Blocker', desc: 'Removes other server invite links.', enabled: false },
              ].map(r => (
                <div key={r.label} className="p-5 rounded-3xl bg-white/[0.03] border border-white/[0.07] flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold mb-1">{r.label}</p>
                    <p className="text-xs text-white/30">{r.desc}</p>
                  </div>
                  <Toggle enabled={r.enabled} onChange={() => {}} />
                </div>
              ))}
            </div>
          </motion.div>
        );

      /* ── Logs ── */
      case 'logs':
        return (
          <motion.div key="logs" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <h2 className="text-lg font-black mb-1">Audit Logs</h2>
            <p className="text-xs text-white/35 mb-8">Recent actions performed by Arvid and moderators.</p>

            <div className="space-y-3">
              {[
                { action: 'Member Warned', user: 'tanakrit.k', target: 'Spammer#123', time: '2m ago', type: 'warn' },
                { action: 'Message Deleted', user: 'AutoMod', target: '#general', time: '5m ago', type: 'delete' },
                { action: 'Role Added', user: 'tanakrit.k', target: 'Newbie#456', time: '12m ago', type: 'role' },
                { action: 'Member Banned', user: 'tanakrit.k', target: 'Hacker#999', time: '1h ago', type: 'ban' },
              ].map((l, i) => (
                <div key={i} className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-2 h-2 rounded-full ${
                      l.type === 'warn' ? 'bg-yellow-400' :
                      l.type === 'delete' ? 'bg-red-400' :
                      l.type === 'role' ? 'bg-blue-400' : 'bg-red-600'
                    }`} />
                    <div>
                      <p className="text-xs font-bold">{l.action}</p>
                      <p className="text-[10px] text-white/30">
                        <span className="text-white/60">{l.user}</span> acted on <span className="text-white/60">{l.target}</span>
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-white/20">{l.time}</span>
                </div>
              ))}
            </div>
          </motion.div>
        );
    }
  };

  return (
    <div className="flex min-h-screen bg-[#0d0d0f] text-white">

      {/* ══ SIDEBAR ══ */}
      <aside className="hidden md:flex w-72 shrink-0 flex-col border-r border-white/[0.07] bg-white/[0.02] sticky top-0 h-screen overflow-y-auto">

        {/* Guild Header */}
        <div className="px-6 py-8 border-b border-white/[0.07] bg-white/[0.01]">
          <Link to="/dashboard" className="flex items-center gap-2 text-white/30 hover:text-white text-[10px] font-black uppercase tracking-widest transition-colors mb-6">
            <ArrowLeft size={12} />
            Back to Dashboard
          </Link>

          {loading
            ? <div className="flex items-center gap-4 animate-pulse">
                <div className="w-14 h-14 rounded-2xl bg-white/5" />
                <div className="space-y-2">
                  <div className="h-5 bg-white/5 rounded w-24" />
                  <div className="h-3 bg-white/5 rounded w-16" />
                </div>
              </div>
            : <div className="flex items-center gap-4">
                <img 
                  src={avatarUrl} 
                  alt="" 
                  className="w-14 h-14 rounded-2xl object-cover border border-white/10 shadow-2xl shadow-blue-500/10" 
                />
                <div className="flex flex-col min-w-0">
                  <h2 
                    className="text-base font-black text-white truncate leading-tight tracking-tight"
                    style={guild.name === 'Loading...' ? { textShadow: '2px 2px #5865f2, -2px -2px #57c9a4' } : {}}
                  >
                    {guild.name}
                  </h2>
                  <p className="text-[11px] font-bold text-white/30 mt-1 flex items-center gap-1.5">
                    <Users size={10} />
                    {guild.memberCount.toLocaleString()} members
                  </p>
                </div>
              </div>
          }
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-3 space-y-4 overflow-y-auto">
          {NAV_SECTIONS.map(section => (
            <div key={section.title}>
              <p className="px-3 mb-1 text-[9px] font-bold uppercase tracking-[0.15em] text-white/25">{section.title}</p>
              {section.items.map(({ id, icon: Icon, label, isNew }) => (
                <button
                  key={id}
                  onClick={() => setActiveSection(id)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-xl transition-all ${
                    activeSection === id
                      ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20'
                      : 'text-white/40 hover:text-white/70 hover:bg-white/[0.04]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon size={13} />
                    {label}
                  </div>
                  {isNew && (
                    <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-400 text-[8px] font-black rounded uppercase tracking-tighter">New</span>
                  )}
                </button>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      {/* ══ MAIN ══ */}
      <div className="flex-1 min-w-0 flex flex-col">

        {/* Header */}
        <header className="h-16 shrink-0 border-b border-white/[0.07] bg-[#0d0d0f]/80 backdrop-blur-md flex items-center justify-between px-6 sticky top-0 z-20">
          <div className="flex items-center gap-2 text-xs text-white/40 font-medium">
            <span>Manage</span>
            <ChevronRight size={12} className="text-white/20" />
            <span className="text-white font-bold capitalize">{activeSection}</span>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
              saved
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-blue-500 hover:bg-blue-400 text-white shadow-lg shadow-blue-500/25'
            } disabled:opacity-50`}
          >
            <Save size={12} />
            {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
          </button>
        </header>

        {/* Content */}
        <main className="flex-1 p-6 lg:p-8 max-w-4xl w-full mx-auto">
          <AnimatePresence mode="wait">
            {renderSection()}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
};

export default ManageGuild;