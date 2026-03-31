import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Shield, Users, Globe, BarChart3,
  ArrowLeft, MoreVertical, ExternalLink, Activity, Zap
} from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '../AuthContext';
import { db } from '../firebase';
import { collection, getDocs, query, limit, orderBy } from 'firebase/firestore';
import { ARVID_ICON_URL } from '../constants';

interface AdminStats {
  totalUsers: number;
  totalGuilds: number;
  activeGuilds: number;
}

interface RecentUser {
  uid: string;
  email: string;
  displayName: string;
  createdAt: string;
}

const STATUS_ITEMS = [
  { label: 'API Gateway',    status: 'Operational', color: 'bg-emerald-500', text: 'text-emerald-400' },
  { label: 'Firestore DB',   status: 'Operational', color: 'bg-emerald-500', text: 'text-emerald-400' },
  { label: 'Discord OAuth',  status: 'Operational', color: 'bg-emerald-500', text: 'text-emerald-400' },
  { label: 'Music Nodes',    status: 'High Load',   color: 'bg-orange-500 animate-pulse', text: 'text-orange-400' },
];

const NAV_ITEMS = [
  { icon: Shield, label: 'Overview',      active: true  },
  { icon: Users,  label: 'User Manager',  active: false },
  { icon: Globe,  label: 'Guild Manager', active: false },
];

/* ─── Skeleton row ─── */
const SkeletonRow = () => (
  <tr className="animate-pulse border-b border-white/5">
    {[32, 40, 20, 8].map((w, i) => (
      <td key={i} className="px-6 py-4">
        <div className={`h-3 bg-white/10 rounded-full`} style={{ width: `${w * 4}px`, marginLeft: i === 3 ? 'auto' : 0 }} />
      </td>
    ))}
  </tr>
);

