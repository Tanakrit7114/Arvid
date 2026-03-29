import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Settings, Music, Shield, BarChart3, Users, ChevronRight, Plus, LogOut, Star, Trash2, Globe } from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '../AuthContext';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { signOut } from 'firebase/auth';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, updateDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { ARVID_ICON_URL, DISCORD_INVITE_URL } from '../constants';

interface DiscordGuild {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
  features: string[];
  hasBot?: boolean;
}

const Dashboard = () => {
  const { user, isAuthReady, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [discordGuilds, setDiscordGuilds] = useState<DiscordGuild[]>([]);
  const [loading, setLoading] = useState(true);
  const [discordAccessToken, setDiscordAccessToken] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthReady || !user) return;

    const fetchUserTokens = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          if (userData.discordAccessToken) {
            // Check if token is expired
            const now = Date.now();
            if (userData.discordTokenExpiresAt && now > userData.discordTokenExpiresAt) {
              // Refresh token
              await refreshDiscordToken(userData.discordRefreshToken);
            } else {
              setDiscordAccessToken(userData.discordAccessToken);
              fetchDiscordGuilds(userData.discordAccessToken);
            }
          } else {
            setLoading(false);
          }
        } else {
          setLoading(false);
        }
      } catch (error) {
        console.error("Error fetching user tokens:", error);
        setLoading(false);
      }
    };

    fetchUserTokens();
  }, [user, isAuthReady]);

  const refreshDiscordToken = async (refreshToken: string) => {
    try {
      const response = await fetch('/api/auth/discord/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken })
      });

      if (response.ok) {
        const data = await response.json();
        const expiresAt = Date.now() + (data.expires_in * 1000);
        
        // Save to Firestore
        await updateDoc(doc(db, 'users', user!.uid), {
          discordAccessToken: data.access_token,
          discordRefreshToken: data.refresh_token,
          discordTokenExpiresAt: expiresAt
        });

        setDiscordAccessToken(data.access_token);
        fetchDiscordGuilds(data.access_token);
      } else {
        console.error("Failed to refresh Discord token");
        setLoading(false);
      }
    } catch (error) {
      console.error("Error refreshing Discord token:", error);
      setLoading(false);
    }
  };

  const fetchDiscordGuilds = async (token: string) => {
    setLoading(true);
    try {
      const response = await fetch('/api/discord/guilds', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setDiscordGuilds(data);
      } else if (response.status === 401) {
        // Token might have just expired, try to refresh if we have a refresh token
        const userDoc = await getDoc(doc(db, 'users', user!.uid));
        if (userDoc.exists() && userDoc.data().discordRefreshToken) {
          await refreshDiscordToken(userDoc.data().discordRefreshToken);
        } else {
          setDiscordAccessToken(null);
        }
      }
    } catch (error) {
      console.error("Failed to fetch Discord guilds:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnectDiscord = async () => {
    try {
      const response = await fetch('/api/auth/discord/url');
      const { url } = await response.json();
      
      const width = 600;
      const height = 750;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      
      const authWindow = window.open(
        url,
        'discord_auth',
        `width=${width},height=${height},left=${left},top=${top}`
      );

      if (!authWindow) {
        alert("Please allow popups to connect your Discord account.");
        return;
      }

      const handleMessage = async (event: MessageEvent) => {
        if (event.data?.type === 'DISCORD_AUTH_SUCCESS') {
          const { accessToken, refreshToken, expiresIn, discordId } = event.data;
          const expiresAt = Date.now() + (expiresIn * 1000);

          // Save to Firestore
          try {
            await updateDoc(doc(db, 'users', user!.uid), {
              discordAccessToken: accessToken,
              discordRefreshToken: refreshToken,
              discordTokenExpiresAt: expiresAt,
              discordId: discordId
            });
            
            setDiscordAccessToken(accessToken);
            fetchDiscordGuilds(accessToken);
          } catch (error) {
            handleFirestoreError(error, OperationType.UPDATE, `users/${user!.uid}`);
          }

          window.removeEventListener('message', handleMessage);
        }
      };

      window.addEventListener('message', handleMessage);
    } catch (error) {
      console.error("Failed to start Discord OAuth:", error);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setDiscordAccessToken(null);
    navigate('/');
  };

  const getGuildIconUrl = (guild: DiscordGuild) => {
    if (!guild.icon) return null;
    return `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`;
  };

  return (
    <div className="min-h-screen flex bg-bg">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border hidden md:flex flex-col bg-surface/50 backdrop-blur-xl sticky top-0 h-screen">
        <div className="p-6">
          <Link to="/" className="flex items-center gap-2 text-xl font-black font-heading tracking-tight">
            <img src={ARVID_ICON_URL} alt="" className="w-8 h-8 rounded-full object-cover border border-border" />
            Arvid
          </Link>
        </div>

        <nav className="flex-1 px-4 py-2 space-y-1">
          <a href="#" className="flex items-center gap-3 px-4 py-2 text-sm font-bold text-white bg-accent rounded-xl shadow-lg shadow-accent/20">
            <LayoutDashboard size={18} />
            Dashboard
          </a>
          <a href="#" className="flex items-center gap-3 px-4 py-2 text-sm font-medium text-muted hover:text-white hover:bg-surf2 rounded-xl transition-all">
            <BarChart3 size={18} />
            Analytics
          </a>
          <a href="#" className="flex items-center gap-3 px-4 py-2 text-sm font-medium text-muted hover:text-white hover:bg-surf2 rounded-xl transition-all">
            <Settings size={18} />
            Global Settings
          </a>
          {isAdmin && (
            <Link to="/admin" className="flex items-center gap-3 px-4 py-2 text-sm font-medium text-orange-400 hover:text-white hover:bg-orange-500/10 rounded-xl transition-all">
              <Shield size={18} />
              Admin Board
            </Link>
          )}
        </nav>

        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3 p-3 bg-surf2 rounded-2xl border border-border">
            {user?.photoURL ? (
              <img src={user.photoURL} alt="" className="w-10 h-10 rounded-full" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center font-bold text-white">
                {user?.displayName?.[0] || user?.email?.[0] || 'U'}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate text-white">{user?.displayName || 'User'}</p>
              <p className="text-[10px] text-muted uppercase tracking-wider">Member</p>
            </div>
            <button 
              onClick={handleLogout}
              className="text-muted hover:text-red-400 transition-colors"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0">
        <header className="h-16 border-b border-border bg-bg/50 backdrop-blur-md flex items-center justify-between px-8 sticky top-0 z-20">
          <div className="flex items-center gap-2 text-sm font-bold text-muted">
            <LayoutDashboard size={16} />
            <span>Select a Server</span>
          </div>
          
          <div className="flex items-center gap-4">
            {!discordAccessToken ? (
              <button 
                onClick={handleConnectDiscord}
                className="flex items-center gap-2 px-4 py-1.5 text-xs font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-lg hover:bg-blue-500/20 transition-all"
              >
                <Globe size={14} />
                Connect Discord
              </button>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1 bg-green-500/10 text-green-400 border border-green-500/20 rounded-lg text-xs font-bold">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                Discord Connected
              </div>
            )}
          </div>
        </header>

        <div className="p-8 max-w-6xl mx-auto">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-10"
          >
            <h1 className="text-3xl font-black font-heading mb-2">Welcome back, {user?.displayName || 'User'}!</h1>
            <p className="text-muted">Manage your Discord servers and configure Arvid's features.</p>
          </motion.div>

          {!discordAccessToken ? (
            <div className="bg-surface border border-border rounded-[2rem] p-12 text-center">
              <div className="w-20 h-20 bg-blue-500/10 rounded-3xl flex items-center justify-center text-blue-400 mx-auto mb-6">
                <Users size={40} />
              </div>
              <h2 className="text-2xl font-bold font-heading mb-4">Connect your Discord account</h2>
              <p className="text-muted max-w-md mx-auto mb-8">
                To manage your servers, we need to see which servers you have permissions for.
              </p>
              <button 
                onClick={handleConnectDiscord}
                className="px-8 py-3 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-full shadow-lg shadow-blue-500/40 transition-all"
              >
                Connect Discord Account
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="bg-surface border border-border rounded-3xl p-6 animate-pulse">
                    <div className="w-16 h-16 rounded-2xl bg-surf2 mb-6"></div>
                    <div className="h-6 bg-surf2 rounded w-3/4 mb-2"></div>
                    <div className="h-4 bg-surf2 rounded w-1/2 mb-6"></div>
                    <div className="h-10 bg-surf2 rounded-2xl w-full"></div>
                  </div>
                ))
              ) : discordGuilds.length === 0 ? (
                <div className="col-span-full py-20 text-center">
                  <p className="text-muted">No manageable servers found. Make sure you have "Manage Server" permissions.</p>
                </div>
              ) : (
                discordGuilds.map((server, i) => (
                  <motion.div 
                    key={server.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    whileHover={{ y: -5 }}
                    className="bg-surface border border-border rounded-3xl p-6 hover:border-accent transition-all group relative"
                  >
                    <div className="flex items-start justify-between mb-6">
                      {getGuildIconUrl(server) ? (
                        <img 
                          src={getGuildIconUrl(server)!} 
                          alt="" 
                          className="w-16 h-16 rounded-2xl border border-border object-cover" 
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-2xl bg-surf2 border border-border flex items-center justify-center text-xl font-black text-accent group-hover:bg-accent group-hover:text-white transition-all">
                          {server.name.split(' ').map(n => n[0]).join('')}
                        </div>
                      )}
                      <div className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-accent/10 text-accent border border-accent/20">
                        Manageable
                      </div>
                    </div>

                    <h3 className="text-xl font-bold font-heading mb-1 truncate">{server.name}</h3>
                    <p className="text-sm text-muted mb-6 flex items-center gap-2">
                      ID: {server.id}
                    </p>

                    <div className="flex gap-2">
                      {server.hasBot ? (
                        <Link 
                          to={`/manage/${server.id}`}
                          className="flex-1 py-3 bg-accent text-white border border-accent rounded-2xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-accent/90 transition-all shadow-lg shadow-accent/20"
                        >
                          Manage Server
                          <Settings size={16} />
                        </Link>
                      ) : (
                        <a 
                          href={`${DISCORD_INVITE_URL}&guild_id=${server.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 py-3 bg-surf2 border border-border rounded-2xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-accent hover:text-white hover:border-accent transition-all"
                        >
                          Invite Bot
                          <Plus size={16} />
                        </a>
                      )}
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          )}

          {/* Quick Stats */}
          <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-surface border border-border p-8 rounded-[2rem]">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold font-heading flex items-center gap-2">
                  <BarChart3 size={18} className="text-accent" />
                  Global Activity
                </h3>
                <span className="text-xs text-muted">Last 24h</span>
              </div>
              <div className="h-32 flex items-end gap-2">
                {[40, 70, 45, 90, 65, 80, 50, 85, 60, 95, 75, 100].map((h, i) => (
                  <div key={i} className="flex-1 bg-accent/20 rounded-t-sm hover:bg-accent transition-colors" style={{ height: `${h}%` }}></div>
                ))}
              </div>
            </div>

            <div className="bg-surface border border-border p-8 rounded-[2rem] flex flex-col justify-center">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-orange-500/10 flex items-center justify-center text-orange-400">
                  <Star size={24} />
                </div>
                <div>
                  <h3 className="font-bold font-heading">Premium Status</h3>
                  <p className="text-xs text-muted">Your subscription is active until 2027</p>
                </div>
              </div>
              <button className="w-full py-3 bg-gradient-to-r from-orange-400 to-orange-600 text-white font-bold rounded-2xl shadow-lg shadow-orange-500/20">
                Manage Subscription
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
