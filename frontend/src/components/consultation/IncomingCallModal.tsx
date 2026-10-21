import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Video, PhoneOff, Shield, Sparkles } from 'lucide-react';
import { useAuth } from '@/app/providers/AuthContext';
import { consultationsApi } from '@/lib/api/consultations.api';

export interface ActiveCallData {
  consultationId: string;
  callerId: string;
  callerName: string;
  callerRole: string;
  patientId: string;
  patientEmail: string;
  patientName: string;
  status: 'RINGING' | 'ACCEPTED' | 'REJECTED' | 'ENDED';
  reason: string;
  startedAt: number;
}

export const IncomingCallModal: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [activeCall, setActiveCall] = useState<ActiveCallData | null>(null);
  const [declinedCalls, setDeclinedCalls] = useState<Set<string>>(new Set());

  // Web Audio Ringtone references
  const audioContextRef = useRef<AudioContext | null>(null);
  const ringtoneIntervalRef = useRef<any>(null);

  // Request browser Notification permission quietly on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      try {
        Notification.requestPermission();
      } catch {
        // Safe catch
      }
    }
  }, []);

  const triggerBrowserNotification = (call: ActiveCallData) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        const notif = new Notification(`Incoming Video Call • ${call.callerName}`, {
          body: `Consultation: ${call.reason || 'Digestive inflammation & dietary routine evaluation'}`,
          icon: '/favicon.ico',
          tag: `call-${call.consultationId}`,
        });
        notif.onclick = () => {
          window.focus();
          handleAccept();
        };
      } catch {
        // Notification catch
      }
    }
  };

  // Play a pleasant, modern telemedicine incoming call chime
  const startRingtone = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioCtx();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const playChimeBurst = () => {
        if (!audioContextRef.current || audioContextRef.current.state === 'closed') return;
        const now = ctx.currentTime;

        // Tone 1: 440 Hz (A4)
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(440, now);
        gain1.gain.setValueAtTime(0, now);
        gain1.gain.linearRampToValueAtTime(0.12, now + 0.05);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(now);
        osc1.stop(now + 0.65);

        // Tone 2: 554.37 Hz (C#5) harmonious interval
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(554.37, now + 0.12);
        gain2.gain.setValueAtTime(0, now + 0.12);
        gain2.gain.linearRampToValueAtTime(0.14, now + 0.18);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.85);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(now + 0.12);
        osc2.stop(now + 0.9);
      };

      playChimeBurst();
      ringtoneIntervalRef.current = setInterval(playChimeBurst, 2200);
    } catch {
      // Audio autoplay restrictions fallback
    }
  };

  const stopRingtone = () => {
    if (ringtoneIntervalRef.current) {
      clearInterval(ringtoneIntervalRef.current);
      ringtoneIntervalRef.current = null;
    }
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch {
        // Safe catch
      }
      audioContextRef.current = null;
    }
  };

  // Poll for active calls
  useEffect(() => {
    // If the current tab is the doctor initiating on a doctor page, do not self-ring
    if (user?.role === 'DOCTOR' && location.pathname.startsWith('/doctor')) {
      setActiveCall(null);
      stopRingtone();
      return;
    }

    // If already in a call room, suppress incoming modal
    if (location.pathname.includes('/call')) {
      setActiveCall(null);
      stopRingtone();
      return;
    }

    let isMounted = true;

    // Cross-tab broadcast channel for instant notifications in same browser
    const bc = new BroadcastChannel('carebridge_active_calls');
    bc.onmessage = (e) => {
      if (!isMounted) return;
      const { type, call } = e.data;
      if (type === 'incoming_call' && call) {
        if (!declinedCalls.has(call.consultationId)) {
          setActiveCall(call);
          startRingtone();
          triggerBrowserNotification(call);
        }
      } else if (type === 'call_ended' || type === 'call_accepted') {
        setActiveCall(null);
        stopRingtone();
      }
    };

    const checkActiveCall = async () => {
      try {
        const res = await consultationsApi.getActiveCall();
        if (!isMounted) return;

        const call = res.data?.activeCall;
        if (call && call.status === 'RINGING') {
          if (!declinedCalls.has(call.consultationId) && !location.pathname.includes(call.consultationId)) {
            if (!activeCall || activeCall.consultationId !== call.consultationId) {
              setActiveCall(call);
              startRingtone();
              triggerBrowserNotification(call);
            }
          }
        } else {
          if (activeCall) {
            setActiveCall(null);
            stopRingtone();
          }
        }
      } catch {
        // Polling silent catch
      }
    };

    checkActiveCall();
    const interval = setInterval(checkActiveCall, 2000);

    return () => {
      isMounted = false;
      clearInterval(interval);
      bc.close();
      stopRingtone();
    };
  }, [user?.role, location.pathname, declinedCalls, activeCall]);

  const handleAccept = async () => {
    if (!activeCall) return;
    stopRingtone();
    const cid = activeCall.consultationId;
    try {
      await consultationsApi.respondToCall(cid, 'ACCEPT');
      const bc = new BroadcastChannel('carebridge_active_calls');
      bc.postMessage({ type: 'call_accepted', consultationId: cid });
      bc.close();
    } catch {
      // Proceed to room
    }
    setActiveCall(null);
    navigate(`/consultations/${cid}/call`);
  };

  const handleDecline = async () => {
    if (!activeCall) return;
    stopRingtone();
    const cid = activeCall.consultationId;
    setDeclinedCalls((prev) => new Set(prev).add(cid));
    try {
      await consultationsApi.respondToCall(cid, 'REJECT');
      const bc = new BroadcastChannel('carebridge_active_calls');
      bc.postMessage({ type: 'call_ended', consultationId: cid });
      bc.close();
    } catch {
      // Silent catch
    }
    setActiveCall(null);
  };

  if (!activeCall) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
        padding: '1rem',
        animation: 'cbFadeIn 250ms ease-out',
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: '24px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(11, 93, 59, 0.1)',
          maxWidth: '440px',
          width: '100%',
          overflow: 'hidden',
          textAlign: 'center',
          animation: 'cbScaleUp 280ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Animated Top Header Banner */}
        <div
          style={{
            background: 'linear-gradient(135deg, #0B5D3B 0%, #155E54 100%)',
            padding: '2.5rem 1.5rem 2rem 1.5rem',
            color: '#ffffff',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Pulsating Radar Rings */}
          <div
            style={{
              position: 'relative',
              width: '92px',
              height: '92px',
              margin: '0 auto 1.25rem auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              className="cb-ring-pulse-1"
              style={{
                position: 'absolute',
                inset: '-10px',
                borderRadius: '50%',
                border: '2px solid rgba(52, 211, 153, 0.6)',
                animation: 'cbPulseRing 1.8s infinite ease-out',
              }}
            />
            <div
              className="cb-ring-pulse-2"
              style={{
                position: 'absolute',
                inset: '-20px',
                borderRadius: '50%',
                border: '1.5px solid rgba(52, 211, 153, 0.35)',
                animation: 'cbPulseRing 1.8s infinite ease-out 0.4s',
              }}
            />
            <div
              style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                backgroundColor: '#ffffff',
                color: '#0B5D3B',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '1.75rem',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)',
                position: 'relative',
                zIndex: 2,
              }}
            >
              DR
            </div>
          </div>

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(255, 255, 255, 0.2)',
              padding: '4px 12px',
              borderRadius: '9999px',
              fontSize: '0.75rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginBottom: '0.75rem',
            }}
          >
            <Sparkles size={12} /> Incoming Video Consultation
          </div>

          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0 0 0.35rem 0', color: '#ffffff' }}>
            {activeCall.callerName}
          </h2>
          <p style={{ fontSize: '0.875rem', color: '#d1fae5', margin: 0, opacity: 0.9 }}>
            Specialist Doctor • CareBridge Telehealth
          </p>
        </div>

        {/* Call Info Content */}
        <div style={{ padding: '1.75rem 1.75rem 2rem 1.75rem' }}>
          <div
            style={{
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '14px',
              padding: '1rem 1.25rem',
              marginBottom: '1.75rem',
              textAlign: 'left',
            }}
          >
            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>
              Consultation Topic
            </div>
            <div style={{ fontSize: '0.925rem', fontWeight: 600, color: '#1e293b' }}>
              {activeCall.reason || 'Digestive inflammation & dietary routine evaluation'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px', fontSize: '0.75rem', color: '#166534' }}>
              <Shield size={13} />
              <span>Peer-to-Peer Encrypted • Telemedicine Practice Standards</span>
            </div>
          </div>

          {/* Action Buttons: Accept & Decline */}
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <button
              type="button"
              onClick={handleDecline}
              style={{
                flex: 1,
                padding: '12px 18px',
                borderRadius: '12px',
                backgroundColor: '#fee2e2',
                color: '#b91c1c',
                border: '1px solid #fca5a5',
                fontSize: '0.9375rem',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                cursor: 'pointer',
                transition: 'all 0.18s ease',
              }}
            >
              <PhoneOff size={18} />
              <span>Decline</span>
            </button>

            <button
              type="button"
              onClick={handleAccept}
              style={{
                flex: 1.5,
                padding: '12px 20px',
                borderRadius: '12px',
                backgroundColor: '#10b981',
                color: '#ffffff',
                border: 'none',
                fontSize: '0.9375rem',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)',
                transition: 'all 0.18s ease',
              }}
            >
              <Video size={18} />
              <span>Accept Call</span>
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes cbPulseRing {
          0% {
            transform: scale(0.95);
            opacity: 0.8;
          }
          50% {
            transform: scale(1.18);
            opacity: 0.3;
          }
          100% {
            transform: scale(1.35);
            opacity: 0;
          }
        }
        @keyframes cbFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes cbScaleUp {
          from { opacity: 0; transform: scale(0.92); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
};