/* ─── Stat Card ─── */
const StatCard = ({
  icon: Icon, label, value, loading, accent, bar,
}: {
  icon: React.ElementType; label: string; value: number; loading: boolean;
  accent: string; bar: string;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-white/[0.04] border border-white/[0.08] p-6 rounded-2xl flex flex-col gap-4 hover:bg-white/[0.06] transition-colors"
  >
    <div className="flex items-start justify-between">
      <div className={`w-11 h-11 rounded-xl ${accent} flex items-center justify-center`}>
        <Icon size={20} />
      </div>
      <Activity size={14} className="text-white/20 mt-1" />
    </div>
    <div>
      <p className="text-[11px] uppercase tracking-widest font-semibold text-white/40 mb-1">{label}</p>
      <p className="text-3xl font-black tabular-nums">
        {loading ? <span className="inline-block w-12 h-7 bg-white/10 rounded animate-pulse" /> : value}
      </p>
    </div>
    <div className="h-1 w-full bg-white/[0.06] rounded-full overflow-hidden">
      <motion.div
        className={`h-full ${bar} rounded-full`}
        initial={{ width: 0 }}
        animate={{ width: loading ? '20%' : '70%' }}
        transition={{ duration: 0.8, ease: 'easeOut', delay: 0.3 }}
      />
    </div>
  </motion.div>
);

/* ═══════════════════════════════════════════════ */
const Admin = () => {
  const { user, isAdmin, isAuthReady } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats]           = useState<AdminStats>({ totalUsers: 0, totalGuilds: 0, activeGuilds: 0 });
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([]);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    if (isAuthReady && !isAdmin) navigate('/dashboard');
  }, [isAdmin, isAuthReady, navigate]);

  useEffect(() => {
    if (!isAdmin) return;
    const fetchAdminData = async () => {
      try {
        const usersSnap  = await getDocs(collection(db, 'users'));
        const guildsSnap = await getDocs(collection(db, 'guilds'));
        setStats({
          totalUsers:   usersSnap.size,
          totalGuilds:  guildsSnap.size,
          activeGuilds: guildsSnap.docs.filter(d => d.data().active).length,
        });
        const q    = query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(5));
        const snap = await getDocs(q);
        setRecentUsers(snap.docs.map(d => d.data() as RecentUser));
      } catch (e) {
        console.error('Error fetching admin data:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchAdminData();
  }, [isAdmin]);

  if (!isAdmin) return null;

  return (
    /* ── ① ห่อด้วย flex เพื่อให้ sidebar + main อยู่แถวเดียวกัน ── */
    <div className="flex min-h-screen bg-[#0d0d0f] text-white">
      {/* ══ SIDEBAR ══ */}
      <aside className="hidden md:flex w-72 shrink-0 flex-col border-r border-white/[0.07] bg-[#0d0d0f] sticky top-0 h-screen overflow-y-auto">
        {/* Logo */}
        <div className="px-6 h-16 flex items-center border-b border-white/[0.07]">
          <Link to="/" className="flex items-center gap-3">
            <img src={ARVID_ICON_URL} alt="Arvid" className="w-8 h-8 rounded-full object-cover border border-white/10" />
            <span className="text-sm font-black tracking-tight uppercase">Arvid <span className="text-orange-400">Admin</span></span>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-4 py-6 space-y-1">
          <Link
            to="/dashboard"
            className="flex items-center gap-3 px-4 py-2.5 text-xs font-medium text-white/40 hover:text-white/70 hover:bg-white/[0.04] rounded-xl transition-all mb-4"
          >
            <ArrowLeft size={16} />
            Back to Dashboard
          </Link>

          <div className="pb-2 px-4 text-[10px] font-bold text-white/25 uppercase tracking-[0.2em]">
            Management
          </div>

          {NAV_ITEMS.map(({ icon: Icon, label, active }) => (
            <button
              key={label}
              className={`w-full flex items-center gap-3 px-4 py-3 text-xs font-semibold rounded-xl transition-all ${
                active
                  ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20 shadow-[0_0_20px_rgba(249,115,22,0.1)]'
                  : 'text-white/40 hover:text-white/70 hover:bg-white/[0.04]'
              }`}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </nav>

        {/* Bottom badge */}
        <div className="px-6 py-6 border-t border-white/[0.07]">
          <div className="flex items-center gap-3 px-4 py-3 bg-orange-500/10 border border-orange-500/20 rounded-xl">
            <Zap size={14} className="text-orange-400" />
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-orange-400 uppercase tracking-wider">Root Access</span>
              <span className="text-[9px] text-orange-400/60">System Administrator</span>
            </div>
          </div>
        </div>
      </aside>

      {/* ══ MAIN ══ */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Header */}
        <header className="h-16 shrink-0 border-b border-white/[0.07] bg-[#0d0d0f]/80 backdrop-blur-md flex items-center justify-between px-8 sticky top-0 z-20">
          <div className="flex items-center gap-2.5 text-xs font-bold text-orange-400 uppercase tracking-widest">
            <Shield size={14} />
            Control Panel
          </div>
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-end">
              <span className="text-[11px] font-bold text-white tracking-tight">
                {user?.displayName || 'Admin'}
              </span>
              <span className="text-[9px] font-bold text-white/30 uppercase tracking-widest">
                {user?.email}
              </span>
            </div>
            <div className="w-8 h-8 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-orange-400 text-xs font-black">
              {user?.displayName?.[0] || user?.email?.[0] || 'A'}
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-8 lg:p-12 max-w-7xl w-full mx-auto">
          {/* Page title */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
            <h1 className="text-3xl font-black tracking-tight mb-2">System Overview</h1>
            <p className="text-sm text-white/35">Real-time monitoring and global management of the Arvid ecosystem.</p>
          </motion.div>

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-10">
            <StatCard icon={Users}    label="Total Users"   value={stats.totalUsers}   loading={loading} accent="bg-blue-500/10 text-blue-400"   bar="bg-blue-500" />
            <StatCard icon={Globe}    label="Total Guilds"  value={stats.totalGuilds}  loading={loading} accent="bg-purple-500/10 text-purple-400" bar="bg-purple-500" />
            <StatCard icon={BarChart3} label="Active Guilds" value={stats.activeGuilds} loading={loading} accent="bg-emerald-500/10 text-emerald-400" bar="bg-emerald-500" />
          </div>

          {/* Lower grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Recent Users Table */}
            <motion.div
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              className="lg:col-span-2 bg-white/[0.02] border border-white/[0.07] rounded-3xl overflow-hidden"
            >
              <div className="px-8 py-5 border-b border-white/[0.07] flex items-center justify-between bg-white/[0.01]">
                <h3 className="text-sm font-bold uppercase tracking-wider">Recent Registrations</h3>
                <button className="text-xs text-orange-400 font-bold hover:text-orange-300 transition-colors">
                  View All
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-white/[0.05] bg-white/[0.01]">
                      {['User', 'Email', 'Joined', ''].map((h, i) => (
                        <th key={i} className={`px-8 py-4 text-[10px] uppercase tracking-[0.15em] font-bold text-white/25 ${i === 3 ? 'text-right' : ''}`}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {loading
                      ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
                      : recentUsers.map(u => (
                        <tr key={u.uid} className="border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors group">
                          <td className="px-8 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400 flex items-center justify-center text-[11px] font-black shrink-0">
                                {u.displayName?.[0]?.toUpperCase() ?? '?'}
                              </div>
                              <span className="text-xs font-bold">{u.displayName}</span>
                            </div>
                          </td>
                          <td className="px-8 py-4 text-xs text-white/40">{u.email}</td>
                          <td className="px-8 py-4 text-xs text-white/40">
                            {new Date(u.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}
                          </td>
                          <td className="px-8 py-4 text-right">
                            <button className="opacity-0 group-hover:opacity-100 text-white/30 hover:text-white transition-all p-1.5 rounded-lg hover:bg-white/5">
                              <MoreVertical size={14} />
                            </button>
                          </td>
                        </tr>
                      ))
                    }
                  </tbody>
                </table>
              </div>
            </motion.div>

            {/* Right column */}
            <motion.div
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              className="flex flex-col gap-6"
            >
              {/* System Status */}
              <div className="bg-white/[0.02] border border-white/[0.07] rounded-3xl p-6">
                <h3 className="text-sm font-bold mb-6 uppercase tracking-wider">System Health</h3>
                <div className="space-y-4">
                  {STATUS_ITEMS.map(({ label, status, color, text }) => (
                    <div key={label} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${color} shadow-[0_0_8px_rgba(16,185,129,0.4)] shrink-0`} />
                        <span className="text-xs font-bold text-white/70">{label}</span>
                      </div>
                      <span className={`text-[10px] font-black uppercase tracking-widest ${text}`}>{status}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Admin Notice */}
              <div className="bg-gradient-to-br from-orange-500 to-orange-600 border border-orange-400/30 p-6 rounded-3xl shadow-xl shadow-orange-900/20 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-white/20 transition-all duration-500" />
                <div className="relative z-10">
                  <div className="flex items-center gap-2.5 mb-3">
                    <Zap size={14} className="text-white" />
                    <h3 className="text-sm font-black uppercase tracking-tight">Admin Notice</h3>
                  </div>
                  <p className="text-xs text-white/80 leading-relaxed mb-6 font-medium">
                    Scheduled maintenance for the music engine is set for April 5th. Please notify users in the support server.
                  </p>
                  <button className="w-full py-3 bg-black/20 hover:bg-black/30 border border-white/10 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2">
                    Broadcast
                    <ExternalLink size={12} />
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Admin;