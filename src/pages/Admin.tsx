import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Shield, Users, Globe, BarChart3, ArrowLeft, Search, MoreVertical, ExternalLink } from 'lucide-react';
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

const Admin = () => {
  const { user, isAdmin, isAuthReady } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<AdminStats>({ totalUsers: 0, totalGuilds: 0, activeGuilds: 0 });
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isAuthReady && !isAdmin) {
      navigate('/dashboard');
    }
  }, [isAdmin, isAuthReady, navigate]);

  useEffect(() => {
    if (!isAdmin) return;

    const fetchAdminData = async () => {
      try {
        // Fetch stats
        const usersSnap = await getDocs(collection(db, 'users'));
        const guildsSnap = await getDocs(collection(db, 'guilds'));
        
        setStats({
          totalUsers: usersSnap.size,
          totalGuilds: guildsSnap.size,
          activeGuilds: guildsSnap.docs.filter(d => d.data().active).length
        });

        // Fetch recent users
        const recentUsersQuery = query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(5));
        const recentUsersSnap = await getDocs(recentUsersQuery);
        setRecentUsers(recentUsersSnap.docs.map(d => d.data() as RecentUser));
        
      } catch (error) {
        console.error("Error fetching admin data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAdminData();
  }, [isAdmin]);

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-bg text-white">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border hidden md:flex flex-col bg-surface/50 backdrop-blur-xl sticky top-0 h-screen">
        <div className="p-6">
          <Link to="/" className="flex items-center gap-2 text-xl font-black font-heading tracking-tight">
            <img src={ARVID_ICON_URL} alt="" className="w-8 h-8 rounded-full object-cover border border-border" />
            Arvid Admin
          </Link>
        </div>

        <nav className="flex-1 px-4 py-2 space-y-1">
          <Link to="/dashboard" className="flex items-center gap-3 px-4 py-2 text-sm font-medium text-muted hover:text-white hover:bg-surf2 rounded-xl transition-all">
            <ArrowLeft size={18} />
            Back to Dashboard
          </Link>
          <div className="pt-4 pb-2 px-4 text-[10px] font-bold text-muted uppercase tracking-widest">Management</div>
          <a href="#" className="flex items-center gap-3 px-4 py-2 text-sm font-bold text-white bg-orange-500 rounded-xl shadow-lg shadow-orange-500/20">
            <Shield size={18} />
            Overview
          </a>
          <a href="#" className="flex items-center gap-3 px-4 py-2 text-sm font-medium text-muted hover:text-white hover:bg-surf2 rounded-xl transition-all">
            <Users size={18} />
            User Manager
          </a>
          <a href="#" className="flex items-center gap-3 px-4 py-2 text-sm font-medium text-muted hover:text-white hover:bg-surf2 rounded-xl transition-all">
            <Globe size={18} />
            Guild Manager
          </a>
        </nav>
      </aside>

      <main className="flex-1 min-w-0">
        <header className="h-16 border-b border-border bg-bg/50 backdrop-blur-md flex items-center justify-between px-8 sticky top-0 z-20">
          <div className="flex items-center gap-2 text-sm font-bold text-orange-400">
            <Shield size={16} />
            <span>Admin Control Panel</span>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="px-3 py-1 bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded-lg text-xs font-bold">
              Root Access
            </div>
          </div>
        </header>

        <div className="p-8 max-w-6xl mx-auto">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-10"
          >
            <h1 className="text-3xl font-black font-heading mb-2">Admin Dashboard</h1>
            <p className="text-muted">Global overview of Arvid's performance and user base.</p>
          </motion.div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            <div className="bg-surface border border-border p-6 rounded-3xl">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-400">
                  <Users size={24} />
                </div>
                <div>
                  <p className="text-xs text-muted uppercase tracking-widest font-bold">Total Users</p>
                  <p className="text-2xl font-black font-heading">{loading ? '...' : stats.totalUsers}</p>
                </div>
              </div>
              <div className="h-1 w-full bg-surf2 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500" style={{ width: '70%' }}></div>
              </div>
            </div>

            <div className="bg-surface border border-border p-6 rounded-3xl">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-400">
                  <Globe size={24} />
                </div>
                <div>
                  <p className="text-xs text-muted uppercase tracking-widest font-bold">Total Guilds</p>
                  <p className="text-2xl font-black font-heading">{loading ? '...' : stats.totalGuilds}</p>
                </div>
              </div>
              <div className="h-1 w-full bg-surf2 rounded-full overflow-hidden">
                <div className="h-full bg-purple-500" style={{ width: '45%' }}></div>
              </div>
            </div>

            <div className="bg-surface border border-border p-6 rounded-3xl">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-green-500/10 flex items-center justify-center text-green-400">
                  <BarChart3 size={24} />
                </div>
                <div>
                  <p className="text-xs text-muted uppercase tracking-widest font-bold">Active Guilds</p>
                  <p className="text-2xl font-black font-heading">{loading ? '...' : stats.activeGuilds}</p>
                </div>
              </div>
              <div className="h-1 w-full bg-surf2 rounded-full overflow-hidden">
                <div className="h-full bg-green-500" style={{ width: '85%' }}></div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Recent Users Table */}
            <div className="lg:col-span-2">
              <div className="bg-surface border border-border rounded-[2rem] overflow-hidden">
                <div className="p-6 border-b border-border flex items-center justify-between">
                  <h3 className="font-bold font-heading">Recent Registrations</h3>
                  <button className="text-xs text-accent font-bold hover:underline">View All</button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-widest text-muted border-b border-border">
                        <th className="px-6 py-4 font-bold">User</th>
                        <th className="px-6 py-4 font-bold">Email</th>
                        <th className="px-6 py-4 font-bold">Joined</th>
                        <th className="px-6 py-4 font-bold text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {loading ? (
                        Array.from({ length: 5 }).map((_, i) => (
                          <tr key={i} className="animate-pulse">
                            <td className="px-6 py-4"><div className="h-4 bg-surf2 rounded w-24"></div></td>
                            <td className="px-6 py-4"><div className="h-4 bg-surf2 rounded w-32"></div></td>
                            <td className="px-6 py-4"><div className="h-4 bg-surf2 rounded w-16"></div></td>
                            <td className="px-6 py-4"><div className="h-4 bg-surf2 rounded w-8 ml-auto"></div></td>
                          </tr>
                        ))
                      ) : recentUsers.map((u) => (
                        <tr key={u.uid} className="hover:bg-surf2/50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-[10px] font-bold">
                                {u.displayName[0]}
                              </div>
                              <span className="text-sm font-bold">{u.displayName}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-muted">{u.email}</td>
                          <td className="px-6 py-4 text-sm text-muted">
                            {new Date(u.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button className="text-muted hover:text-white p-1">
                              <MoreVertical size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* System Status */}
            <div className="space-y-6">
              <div className="bg-surface border border-border p-6 rounded-[2rem]">
                <h3 className="font-bold font-heading mb-6">System Status</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm font-medium">API Gateway</span>
                    </div>
                    <span className="text-[10px] font-bold text-green-500 uppercase">Operational</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm font-medium">Firestore DB</span>
                    </div>
                    <span className="text-[10px] font-bold text-green-500 uppercase">Operational</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm font-medium">Discord OAuth</span>
                    </div>
                    <span className="text-[10px] font-bold text-green-500 uppercase">Operational</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
                      <span className="text-sm font-medium">Music Nodes</span>
                    </div>
                    <span className="text-[10px] font-bold text-orange-500 uppercase">High Load</span>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-orange-500 to-orange-700 p-6 rounded-[2rem] text-white shadow-xl shadow-orange-500/20">
                <h3 className="font-bold font-heading mb-2">Admin Notice</h3>
                <p className="text-xs text-white/80 leading-relaxed mb-4">
                  Scheduled maintenance for the music engine is set for April 5th. Please notify users in the support server.
                </p>
                <button className="w-full py-2 bg-white/20 hover:bg-white/30 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2">
                  Broadcast Message
                  <ExternalLink size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Admin;
