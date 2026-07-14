import React from 'react';
import { BarChart, TrendingUp, Compass, Award } from 'lucide-react';
import { getStoredAssignments } from '../../data/mockData';

interface ChartCardProps {
  type: 'line' | 'bar' | 'skills' | 'activity';
  title: string;
  subtitle?: string;
}

export default function ChartCard({ type, title, subtitle }: ChartCardProps) {
  // Render different custom SVG charts based on the type
  const renderChart = () => {
    switch (type) {
      case 'line': {
        const assignments = getStoredAssignments();
        const allCompletedSubmissions: { submittedAt: string }[] = [];
        assignments.forEach(assign => {
          if (assign.submissions) {
            assign.submissions.forEach(sub => {
              if (sub.status === 'done' && sub.submittedAt) {
                allCompletedSubmissions.push({ submittedAt: sub.submittedAt });
              }
            });
          }
        });

        // Let's get the list of the last 6 months dynamically (e.g. up to current date)
        const monthsData: { label: string; year: number; month: number; count: number }[] = [];
        const currentDate = new Date();
        for (let i = 5; i >= 0; i--) {
          const d = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
          const monthLabel = `Tháng ${d.getMonth() + 1}`;
          monthsData.push({
            label: monthLabel,
            year: d.getFullYear(),
            month: d.getMonth(),
            count: 0
          });
        }

        allCompletedSubmissions.forEach(sub => {
          const subDate = new Date(sub.submittedAt);
          const subYear = subDate.getFullYear();
          const subMonth = subDate.getMonth();
          const match = monthsData.find(m => m.year === subYear && m.month === subMonth);
          if (match) {
            match.count++;
          }
        });

        const counts = monthsData.map(m => m.count);
        const totalSubmissionsCount = counts.reduce((a, b) => a + b, 0);
        const maxCount = Math.max(...counts, 5);

        const points = monthsData.map((m, idx) => {
          const x = 15 + idx * 94; // distribute smoothly inside SVG width 500
          const y = 180 - (m.count / maxCount) * 140; // max height map safely
          return { x, y, count: m.count, label: m.label };
        });

        let dPath = `M ${points[0].x} ${points[0].y}`;
        for (let i = 1; i < points.length; i++) {
          dPath += ` L ${points[i].x} ${points[i].y}`;
        }
        const dAreaPath = `${dPath} L ${points[points.length - 1].x} 180 L ${points[0].x} 180 Z`;

        return (
          <div className="w-full h-56 flex flex-col justify-between pt-4 relative">
            <svg viewBox="0 0 500 200" className="w-full h-full overflow-visible">
              {/* Grid Lines */}
              <line x1="0" y1="180" x2="500" y2="180" stroke="#f1f5f9" strokeWidth="2" />
              <line x1="0" y1="130" x2="500" y2="130" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="4 4" />
              <line x1="0" y1="80" x2="500" y2="80" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="4 4" />
              <line x1="0" y1="30" x2="500" y2="30" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="4 4" />

              <defs>
                <linearGradient id="line-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563eb" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#2563eb" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {totalSubmissionsCount > 0 && (
                <>
                  <path d={dAreaPath} fill="url(#line-grad)" />
                  <path d={dPath} fill="none" stroke="#2563eb" strokeWidth="4" strokeLinecap="round" />
                  {points.map((p, idx) => (
                    <g key={idx}>
                      <circle cx={p.x} cy={p.y} r="5" fill="#2563eb" stroke="#ffffff" strokeWidth="2" />
                      {p.count > 0 && (
                        <g transform={`translate(${p.x}, ${p.y - 12})`}>
                          <rect x="-25" y="-16" width="50" height="15" rx="3" fill="#0f172a" />
                          <text x="0" y="-5" fill="#ffffff" fontSize="9" fontWeight="bold" textAnchor="middle">
                            {p.count} lượt
                          </text>
                        </g>
                      )}
                    </g>
                  ))}
                </>
              )}
            </svg>

            {totalSubmissionsCount === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/50 text-slate-400">
                <BarChart size={24} className="text-slate-300 mb-1.5" />
                <p className="text-xs font-bold">Chưa có lượt nộp bài thực tế nào</p>
                <p className="text-[10px] text-slate-400">Biểu đồ sẽ tự động cập nhật khi học sinh bắt đầu làm bài nộp.</p>
              </div>
            )}

            {/* X Axis Labels */}
            <div className="flex justify-between text-[11px] font-bold text-slate-400 px-2 pt-2 border-t border-slate-50">
              {monthsData.map((m, idx) => (
                <span key={idx}>{m.label}</span>
              ))}
            </div>
          </div>
        );
      }

      case 'bar': {
        const assignments = getStoredAssignments();
        const allCompletedSubmissions: { submittedAt: string }[] = [];
        assignments.forEach(assign => {
          if (assign.submissions) {
            assign.submissions.forEach(sub => {
              if (sub.status === 'done' && sub.submittedAt) {
                allCompletedSubmissions.push({ submittedAt: sub.submittedAt });
              }
            });
          }
        });

        // Compute past 6 weeks dynamically
        const weeksData: { label: string; start: Date; end: Date; count: number }[] = [];
        const now = new Date();
        for (let i = 5; i >= 0; i--) {
          const start = new Date(now.getTime() - (i + 1) * 7 * 24 * 60 * 60 * 1000);
          const end = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
          weeksData.push({
            label: `Tuần ${6 - i}`,
            start,
            end,
            count: 0
          });
        }

        allCompletedSubmissions.forEach(sub => {
          const d = new Date(sub.submittedAt);
          const match = weeksData.find(w => d >= w.start && d < w.end);
          if (match) {
            match.count++;
          }
        });

        const barData = weeksData.map(w => w.count);
        const totalBarCount = barData.reduce((a, b) => a + b, 0);
        const maxVal = Math.max(...barData, 5);

        return (
          <div className="w-full h-56 flex flex-col justify-between pt-4 relative">
            {totalBarCount > 0 ? (
              <div className="flex-1 flex items-end justify-between gap-4 px-2 h-44">
                {barData.map((val, idx) => {
                  const heightPercentage = `${(val / maxVal) * 100}%`;
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-2 group h-full justify-end">
                      {/* Tooltip value */}
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow absolute mb-16 transform -translate-y-2 z-10">
                        {val} bài
                      </span>
                      {/* Bar */}
                      <div
                        style={{ height: heightPercentage }}
                        className="w-full bg-indigo-500 hover:bg-indigo-600 rounded-t-lg transition-all duration-300 relative group-hover:shadow-lg group-hover:shadow-indigo-500/20"
                      >
                        <div className="absolute top-0 left-0 right-0 h-1 bg-white/20 rounded-t-lg"></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/50 text-slate-400">
                <BarChart size={24} className="text-slate-300 mb-1.5" />
                <p className="text-xs font-bold">Chưa có bài tập nào hoàn thành</p>
                <p className="text-[10px] text-slate-400">Thống kê tự động tổng hợp từ hoạt động làm bài tập.</p>
              </div>
            )}
            {/* Axis */}
            <div className="flex justify-between text-[11px] font-bold text-slate-400 px-2 pt-2.5 border-t border-slate-50">
              {weeksData.map((w, idx) => (
                <span key={idx}>{w.label}</span>
              ))}
            </div>
          </div>
        );
      }

      case 'skills': {
        const assignments = getStoredAssignments();
        const skillsData = [
          { name: 'Listening', type: 'listening', totalScore: 0, count: 0, defaultScore: 0.0, color: 'bg-teal-500', textTheme: 'text-teal-700' },
          { name: 'Reading', type: 'reading', totalScore: 0, count: 0, defaultScore: 0.0, color: 'bg-indigo-500', textTheme: 'text-indigo-700' },
          { name: 'Writing', type: 'writing', totalScore: 0, count: 0, defaultScore: 0.0, color: 'bg-amber-500', textTheme: 'text-amber-700' },
          { name: 'Speaking', type: 'speaking', totalScore: 0, count: 0, defaultScore: 0.0, color: 'bg-purple-500', textTheme: 'text-purple-700' }
        ];

        assignments.forEach(assign => {
          if (assign.submissions) {
            assign.submissions.forEach(sub => {
              if (sub.status === 'done' && typeof sub.score === 'number') {
                const match = skillsData.find(s => s.type === assign.type);
                if (match) {
                  match.totalScore += sub.score;
                  match.count++;
                }
              }
            });
          }
        });

        const skills = skillsData.map(s => {
          const avg = s.count > 0 ? (s.totalScore / s.count) : s.defaultScore;
          return {
            name: s.name,
            score: parseFloat(avg.toFixed(1)),
            color: s.color,
            count: s.count,
            textTheme: s.textTheme
          };
        });

        // Find highest score skill and lowest score skill
        const scoredSkills = skills.filter(s => s.count > 0);
        let maxSkill = scoredSkills.length > 0 ? scoredSkills.reduce((prev, current) => (prev.score > current.score) ? prev : current) : null;
        let minSkill = scoredSkills.length > 0 ? scoredSkills.reduce((prev, current) => (prev.score < current.score) ? prev : current) : null;

        return (
          <div className="space-y-4.5 pt-4">
            {skills.map((skill) => {
              const percentage = (skill.score / 9.0) * 100;
              return (
                <div key={skill.name} className="space-y-1.5">
                  <div className="flex justify-between text-xs font-bold text-slate-700">
                    <span className="flex items-center gap-1.5">
                      <span className={`w-2.5 h-2.5 rounded-full ${skill.color}`}></span>
                      {skill.name}
                    </span>
                    <span className="text-slate-900 font-extrabold">
                      {skill.count > 0 ? `Band ${skill.score} / 9.0` : 'Chưa có điểm'}
                    </span>
                  </div>
                  {/* Progress Bar Track */}
                  <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      style={{ width: `${percentage || 0}%` }}
                      className={`h-full ${skill.color} rounded-full transition-all duration-1000 shadow-sm`}
                    ></div>
                  </div>
                </div>
              );
            })}
            
            <div className="bg-blue-50/70 p-3.5 rounded-xl border border-blue-100 flex items-start gap-2.5 mt-2">
              <Compass size={16} className="text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-[11px] text-slate-600 leading-relaxed">
                <span className="font-bold text-blue-800">Đánh giá hệ thống thực tế:</span>{' '}
                {scoredSkills.length > 0 ? (
                  <>
                    Kỹ năng đạt điểm trung bình tốt nhất hiện tại là{' '}
                    <strong className={maxSkill?.textTheme}>{maxSkill?.name}</strong> (Band {maxSkill?.score}).{' '}
                    Cần chú trọng nâng cao kỹ năng{' '}
                    <strong className={minSkill?.textTheme}>{minSkill?.name}</strong> (Band {minSkill?.score}) để học viên cải thiện điểm số đồng đều hơn.
                  </>
                ) : (
                  <>Hệ thống chưa ghi nhận điểm số của học viên nào. Kết quả đánh giá kỹ năng trung bình sẽ tự động tính toán từ các điểm bài tập đã làm của học sinh.</>
                )}
              </div>
            </div>
          </div>
        );
      }

      default:
        return (
          <div className="space-y-4 pt-4">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500">
              <span>Đề thi thử (Full Mock)</span>
              <span>Chưa bắt đầu</span>
            </div>
            <div className="flex items-center justify-between text-xs font-bold text-slate-500">
              <span>Bài viết đã sửa</span>
              <span>Chưa có dữ liệu</span>
            </div>
          </div>
        );
    }
  };

  return (
    <div id={`chart_card_${type}`} className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm flex flex-col h-full hover:shadow-md transition-all duration-300">
      <div className="flex items-start justify-between border-b border-slate-50 pb-3">
        <div>
          <h4 className="text-sm font-extrabold text-slate-800">{title}</h4>
          {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
        <span className="text-slate-300">
          <TrendingUp size={18} />
        </span>
      </div>

      <div className="flex-1 flex flex-col justify-center">
        {renderChart()}
      </div>
    </div>
  );
}
