import { Card, Badge, Button } from "@/components/ui";
import { ArrowRight } from "lucide-react";

const opportunities = [
  {
    university: "University of Miami",
    coach: "Coach Richardson",
    status: "Interested" as const,
    summary:
      "Viewed your profile twice this week. Strong interest indicated in point guards with your assist-to-turnover ratio.",
    lastAction: "Viewed highlight reel",
    date: "Mar 27, 2026",
  },
  {
    university: "Duke University",
    coach: "Coach Thompson",
    status: "Requested Info" as const,
    summary:
      "Requested academic transcripts and additional game film. Focus on defensive capabilities.",
    lastAction: "Information sent by Jerry",
    date: "Mar 26, 2026",
  },
];

export default function MatchesPage() {
  return (
    <div className="px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#111827]">Pipeline</h1>
        <p className="text-sm text-fs-muted">
          Your recruiting activity, organized by Jerry
        </p>
      </div>

      <h2 className="mb-4 text-lg font-semibold text-fs-muted">
        Active Opportunities
      </h2>

      <div className="space-y-4">
        {opportunities.map((opp) => (
          <Card key={opp.university}>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-[#111827]">
                  {opp.university}
                </h3>
                <p className="text-sm text-fs-muted">{opp.coach}</p>
              </div>
              <Badge variant="interested">
                <svg
                  className="h-3.5 w-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12l2 2 4-4"
                  />
                </svg>
                {opp.status}
              </Badge>
            </div>
            <p className="mt-3 text-sm text-[#111827]">{opp.summary}</p>
            <div className="mt-4 flex items-end justify-between">
              <div>
                <p className="text-xs text-fs-muted">Last action</p>
                <p className="text-sm font-medium text-[#111827]">
                  {opp.lastAction}
                </p>
                <p className="text-xs text-fs-muted">{opp.date}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm">
                  Ask Jerry
                </Button>
                <Button variant="primary" size="sm">
                  View Details <ArrowRight size={14} />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
