import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Smartphone, 
  Edit3, 
  Check, 
  CheckCircle, 
  RefreshCw, 
  Radio, 
  Layers, 
  AlertCircle 
} from 'lucide-react';
import { 
  AppVersionData, 
  getCachedAppVersion, 
  subscribeToAppVersion, 
  updateAppVersionConfig 
} from '../../utils/versionConfig';

interface AppVersionAdminTabProps {
  adminEmail: string;
}

export const AppVersionAdminTab: React.FC<AppVersionAdminTabProps> = ({ adminEmail }) => {
  const [versionConfig, setVersionConfig] = useState<AppVersionData>(getCachedAppVersion);
  const [versionInput, setVersionInput] = useState(versionConfig.version);
  const [buildNumberInput, setBuildNumberInput] = useState(String(versionConfig.buildNumber));
  const [releaseNotesInput, setReleaseNotesInput] = useState(versionConfig.releaseNotes);
  const [forceUpdateInput, setForceUpdateInput] = useState(!!versionConfig.forceUpdate);
  const [minSupportedInput, setMinSupportedInput] = useState(versionConfig.minSupportedVersion || '1.0.0');
  const [savingVersion, setSavingVersion] = useState(false);
  const [versionSavedSuccess, setVersionSavedSuccess] = useState(false);

  useEffect(() => {
    const unsub = subscribeToAppVersion((data) => {
      setVersionConfig(data);
      setVersionInput(data.version);
      setBuildNumberInput(String(data.buildNumber));
      setReleaseNotesInput(data.releaseNotes);
      setForceUpdateInput(!!data.forceUpdate);
      setMinSupportedInput(data.minSupportedVersion || '1.0.0');
    });
    return () => unsub();
  }, []);

  const bumpVersion = (type: 'patch' | 'minor' | 'major') => {
    const parts = versionInput.split('.').map((n) => parseInt(n, 10) || 0);
    while (parts.length < 3) parts.push(0);
    if (type === 'major') {
      parts[0] += 1;
      parts[1] = 0;
      parts[2] = 0;
    } else if (type === 'minor') {
      parts[1] += 1;
      parts[2] = 0;
    } else {
      parts[2] += 1;
    }
    setVersionInput(parts.join('.'));
    setBuildNumberInput(String(Number(buildNumberInput || 1) + 1));
  };

  const handleSaveVersion = async () => {
    try {
      setSavingVersion(true);
      await updateAppVersionConfig(
        {
          version: versionInput,
          buildNumber: buildNumberInput,
          releaseNotes: releaseNotesInput,
          forceUpdate: forceUpdateInput,
          minSupportedVersion: minSupportedInput,
        },
        adminEmail || 'admin@limochat.app'
      );
      setVersionSavedSuccess(true);
      setTimeout(() => setVersionSavedSuccess(false), 5000);
    } catch (err: any) {
      alert('Failed to update app version: ' + err.message);
    } finally {
      setSavingVersion(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      {/* Header Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-[#00a884]/15 to-transparent border border-emerald-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#005c4b] to-[#00a884] flex items-center justify-center shadow-lg text-white">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span>App Version & OTA Releases</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-semibold border border-emerald-500/30">
                LIVE
              </span>
            </h3>
            <p className="text-xs text-[#8696a0] mt-0.5">
              Change the version number shown on the WhatsApp splash screen and in Settings across all devices in real time.
            </p>
          </div>
        </div>

        <div className="px-4 py-2 rounded-xl bg-[#111b21] border border-emerald-500/30 text-right">
          <div className="text-[10px] uppercase font-bold text-[#8696a0] tracking-wider">Active Public Version</div>
          <div className="text-lg font-mono font-bold text-emerald-400">
            v{versionConfig.version} <span className="text-xs text-[#8696a0]">({versionConfig.buildNumber})</span>
          </div>
        </div>
      </div>

      {/* Success Notification */}
      {versionSavedSuccess && (
        <div className="p-4 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center gap-2.5 animate-bounce">
          <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          <span>
            App version successfully updated to <strong>v{versionConfig.version} (Build {versionConfig.buildNumber})</strong>! Connected devices will now show this on the WhatsApp splash screen and Settings.
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left 2 Cols: Version Editor Form */}
        <div className="md:col-span-2 space-y-5 bg-[#202c33] p-5 rounded-2xl border border-[#2e3b44]">
          <h4 className="text-sm font-semibold text-white flex items-center gap-2">
            <Edit3 className="w-4 h-4 text-[#00a884]" />
            <span>Configure App Version</span>
          </h4>

          {/* Version Number Input + Bump Buttons */}
          <div>
            <label className="text-xs font-semibold text-[#8696a0] uppercase tracking-wider block mb-1.5">
              Version Name (SemVer string)
            </label>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                type="text"
                value={versionInput}
                onChange={(e) => setVersionInput(e.target.value)}
                placeholder="1.0.0"
                className="flex-1 bg-[#111b21] border border-[#2e3b44] rounded-xl px-3.5 py-2.5 text-sm text-white font-mono placeholder-[#8696a0] focus:outline-none focus:border-[#00a884]"
              />
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => bumpVersion('patch')}
                  className="px-2.5 py-2 bg-[#111b21] hover:bg-[#2a3942] border border-[#2e3b44] rounded-lg text-[11px] font-mono text-[#00a884] font-semibold transition cursor-pointer"
                  title="Bump Patch (+0.0.1)"
                >
                  +0.0.1
                </button>
                <button
                  type="button"
                  onClick={() => bumpVersion('minor')}
                  className="px-2.5 py-2 bg-[#111b21] hover:bg-[#2a3942] border border-[#2e3b44] rounded-lg text-[11px] font-mono text-blue-400 font-semibold transition cursor-pointer"
                  title="Bump Minor (+0.1.0)"
                >
                  +0.1.0
                </button>
                <button
                  type="button"
                  onClick={() => bumpVersion('major')}
                  className="px-2.5 py-2 bg-[#111b21] hover:bg-[#2a3942] border border-[#2e3b44] rounded-lg text-[11px] font-mono text-purple-400 font-semibold transition cursor-pointer"
                  title="Bump Major (+1.0.0)"
                >
                  +1.0.0
                </button>
              </div>
            </div>
          </div>

          {/* Build Number & Minimum Required Version */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-[#8696a0] uppercase tracking-wider block mb-1.5">
                Build Code / Number
              </label>
              <input
                type="number"
                value={buildNumberInput}
                onChange={(e) => setBuildNumberInput(e.target.value)}
                placeholder="1"
                className="w-full bg-[#111b21] border border-[#2e3b44] rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-[#00a884]"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-[#8696a0] uppercase tracking-wider block mb-1.5">
                Minimum Supported Version
              </label>
              <input
                type="text"
                value={minSupportedInput}
                onChange={(e) => setMinSupportedInput(e.target.value)}
                placeholder="1.0.0"
                className="w-full bg-[#111b21] border border-[#2e3b44] rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-[#00a884]"
              />
            </div>
          </div>

          {/* Force Update Toggle */}
          <div className="p-3.5 rounded-xl bg-[#111b21] border border-[#2e3b44] flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-white">Require Force Update</div>
              <div className="text-[11px] text-[#8696a0]">
                Show mandatory update dialogue for clients on older builds
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={forceUpdateInput}
                onChange={(e) => setForceUpdateInput(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-10 h-5 bg-[#202c33] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#00a884]"></div>
            </label>
          </div>

          {/* Release Notes */}
          <div>
            <label className="text-xs font-semibold text-[#8696a0] uppercase tracking-wider block mb-1.5">
              Release Notes / Changelog
            </label>
            <textarea
              rows={3}
              value={releaseNotesInput}
              onChange={(e) => setReleaseNotesInput(e.target.value)}
              placeholder="e.g. Added WhatsApp-style splash screen, real-time dynamic versioning, native call push notifications..."
              className="w-full bg-[#111b21] border border-[#2e3b44] rounded-xl p-3 text-xs text-white placeholder-[#8696a0] focus:outline-none focus:border-[#00a884] resize-none"
            />
          </div>

          {/* Submit Button */}
          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              disabled={savingVersion}
              onClick={handleSaveVersion}
              className="px-5 py-2.5 bg-gradient-to-r from-[#00a884] to-[#02906f] hover:brightness-110 text-white font-bold rounded-xl text-xs transition cursor-pointer shadow-lg shadow-[#00a884]/20 flex items-center gap-2 disabled:opacity-50"
            >
              {savingVersion ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Publishing to Cloud...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Publish Version to App</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Col: Android & System Info */}
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-[#202c33] border border-[#2e3b44] space-y-3">
            <h5 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Smartphone className="w-4 h-4 text-[#00a884]" />
              <span>Android App Alignment</span>
            </h5>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between text-[#8696a0] border-b border-[#2e3b44] pb-1.5">
                <span>Application ID:</span>
                <span className="font-mono text-white text-[11px]">com.limochat.app</span>
              </div>
              <div className="flex items-center justify-between text-[#8696a0] border-b border-[#2e3b44] pb-1.5">
                <span>Current Target SDK:</span>
                <span className="font-mono text-white text-[11px]">API 35 (Android 15)</span>
              </div>
              <div className="flex items-center justify-between text-[#8696a0] border-b border-[#2e3b44] pb-1.5">
                <span>Min Android SDK:</span>
                <span className="font-mono text-white text-[11px]">API 24 (Android 7.0+)</span>
              </div>
              <div className="flex items-center justify-between text-[#8696a0]">
                <span>Live Web App URL:</span>
                <span className="font-mono text-emerald-400 text-[11px]">limochat.vercel.app</span>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-[#202c33] border border-[#2e3b44] space-y-2">
            <h5 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Radio className="w-4 h-4 text-blue-400" />
              <span>How Dynamic Versioning Works</span>
            </h5>
            <p className="text-[11px] text-[#8696a0] leading-relaxed">
              When you save a new version here, it updates Firestore at <code className="text-emerald-400">system_config/app_version</code>.
              All active users and installed APKs immediately receive this update in real time on the **WhatsApp Splash Screen** and inside **Settings &gt; App Info**!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
