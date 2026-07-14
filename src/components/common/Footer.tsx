import React, { useEffect, useState } from 'react';
import { 
  MapPin, Phone, Mail, Globe, Clock, 
  Facebook, Youtube, Instagram, MessageCircle, Video 
} from 'lucide-react';
import { CenterInformation } from '../../types';
import { onSnapshot, doc } from 'firebase/firestore';
import { db } from '../../data/firebase';

interface FooterProps {
  centerInformation?: CenterInformation | null;
  language?: 'vi' | 'en';
}

export default function Footer({ centerInformation: propCenterInfo, language = 'vi' }: FooterProps) {
  const [centerInfo, setCenterInfo] = useState<CenterInformation | null>(null);

  // If a prop is passed, use it; otherwise, listen to Firebase Firestore realtime!
  useEffect(() => {
    if (propCenterInfo) {
      setCenterInfo(propCenterInfo);
      return;
    }

    // Try to load initial from localStorage
    const saved = localStorage.getItem('ielts_center_information');
    if (saved) {
      try {
        setCenterInfo(JSON.parse(saved));
      } catch (e) {
        // Fallback
      }
    }

    // Realtime listen
    const unsub = onSnapshot(
      doc(db, 'centerInformation', 'settings'),
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data() as CenterInformation;
          setCenterInfo(data);
          localStorage.setItem('ielts_center_information', JSON.stringify(data));
        }
      },
      (error) => {
        console.error("Error listening to centerInformation inside Footer component:", error);
      }
    );

    return () => unsub();
  }, [propCenterInfo]);

  if (!centerInfo) return null;

  // Check if there is ANY social media presence to show in column 3
  const hasSocial = !!(
    centerInfo.facebook || 
    centerInfo.zalo || 
    centerInfo.youtube || 
    centerInfo.instagram || 
    centerInfo.tiktok
  );

  // Check if there is contact or operating info to show in column 2
  const hasContactInfo = !!(
    centerInfo.address || 
    centerInfo.phone || 
    centerInfo.email || 
    centerInfo.workingHours
  );

  // If absolutely no info has been inputted by the Admin, do not render footer at all
  if (!centerInfo.centerName && !hasContactInfo && !hasSocial) {
    return null;
  }

  return (
    <footer className="w-full bg-slate-900 text-slate-300 border-t border-slate-800 transition-colors duration-200 mt-auto">
      <div className="max-w-7xl mx-auto px-6 py-4 md:py-5">
        {/* Modern 3-Column Grid for Desktop, 2 for Tablet, 1 for Mobile - with smaller gap */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
          
          {/* Column 1: Brand Info & Intro */}
          <div className="space-y-2">
            {centerInfo.logo && (
              <div className="flex items-center gap-1.5">
                {(() => {
                  const logoStr = centerInfo.logo.trim();
                  const isImage = logoStr.startsWith('http') || logoStr.startsWith('/') || logoStr.startsWith('data:image') || /\.(png|jpe?g|gif|svg|webp)(\?.*)?$/i.test(logoStr);
                  if (isImage) {
                    return (
                      <img 
                        src={logoStr} 
                        alt={centerInfo.centerName || "Logo"} 
                        referrerPolicy="no-referrer"
                        className="max-h-5 md:max-h-6 w-auto object-contain block dark:brightness-110"
                      />
                    );
                  }
                  return (
                    <span className="text-xs font-black text-white tracking-tight bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">
                      {centerInfo.logo}
                    </span>
                  );
                })()}
              </div>
            )}
            {centerInfo.centerName && (
              <h4 className="text-[10px] font-extrabold text-white tracking-tight">
                {centerInfo.centerName}
              </h4>
            )}
            <p className="text-[10px] text-slate-400 leading-relaxed max-w-sm">
              {language === 'vi' 
                ? 'Hành trình đồng hành chinh phục mục tiêu IELTS. Trực quan - Hiệu quả - Cam kết chất lượng đầu ra.'
                : 'Your dedicated pathway to achieving IELTS excellence. Modern, efficient, and top-tier educational results.'}
            </p>
          </div>

          {/* Column 2: Contact & Working Hours */}
          {hasContactInfo && (
            <div className="space-y-2">
              <h4 className="text-[9px] font-bold text-white uppercase tracking-widest border-l-2 border-indigo-500 pl-2">
                {language === 'vi' ? 'Thông Tin Liên Hệ' : 'Contact Information'}
              </h4>
              <ul className="space-y-1.5 text-[10px] text-slate-400">
                {centerInfo.address && (
                  <li className="flex items-start gap-1.5">
                    <MapPin size={11} className="text-indigo-400 shrink-0 mt-0.5" />
                    <a 
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(centerInfo.address)}`}
                      target="_blank" 
                      referrerPolicy="no-referrer"
                      className="hover:text-white hover:underline transition-colors leading-relaxed"
                    >
                      {centerInfo.address}
                    </a>
                  </li>
                )}
                {centerInfo.phone && (
                  <li className="flex items-center gap-1.5">
                    <Phone size={11} className="text-indigo-400 shrink-0" />
                    <a 
                      href={`tel:${centerInfo.phone.replace(/\s+/g, '')}`} 
                      className="hover:text-white hover:underline transition-colors font-mono"
                    >
                      {centerInfo.phone}
                    </a>
                  </li>
                )}
                {centerInfo.email && (
                  <li className="flex items-center gap-1.5">
                    <Mail size={11} className="text-indigo-400 shrink-0" />
                    <a 
                      href={`mailto:${centerInfo.email}`} 
                      className="hover:text-white hover:underline transition-colors font-mono"
                    >
                      {centerInfo.email}
                    </a>
                  </li>
                )}
                {centerInfo.workingHours && (
                  <li className="flex items-start gap-1.5 pt-1 border-t border-slate-800/80">
                    <Clock size={11} className="text-indigo-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-[8px] text-slate-500 font-extrabold uppercase block tracking-wider">
                        {language === 'vi' ? 'Giờ hoạt động' : 'Working hours'}
                      </span>
                      <span className="text-slate-400 block mt-0.5">{centerInfo.workingHours}</span>
                    </div>
                  </li>
                )}
              </ul>
            </div>
          )}

          {/* Column 3: Links & Social Platforms */}
          <div className="space-y-2">
            <h4 className="text-[9px] font-bold text-white uppercase tracking-widest border-l-2 border-indigo-500 pl-2">
              {language === 'vi' ? 'Liên Kết Mạng Xã Hội' : 'Official Channels'}
            </h4>
            <div className="space-y-2">
              {centerInfo.website && (
                <div className="text-[10px]">
                  <span className="text-slate-500 text-[8px] font-extrabold uppercase block tracking-wider mb-0.5">
                    {language === 'vi' ? 'Trang chủ' : 'Website'}
                  </span>
                  <a 
                    href={centerInfo.website}
                    target="_blank" 
                    referrerPolicy="no-referrer"
                    className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300 font-mono font-bold hover:underline transition-colors"
                  >
                    <Globe size={10} />
                    {centerInfo.website.replace(/^https?:\/\/(www\.)?/, '')}
                  </a>
                </div>
              )}

              {hasSocial && (
                <div>
                  <span className="text-slate-500 text-[8px] font-extrabold uppercase block tracking-wider mb-1">
                    {language === 'vi' ? 'Nền tảng số' : 'Social Medias'}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {centerInfo.facebook && (
                      <a 
                        href={centerInfo.facebook} 
                        target="_blank" 
                        referrerPolicy="no-referrer"
                        title="Facebook"
                        className="p-1 bg-slate-800 hover:bg-slate-700 hover:text-white text-slate-400 rounded-md transition-all border border-slate-800 hover:scale-105"
                      >
                        <Facebook size={12} />
                      </a>
                    )}
                    {centerInfo.zalo && (
                      <a 
                        href={centerInfo.zalo} 
                        target="_blank" 
                        referrerPolicy="no-referrer"
                        title="Zalo Chat"
                        className="p-1 bg-slate-800 hover:bg-slate-700 hover:text-white text-slate-400 rounded-md transition-all border border-slate-800 hover:scale-105"
                      >
                        <MessageCircle size={12} />
                      </a>
                    )}
                    {centerInfo.youtube && (
                      <a 
                        href={centerInfo.youtube} 
                        target="_blank" 
                        referrerPolicy="no-referrer"
                        title="YouTube"
                        className="p-1 bg-slate-800 hover:bg-slate-700 hover:text-white text-slate-400 rounded-md transition-all border border-slate-800 hover:scale-105"
                      >
                        <Youtube size={12} />
                      </a>
                    )}
                    {centerInfo.instagram && (
                      <a 
                        href={centerInfo.instagram} 
                        target="_blank" 
                        referrerPolicy="no-referrer"
                        title="Instagram"
                        className="p-1 bg-slate-800 hover:bg-slate-700 hover:text-white text-slate-400 rounded-md transition-all border border-slate-800 hover:scale-105"
                      >
                        <Instagram size={12} />
                      </a>
                    )}
                    {centerInfo.tiktok && (
                      <a 
                        href={centerInfo.tiktok} 
                        target="_blank" 
                        referrerPolicy="no-referrer"
                        title="TikTok"
                        className="p-1 bg-slate-800 hover:bg-slate-700 hover:text-white text-slate-400 rounded-md transition-all border border-slate-800 hover:scale-105"
                      >
                        <Video size={12} />
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Column Bottom: Separator & Copyright */}
        <div className="border-t border-slate-800/80 mt-4 pt-3 flex flex-col sm:flex-row items-center justify-between gap-2.5 text-[9px] text-slate-500 font-medium">
          <div>
            {centerInfo.copyright || `© ${new Date().getFullYear()} ${centerInfo.centerName || 'IELTS Master'}.`}
          </div>
          <div className="flex gap-2.5">
            <span className="hover:text-slate-400 transition-colors cursor-pointer">
              {language === 'vi' ? 'Điều khoản sử dụng' : 'Terms of Use'}
            </span>
            <span>•</span>
            <span className="hover:text-slate-400 transition-colors cursor-pointer">
              {language === 'vi' ? 'Chính sách bảo mật' : 'Privacy Policy'}
            </span>
          </div>
        </div>

      </div>
    </footer>
  );
}
