import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Settings, Music, Shield, BarChart3, Users, ChevronLeft, Save, Bell, MessageSquare, Zap } from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '../AuthContext';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { ARVID_ICON_URL } from '../constants';

interface GuildSettings {
  prefix: string;
  welcomeChannel: string;
  welcomeMessage: string;
  modLogChannel: string;
  autoMod: boolean;
  musicEnabled: boolean;
}

const ManageServer = () => {
  const { guildId } = useParams<{ guildId: string }>();
  const { user, isAuthReady } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [guildInfo, setGuildInfo] = useState<{ name: string; icon: string | null } | null>(null);
  const [settings, setSettings] = useState<GuildSettings>({
    prefix: '!',
    welcomeChannel: '',
    welcomeMessage: 'Welcome to the server, {user}!',
    modLogChannel: '',
    autoMod: true,
    musicEnabled: true,
  });

  useEffect(() => {
    if (!isAuthReady || !user || !guildId) return;

    const fetchSettings = async () => {
      setLoading(true);
      try {
        const guildDoc = await getDoc(doc(db, 'guilds', guildId));
        if (guildDoc.exists()) {
          const data = guildDoc.data();
          setGuildInfo({
            name: data.name || 'Unknown Server',
            icon: data.icon || null,
          });
          
          if (data.settings) {
            setSettings({ ...settings, ...data.settings });
          }
        } else {
          // If guild not found in DB, maybe bot was kicked or DB out of sync
          console.error("Guild not found in database");
          navigate('/dashboard');
        }
      } catch (error) {
        console.error("Error fetching guild settings:", error);
        handleFirestoreError(error, OperationType.GET, `guilds/${guildId}`);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, [guildId, user, isAuthReady, navigate]);

  const handleSave = async () => {
    if (!guildId) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'guilds', guildId), {
        settings: settings,
        updatedAt: new Date().toISOString(),
        updatedBy: user?.uid
      });
      alert("Settings saved successfully!");
    } catch (error) {
      console.error("Error saving settings:", error);
      handleFirestoreError(error, OperationType.UPDATE, `guilds/${guildId}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <div className="w-10 h-10 border-4 border-accent/30 border-t-accent rounded-full animate-spin"></div>
      </div>
    );
  }

  const getIconUrl = () => {
    if (!guildId || !guildInfo?.icon) return null;
    return `https://cdn.discordapp.com/icons/${guildId}/${guildInfo.icon}.png`;
  };

  return (
    <div className="min-h-screen flex bg-bg text-white">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border hidden md:flex flex-col bg-surface/50 backdrop-blur-xl sticky top-0 h-screen">
        <div className="p-6">
          <Link to="/dashboard" className="flex items-center gap-2 text-xl font-black font-heading tracking-tight">
            <img src={ARVID_ICON_URL} alt="" className="w-8 h-8 rounded-full object-cover border border-border" />
            Arvid
          </Link>
        </div>

        <nav className="flex-1 px-4 py-2 space-y-1">
          <Link to="/dashboard" className="flex items-center gap-3 px-4 py-2 text-sm font-medium text-muted hover:text-white hover:bg-surf2 rounded-xl transition-all">
            <LayoutDashboard size={18} />
            Back to Dashboard
          </Link>
          <div className="pt-4 pb-2 px-4 text-[10px] font-bold text-muted uppercase tracking-widest">Server Settings</div>
          <a href="#" className="flex items-center gap-3 px-4 py-2 text-sm font-bold text-white bg-accent rounded-xl shadow-lg shadow-accent/20">
            <Settings size={18} />
            General
          </a>
          <a href="#" className="flex items-center gap-3 px-4 py-2 text-sm font-medium text-muted hover:text-white hover:bg-surf2 rounded-xl transition-all">
            <Bell size={18} />
            Notifications
          </a>
          <a href="#" className="flex items-center gap-3 px-4 py-2 text-sm font-medium text-muted hover:text-white hover:bg-surf2 rounded-xl transition-all">
            <Shield size={18} />
            Moderation
          </a>
          <a href="#" className="flex items-center gap-3 px-4 py-2 text-sm font-medium text-muted hover:text-white hover:bg-surf2 rounded-xl transition-all">
            <Music size={18} />
            Music Bot
          </a>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0">
        <header className="h-16 border-b border-border bg-bg/50 backdrop-blur-md flex items-center justify-between px-8 sticky top-0 z-20">
          <div className="flex items-center gap-4">
            <Link to="/dashboard" className="p-2 hover:bg-surf2 rounded-lg text-muted hover:text-white transition-all">
              <ChevronLeft size={20} />
            </Link>
            <div className="flex items-center gap-3">
              {getIconUrl() ? (
                <img src={getIconUrl()!} alt="" className="w-8 h-8 rounded-lg border border-border" />
              ) : (
                <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center text-xs font-bold">
                  {guildInfo?.name?.[0]}
                </div>
              )}
              <span className="font-bold truncate max-w-[200px]">{guildInfo?.name}</span>
            </div>
          </div>
          
          <button 
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2 bg-accent hover:bg-accent/90 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg shadow-accent/20 transition-all"
          >
            {saving ? 'Saving...' : 'Save Changes'}
            <Save size={16} />
          </button>
        </header>

        <div className="p-8 max-w-4xl mx-auto">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-10"
          >
            <h1 className="text-3xl font-black font-heading mb-2">Server Configuration</h1>
            <p className="text-muted">Customize how Arvid behaves in your server.</p>
          </motion.div>

          <div className="space-y-6">
            {/* General Settings */}
            <div className="bg-surface border border-border rounded-[2rem] p-8">
              <h2 className="text-xl font-bold font-heading mb-6 flex items-center gap-2">
                <Zap size={20} className="text-yellow-400" />
                General Settings
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-muted uppercase tracking-wider">Command Prefix</label>
                  <input 
                    type="text" 
                    value={settings.prefix}
                    onChange={(e) => setSettings({ ...settings, prefix: e.target.value })}
                    className="w-full bg-surf2 border border-border rounded-xl px-4 py-3 focus:border-accent focus:outline-none transition-all"
                    placeholder="!"
                  />
                  <p className="text-[10px] text-muted">The character used to trigger bot commands.</p>
                </div>
              </div>
            </div>

            {/* Welcome Settings */}
            <div className="bg-surface border border-border rounded-[2rem] p-8">
              <h2 className="text-xl font-bold font-heading mb-6 flex items-center gap-2">
                <MessageSquare size={20} className="text-blue-400" />
                Welcome System
              </h2>
              
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-muted uppercase tracking-wider">Welcome Channel ID</label>
                  <input 
                    type="text" 
                    value={settings.welcomeChannel}
                    onChange={(e) => setSettings({ ...settings, welcomeChannel: e.target.value })}
                    className="w-full bg-surf2 border border-border rounded-xl px-4 py-3 focus:border-accent focus:outline-none transition-all"
                    placeholder="123456789012345678"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-bold text-muted uppercase tracking-wider">Welcome Message</label>
                  <textarea 
                    value={settings.welcomeMessage}
                    onChange={(e) => setSettings({ ...settings, welcomeMessage: e.target.value })}
                    className="w-full bg-surf2 border border-border rounded-xl px-4 py-3 focus:border-accent focus:outline-none transition-all min-h-[100px]"
                    placeholder="Welcome to the server, {user}!"
                  />
                  <p className="text-[10px] text-muted">Use {"{user}"} to mention the new member.</p>
                </div>
              </div>
            </div>

            {/* Feature Toggles */}
            <div className="bg-surface border border-border rounded-[2rem] p-8">
              <h2 className="text-xl font-bold font-heading mb-6 flex items-center gap-2">
                <Shield size={20} className="text-green-400" />
                Feature Toggles
              </h2>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-surf2 rounded-2xl border border-border">
                  <div>
                    <h4 className="font-bold">Auto-Moderation</h4>
                    <p className="text-xs text-muted">Automatically filter spam and bad words.</p>
                  </div>
                  <button 
                    onClick={() => setSettings({ ...settings, autoMod: !settings.autoMod })}
                    className={`w-12 h-6 rounded-full transition-all relative ${settings.autoMod ? 'bg-accent' : 'bg-border'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.autoMod ? 'left-7' : 'left-1'}`}></div>
                  </button>
                </div>

                <div className="flex items-center justify-between p-4 bg-surf2 rounded-2xl border border-border">
                  <div>
                    <h4 className="font-bold">Music System</h4>
                    <p className="text-xs text-muted">Allow members to play high-quality music.</p>
                  </div>
                  <button 
                    onClick={() => setSettings({ ...settings, musicEnabled: !settings.musicEnabled })}
                    className={`w-12 h-6 rounded-full transition-all relative ${settings.musicEnabled ? 'bg-accent' : 'bg-border'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.musicEnabled ? 'left-7' : 'left-1'}`}></div>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ManageServer;
