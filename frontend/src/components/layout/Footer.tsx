import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  HeartPulse,
  Send,
  ShieldCheck,
  Lock,
  Activity,
  CheckCircle2,
} from 'lucide-react';

export const Footer: React.FC = () => {
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const handleNewsletterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newsletterEmail.trim()) {
      setSubscribed(true);
      setNewsletterEmail('');
    }
  };

  return (
    <footer className="cb-footer">
      <div className="cb-container">
        {/* Main Footer Columns */}
        <div className="cb-footer-grid">
          {/* Brand Info & Mission */}
          <div className="cb-footer-brand-col">
            <Link to="/" className="cb-footer-logo">
              <div className="cb-footer-logo-icon">
                <HeartPulse size={22} strokeWidth={2.4} />
              </div>
              <div className="cb-footer-logo-text">
                <span className="cb-footer-title">CareBridge</span>
                <span className="cb-footer-subtitle">Your Health, Our Care</span>
              </div>
            </Link>
            <p className="cb-footer-desc">
              Making quality healthcare accessible to everyone, anytime, anywhere. Verified clinical specialists,
              cryptographically secured digital prescriptions, and instant video consultations.
            </p>
            <div className="cb-footer-compliance-pill">
              <ShieldCheck size={14} color="#86EFAC" />
              <span>HIPAA-Aligned • End-to-End Encrypted</span>
            </div>
          </div>

          {/* Quick Links */}
          <div className="cb-footer-col">
            <h4 className="cb-footer-col-title">Quick Links</h4>
            <ul className="cb-footer-link-list">
              <li><Link to="/">Home</Link></li>
              <li><Link to="/doctors">Find Doctors</Link></li>
              <li><a href="/#services">Services</a></li>
              <li><a href="/#how-it-works">How It Works</a></li>
              <li><a href="/#about">About Us</a></li>
              <li><a href="/#contact">Contact</a></li>
            </ul>
          </div>

          {/* Our Services */}
          <div className="cb-footer-col">
            <h4 className="cb-footer-col-title">Our Services</h4>
            <ul className="cb-footer-link-list">
              <li><Link to="/doctors">Online Consultation</Link></li>
              <li><Link to="/patient/prescriptions">Digital Prescriptions</Link></li>
              <li><Link to="/patient/consultations">Health Records</Link></li>
              <li><Link to="/doctors?specialty=General">Preventive Care</Link></li>
              <li><Link to="/doctors">Health Packages</Link></li>
            </ul>
          </div>

          {/* Support */}
          <div className="cb-footer-col">
            <h4 className="cb-footer-col-title">Support</h4>
            <ul className="cb-footer-link-list">
              <li><a href="#help">Help Center</a></li>
              <li><a href="#privacy">Privacy Policy</a></li>
              <li><a href="#terms">Terms & Conditions</a></li>
              <li><a href="#contact">Contact Support</a></li>
              <li><a href="#faq">FAQ</a></li>
            </ul>
          </div>

          {/* Newsletter Subscribe */}
          <div className="cb-footer-col cb-footer-newsletter-col">
            <h4 className="cb-footer-col-title">Subscribe to Our Newsletter</h4>
            <p className="cb-newsletter-text">
              Get health tips, doctor availability alerts, and wellness updates straight to your inbox.
            </p>

            {subscribed ? (
              <div className="cb-newsletter-success">
                <CheckCircle2 size={16} /> Thank you for subscribing!
              </div>
            ) : (
              <form onSubmit={handleNewsletterSubmit} className="cb-newsletter-form">
                <input
                  type="email"
                  required
                  placeholder="Enter your email"
                  value={newsletterEmail}
                  onChange={(e) => setNewsletterEmail(e.target.value)}
                  className="cb-newsletter-input"
                />
                <button type="submit" className="cb-newsletter-btn" aria-label="Subscribe to newsletter">
                  <Send size={15} />
                </button>
              </form>
            )}

            <div className="cb-security-badge-row">
              <span className="cb-sec-badge"><Lock size={12} /> Argon2id Auth</span>
              <span className="cb-sec-badge"><Activity size={12} /> Real-time Telemetry</span>
            </div>
          </div>
        </div>

        {/* Footer Bottom Strip */}
        <div className="cb-footer-bottom">
          <p>&copy; {new Date().getFullYear()} CareBridge Telehealth Platform. All rights reserved.</p>
          <div className="cb-footer-legal-links">
            <a href="#privacy">Privacy Policy</a>
            <span>•</span>
            <a href="#terms">Terms of Service</a>
            <span>•</span>
            <a href="#security">Security & Compliance</a>
          </div>
        </div>
      </div>
    </footer>
  );
};
