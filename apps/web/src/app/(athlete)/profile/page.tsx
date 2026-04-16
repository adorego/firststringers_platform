import { Card, Badge, Avatar, Button } from "@/components/ui";
import { Award, Video, FileText, Target } from "lucide-react";

export default function ProfilePage() {
  return (
    <div className="px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#111827]">Marcus Johnson</h1>
          <p className="text-sm text-fs-muted">
            Point Guard &middot; Class of 2027
          </p>
        </div>
        <Button variant="primary">Edit Profile</Button>
      </div>

      {/* Bio card */}
      <Card className="mt-8">
        <div className="flex gap-6">
          <div className="h-32 w-32 flex-shrink-0 overflow-hidden rounded-lg bg-fs-light-gray">
            <img
              src="/images/athlete-placeholder.jpg"
              alt="Marcus Johnson"
              className="h-full w-full object-cover"
            />
          </div>
          <div>
            <div className="flex items-center gap-4 text-sm text-fs-muted">
              <span>Austin, Texas</span>
              <span>Born June 15, 2008</span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-[#111827]">
              Dynamic point guard with exceptional court vision and leadership
              qualities. Strong academic record with a 3.8 GPA. Looking for a
              competitive Division I program that values both athletic excellence
              and academic rigor.
            </p>
          </div>
        </div>
      </Card>

      {/* Jerry&apos;s Insights */}
      <Card variant="highlight" className="mt-6">
        <h3 className="flex items-center gap-2 text-base font-semibold text-fs-purple">
          <span>✦</span> Jerry&apos;s Insights
        </h3>
        <p className="mt-3 text-sm leading-relaxed text-fs-purple/80">
          Marcus has strong metrics in leadership and playmaking. His
          assist-to-turnover ratio (3.2:1) is well above the national average
          for his age group. Recent performance trend shows consistent
          improvement in shooting efficiency. Best fits: programs that emphasize
          guard development and up-tempo offense.
        </p>
      </Card>

      {/* Stats grid */}
      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <Card>
          <h3 className="flex items-center gap-2 text-base font-semibold text-[#111827]">
            Physical Attributes
          </h3>
          <div className="mt-4 space-y-3">
            {[
              { label: "Height", value: "6'1\"" },
              { label: "Weight", value: "175 lbs" },
            ].map((stat) => (
              <div
                key={stat.label}
                className="flex items-center justify-between border-b border-fs-border-gray pb-3 last:border-0"
              >
                <span className="text-sm text-fs-muted">{stat.label}</span>
                <span className="text-sm font-semibold text-[#111827]">
                  {stat.value}
                </span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h3 className="flex items-center gap-2 text-base font-semibold text-[#111827]">
            Junior Year Stats
          </h3>
          <div className="mt-4 space-y-3">
            {[
              { label: "Points per game", value: "18.2" },
              { label: "Assists per game", value: "7.1" },
            ].map((stat) => (
              <div
                key={stat.label}
                className="flex items-center justify-between border-b border-fs-border-gray pb-3 last:border-0"
              >
                <span className="text-sm text-fs-muted">{stat.label}</span>
                <span className="text-sm font-semibold text-[#111827]">
                  {stat.value}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Achievements & Honors */}
      <Card className="mt-6">
        <h3 className="flex items-center gap-2 text-base font-semibold text-[#111827]">
          <Award size={18} /> Achievements &amp; Honors
        </h3>
        <ul className="mt-4 space-y-2">
          {[
            "All-District First Team (2025, 2026)",
            "District MVP (2026)",
            "AAU National Championship Finalist (2025)",
            "Academic All-State (2025, 2026)",
          ].map((item) => (
            <li key={item} className="flex items-center gap-2 text-sm text-[#111827]">
              <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#111827]" />
              {item}
            </li>
          ))}
        </ul>
      </Card>

      {/* Video Highlights */}
      <Card className="mt-6">
        <h3 className="flex items-center gap-2 text-base font-semibold text-[#111827]">
          <Video size={18} /> Video Highlights
        </h3>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="relative aspect-video overflow-hidden rounded-lg bg-fs-light-gray"
            >
              <img
                src="/images/athlete-placeholder.jpg"
                alt={`Season Highlights ${n}`}
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                <p className="text-sm font-medium text-white">
                  Season Highlights {n}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Academic Information */}
      <Card className="mt-6">
        <h3 className="flex items-center gap-2 text-base font-semibold text-[#111827]">
          <FileText size={18} /> Academic Information
        </h3>
        <div className="mt-4 grid gap-x-8 gap-y-3 md:grid-cols-2">
          {[
            { label: "GPA", value: "3.8" },
            { label: "SAT Score", value: "1280" },
            { label: "Class Rank", value: "Top 15%" },
            { label: "Intended Major", value: "Business / Sports Management" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="flex items-center justify-between border-b border-fs-border-gray pb-3"
            >
              <span className="text-sm text-fs-muted">{stat.label}</span>
              <span className="text-sm font-semibold text-[#111827]">
                {stat.value}
              </span>
            </div>
          ))}
        </div>
      </Card>

      {/* Goals & Preferences */}
      <Card className="mt-6">
        <h3 className="flex items-center gap-2 text-base font-semibold text-[#111827]">
          <Target size={18} /> Goals &amp; Preferences
        </h3>
        <ul className="mt-4 space-y-2">
          {[
            "Play at a competitive Division I program",
            "Strong academic support and business program",
            "Coaching staff focused on guard development",
            "Prefer warm climate or Midwest region",
          ].map((item) => (
            <li key={item} className="flex items-center gap-2 text-sm text-[#111827]">
              <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#111827]" />
              {item}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
