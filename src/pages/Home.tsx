import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Shield, Music, Star, Gift, BarChart3, Users, Globe, LogIn, Menu, X, LogOut } from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '../AuthContext';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import { ARVID_ICON_URL, DISCORD_INVITE_URL } from '../constants';

const Home = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [lang, setLang] = useState<'th' | 'en'>('th');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [stats, setStats] = useState({ servers: '12,400+', users: '3.2M+', uptime: '99.9%' });

  useEffect(() => {
    const fetchStats = async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout

      try {
        console.log("Fetching stats from /api/stats...");
        const response = await fetch('/api/stats', { signal: controller.signal });
        clearTimeout(timeoutId);
        console.log("Stats response status:", response.status, response.statusText);
        
        if (response.ok) {
          const data = await response.json();
          console.log("Stats data received:", data);
          setStats({
            servers: (data.servers || 12400).toLocaleString() + '+',
            users: ((data.users || 3200000) / 1000000).toFixed(1) + 'M+',
            uptime: (data.uptime || 99.9) + '%'
          });
        } else {
          const text = await response.text();
          console.error("Stats fetch failed with status:", response.status, text);
        }
      } catch (error: any) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
          console.error("Stats fetch timed out after 8s");
        } else {
          console.error("Failed to fetch stats:", error);
        }
        
        // Try a simple ping to see if the server is reachable at all
        try {
          const pingRes = await fetch('/api/ping', { signal: AbortSignal.timeout(3000) });
          console.log("Ping result:", await pingRes.text());
        } catch (pingError) {
          console.error("Ping also failed or timed out:", pingError);
        }
      }
    };
    fetchStats();
  }, []);

  const toggleLang = () => setLang(prev => prev === 'th' ? 'en' : 'th');

  const handleInviteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (user) {
      window.open(DISCORD_INVITE_URL, '_blank', 'noopener,noreferrer');
    } else {
      navigate('/login');
    }
  };

  const handleAuthAction = () => {
    if (user) {
      signOut(auth);
    } else {
      navigate('/login');
    }
  };

  const content = {
    heroSub: {
      th: "บอทอเนกประสงค์อันทรงพลังและปรับแต่งได้สำหรับ",
      en: "A powerful multi-function and configurable bot for"
    },
    heroSubEnd: {
      th: "ของคุณ",
      en: "server."
    },
    whyArvid: {
      th: "ทำไมต้อง Arvid?",
      en: "Why Arvid?"
    },
    featureTitle: {
      th: "ฟีเจอร์ครบจบในบอทเดียว",
      en: "All-in-One Features"
    },
    ctaTitle: {
      th: "พร้อมที่จะอัปเกรดเซิร์ฟเวอร์ของคุณแล้วหรือยัง?",
      en: "Ready to upgrade your server?"
    },
    ctaSub: {
      th: "เพิ่ม Arvid เข้าเซิร์ฟเวอร์ Discord ของคุณได้ฟรีทันที",
      en: "Add Arvid to your Discord server for free, right now."
    }
  };

  const features = [
    {
      icon: <Shield className="text-blue-400" />,
      title: "Auto Moderation",
      desc: {
        th: "ระบบโมเดอเรตอัตโนมัติ กรองสแปม คำหยาบ และลิงก์อันตรายได้แบบเรียลไทม์",
        en: "Auto-moderate spam, profanity, and dangerous links in real time."
      },
      color: "bg-blue-500/10"
    },
    {
      icon: <Music className="text-blue-400" />,
      title: "Music Player",
      desc: {
        th: "เปิดเพลงจาก YouTube, Spotify และ SoundCloud พร้อม queue และ equalizer",
        en: "Play music from YouTube, Spotify & SoundCloud with queue and equalizer."
      },
      color: "bg-blue-500/10"
    },
    {
      icon: <Star className="text-blue-400" />,
      title: "Leveling System",
      desc: {
        th: "ระบบ XP และ rank card สวยงาม กระตุ้นให้สมาชิก engage กับเซิร์ฟเวอร์มากขึ้น",
        en: "XP system with beautiful rank cards to keep members engaged."
      },
      color: "bg-blue-500/10"
    },
    {
      icon: <Gift className="text-blue-400" />,
      title: "Giveaway",
      desc: {
        th: "จัดกิจกรรมแจกของรางวัลได้ง่ายๆ ตั้ง timer และสุ่มผู้ชนะอัตโนมัติ",
        en: "Easily set up giveaways with timers and automatic winner selection."
      },
      color: "bg-blue-500/10"
    },
    {
      icon: <BarChart3 className="text-blue-400" />,
      title: "Statistics",
      desc: {
        th: "ดูสถิติเซิร์ฟเวอร์แบบละเอียด สมาชิกใหม่ ข้อความ และกิจกรรมต่างๆ",
        en: "Detailed server stats: new members, messages, and activity."
      },
      color: "bg-blue-500/10"
    },
    {
      icon: <Users className="text-blue-400" />,
      title: "Role Management",
      desc: {
        th: "ระบบ reaction roles และ auto-role ปรับแต่งบทบาทสมาชิกได้อย่างยืดหยุ่น",
        en: "Reaction roles and auto-role for flexible member management."
      },
      color: "bg-blue-500/10"
    }
  ];

  return (
    <div className="min-h-screen">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-bg/85 backdrop-blur-lg border-b border-border">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-xl font-extrabold font-heading tracking-tight">
            <img 
              src={ARVID_ICON_URL} 
              alt="Arvid" 
              className="w-8 h-8 rounded-full border border-border object-cover"
            />
            Arvid
          </Link>

          {/* Desktop Nav */}
          <div className="hidden lg:flex items-center gap-1">
            <Link to="/dashboard" className="px-3 py-1.5 text-sm font-medium text-muted hover:text-white hover:bg-surf2 rounded-lg transition-colors">Dashboard</Link>
            <button 
              onClick={handleInviteClick}
              className="px-3 py-1.5 text-sm font-medium text-muted hover:text-white hover:bg-surf2 rounded-lg transition-colors cursor-pointer"
            >
              Invite Me
            </button>
            <a href="#" className="px-3 py-1.5 text-sm font-medium text-muted hover:text-white hover:bg-surf2 rounded-lg transition-colors">Join My Server</a>
            <a href="#" className="px-3 py-1.5 text-sm font-medium text-muted hover:text-white hover:bg-surf2 rounded-lg transition-colors">Status</a>
            <a href="#" className="px-3 py-1.5 text-sm font-medium text-muted hover:text-white hover:bg-surf2 rounded-lg transition-colors">Commands</a>
            <div className="ml-2">
              <span className="bg-gradient-to-br from-blue-400 to-blue-600 text-white text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider shadow-[0_0_14px_rgba(88,101,242,0.35)]">
                ✦ Premium
              </span>
            </div>
          </div>

          <div className="hidden lg:flex items-center gap-3">
            <button 
              onClick={toggleLang}
              className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-muted border border-border rounded-lg hover:border-accent hover:text-white transition-all"
            >
              <Globe size={16} />
              <span>{lang.toUpperCase()}</span>
              <span className="text-[10px] opacity-60">▾</span>
            </button>
            
            {user ? (
              <div className="flex items-center gap-3 pl-2 border-l border-border">
                <div className="text-right hidden xl:block">
                  <p className="text-xs font-bold text-white leading-none">{user.displayName || 'User'}</p>
                  <p className="text-[10px] text-muted uppercase tracking-wider mt-1">Online</p>
                </div>
                <Link to="/dashboard" className="relative group">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="" className="w-9 h-9 rounded-full border border-border group-hover:border-accent transition-all" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-accent flex items-center justify-center font-bold text-white border border-border group-hover:border-accent transition-all">
                      {user.displayName?.[0] || user.email?.[0] || 'U'}
                    </div>
                  )}
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-bg rounded-full"></div>
                </Link>
                <button 
                  onClick={handleAuthAction}
                  className="p-2 text-muted hover:text-red-400 transition-colors"
                  title="Logout"
                >
                  <LogOut size={18} />
                </button>
              </div>
            ) : (
              <button 
                onClick={handleAuthAction}
                className="flex items-center gap-2 px-4 py-1.5 text-sm font-medium bg-surf2 border border-border rounded-lg hover:border-accent hover:bg-accent/10 transition-all"
              >
                <LogIn size={16} /> Login
              </button>
            )}
          </div>

          {/* Mobile Menu Toggle */}
          <button 
            className="lg:hidden p-2 text-muted border border-border rounded-lg"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="lg:hidden bg-bg border-b border-border p-4 flex flex-col gap-2"
          >
            <Link to="/dashboard" className="p-2 text-muted hover:text-white hover:bg-surf2 rounded-lg">Dashboard</Link>
            <button 
              onClick={handleInviteClick}
              className="p-2 text-left text-muted hover:text-white hover:bg-surf2 rounded-lg cursor-pointer"
            >
              Invite Me
            </button>
            <a href="#" className="p-2 text-muted hover:text-white hover:bg-surf2 rounded-lg">Join My Server</a>
            <a href="#" className="p-2 text-muted hover:text-white hover:bg-surf2 rounded-lg">Status</a>
            <a href="#" className="p-2 text-muted hover:text-white hover:bg-surf2 rounded-lg">Commands</a>
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-border">
              <button onClick={toggleLang} className="flex items-center gap-2 text-muted">
                <Globe size={18} />
                <span>{lang === 'th' ? 'ภาษาไทย' : 'English'}</span>
              </button>
              
              {user ? (
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-xs font-bold text-white leading-none">{user.displayName || 'User'}</p>
                    <p className="text-[10px] text-muted uppercase tracking-wider mt-1">Online</p>
                  </div>
                  <Link to="/dashboard" className="relative">
                    {user.photoURL ? (
                      <img src={user.photoURL} alt="" className="w-9 h-9 rounded-full border border-border" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-accent flex items-center justify-center font-bold text-white border border-border">
                        {user.displayName?.[0] || user.email?.[0] || 'U'}
                      </div>
                    )}
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-bg rounded-full"></div>
                  </Link>
                  <button 
                    onClick={handleAuthAction}
                    className="p-2 text-muted hover:text-red-400 transition-colors"
                  >
                    <LogOut size={18} />
                  </button>
                </div>
              ) : (
                <button 
                  onClick={handleAuthAction}
                  className="px-4 py-2 bg-accent text-white rounded-lg font-bold"
                >
                  Login
                </button>
              )}
            </div>
          </motion.div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 flex flex-col items-center text-center">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative mb-8 animate-float"
        >
          <div className="w-32 h-32 rounded-full p-1 bg-gradient-to-br from-accent to-accent2 shadow-[0_0_40px_rgba(88,101,242,0.35)]">
            <div className="w-full h-full rounded-full bg-surface overflow-hidden">
              <img 
                src={ARVID_ICON_URL} 
                alt="Arvid Bot" 
                className="w-full h-full object-cover"
              />
            </div>
          </div>
          <div className="absolute bottom-1.5 right-1.5 w-6 h-6 bg-green-500 border-4 border-bg rounded-full"></div>
        </motion.div>

        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-6xl md:text-8xl font-black font-heading tracking-tighter mb-4 bg-gradient-to-br from-white via-blue-200 to-blue-500 bg-clip-text text-transparent"
        >
          Arvid
        </motion.h1>

        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-lg md:text-xl text-muted max-w-2xl px-4 leading-relaxed"
        >
          {content.heroSub[lang]} <strong className="text-accent">Discord</strong> {content.heroSubEnd[lang]}
        </motion.p>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex flex-wrap gap-4 mt-8 justify-center"
        >
          <button 
            onClick={handleInviteClick}
            className="flex items-center gap-2 px-8 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-full transition-all hover:-translate-y-0.5 cursor-pointer"
          >
            <Users size={20} />
            Add to Discord
          </button>
          <Link to="/dashboard" className="flex items-center gap-2 px-8 py-3 bg-accent hover:bg-blue-600 text-white font-bold rounded-full shadow-lg shadow-accent/40 transition-all hover:-translate-y-0.5">
            <BarChart3 size={20} />
            Manage Servers
          </Link>
        </motion.div>
      </section>

      {/* Stats Section */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
            <div className="bg-surface border border-border p-6 rounded-2xl text-center hover:border-accent transition-colors">
              <div className="text-3xl font-black font-heading bg-gradient-to-br from-accent to-accent2 bg-clip-text text-transparent">{stats.servers}</div>
              <div className="text-[10px] uppercase tracking-widest text-muted mt-1">Servers</div>
            </div>
            <div className="bg-surface border border-border p-6 rounded-2xl text-center hover:border-accent transition-colors">
              <div className="text-3xl font-black font-heading bg-gradient-to-br from-accent to-accent2 bg-clip-text text-transparent">{stats.users}</div>
              <div className="text-[10px] uppercase tracking-widest text-muted mt-1">Users</div>
            </div>
            <div className="col-span-2 md:col-span-1 bg-surface border border-border p-6 rounded-2xl text-center hover:border-accent transition-colors">
              <div className="text-3xl font-black font-heading bg-gradient-to-br from-accent to-accent2 bg-clip-text text-transparent">{stats.uptime}</div>
              <div className="text-[10px] uppercase tracking-widest text-muted mt-1">Uptime</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <p className="text-accent2 text-xs font-bold uppercase tracking-[0.2em] mb-2">{content.whyArvid[lang]}</p>
            <h2 className="text-3xl md:text-4xl font-black font-heading">{content.featureTitle[lang]}</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <motion.div 
                key={i}
                whileHover={{ y: -5 }}
                className="bg-surface border border-border p-8 rounded-3xl hover:border-accent hover:shadow-2xl hover:shadow-accent/10 transition-all"
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-6 ${f.color}`}>
                  {f.icon}
                </div>
                <h3 className="text-lg font-bold font-heading mb-2">{f.title}</h3>
                <p className="text-sm text-muted leading-relaxed">
                  {f.desc[lang]}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="bg-gradient-to-br from-accent/20 to-accent2/10 border border-accent/30 rounded-[2rem] p-12 text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_70%_at_50%_50%,rgba(88,101,242,0.07),transparent_70%)]"></div>
            <div className="relative z-10">
              <h2 className="text-3xl md:text-4xl font-black font-heading mb-4">{content.ctaTitle[lang]}</h2>
              <p className="text-muted mb-8">{content.ctaSub[lang]}</p>
              <div className="flex flex-wrap gap-4 justify-center">
                <button 
                  onClick={handleInviteClick}
                  className="flex items-center gap-2 px-8 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-full transition-all cursor-pointer"
                >
                  Add to Discord
                </button>
                <Link to="/dashboard" className="flex items-center gap-2 px-8 py-3 bg-accent hover:bg-blue-600 text-white font-bold rounded-full shadow-lg shadow-accent/40 transition-all">
                  Get Started
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-border mt-10">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex items-center gap-2 text-lg font-black font-heading">
              <div className="w-7 h-7 rounded-full bg-surface border border-border overflow-hidden">
                <img src={ARVID_ICON_URL} alt="" className="w-full h-full object-cover" />
              </div>
              Arvid Bot
            </div>

            <div className="flex flex-wrap justify-center gap-6">
              <a href="#" className="text-sm text-muted hover:text-white transition-colors">Terms of Service</a>
              <a href="#" className="text-sm text-muted hover:text-white transition-colors">Privacy Policy</a>
              <a href="#" className="text-sm text-muted hover:text-white transition-colors">Support Server</a>
              <a href="#" className="text-sm text-muted hover:text-white transition-colors">Blog</a>
            </div>

            <div className="text-sm text-muted">
              © 2026 Arvid Bot. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;
