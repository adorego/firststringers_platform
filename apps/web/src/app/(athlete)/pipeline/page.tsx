import { Card, Badge, Button } from "@/components/ui";
import { CheckCircle, Eye, Clock, ArrowRight } from "lucide-react";

interface Opportunity {
  id: string;
  university: string;
  coach: string;
  status: "interested" | "requested" | "viewed" | "in_progress";
  description: string;
  lastAction: string;
  lastActionDate: string;
}

const STATUS_CONFIG = {
  interested: {
    label: "Interested",
    variant: "interested" as const,
    icon: <CheckCircle size={14} />,
  },
  requested: {
    label: "Requested Info",
    variant: "active" as const,
    icon: <CheckCircle size={14} />,
  },
  viewed: {
    label: "Viewed",
    variant: "default" as const,
    icon: <Eye size={14} />,
  },
  in_progress: {
    label: "In Progress",
    variant: "pending" as const,
    icon: <Clock size={14} />,
  },
};

const MOCK_OPPORTUNITIES: Record<string, Opportunity[]> = {
  "Active Opportunities": [
    {
      id: "1",
      university: "University of Miami",
      coach: "Coach Richardson",
      status: "interested",
      description:
        "Viewed your profile twice this week. Strong interest indicated in point guards with your assist-to-turnover ratio.",
      lastAction: "Viewed highlight reel",
      lastActionDate: "Mar 27, 2026",
    },
    {
      id: "2",
      university: "Duke University",
      coach: "Coach Thompson",
      status: "requested",
      description:
        "Requested academic transcripts and additional game film. Focus on defensive capabilities.",
      lastAction: "Information sent by Jerry",
      lastActionDate: "Mar 26, 2026",
    },
  ],
  New: [
    {
      id: "3",
      university: "University of Texas",
      coach: "Coach Martinez",
      status: "viewed",
      description:
        "Initial profile view. In-state program looking for guards with leadership qualities.",
      lastAction: "Profile viewed",
      lastActionDate: "Mar 26, 2026",
    },
  ],
  Waiting: [
    {
      id: "4",
      university: "Stanford University",
      coach: "Coach Williams",
      status: "in_progress",
      description:
        "Conversation started about academic program fit. Waiting for your updated GPA information.",
      lastAction: "Awaiting academic records",
      lastActionDate: "Mar 25, 2026",
    },
  ],
};

function OpportunityCard({ opportunity }: { opportunity: Opportunity }) {
  const config = STATUS_CONFIG[opportunity.status];

  return (
    <Card>
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-[#111827]">
            {opportunity.university}
          </h3>
          <p className="text-sm text-fs-muted">{opportunity.coach}</p>
        </div>
        <Badge variant={config.variant}>
          {config.icon}
          {config.label}
        </Badge>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-fs-muted">
        {opportunity.description}
      </p>

      <div className="mt-4 border-t border-fs-border-gray pt-4">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs text-fs-muted">Last action</p>
            <p className="text-sm font-medium text-[#111827]">
              {opportunity.lastAction}
            </p>
            <p className="text-xs text-fs-muted">{opportunity.lastActionDate}</p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm">
              Ask Jerry
            </Button>
            <Button variant="primary" size="sm">
              View Details <ArrowRight size={14} />
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

export default function PipelinePage() {
  return (
    <div className="px-8 py-8">
      <div>
        <h1 className="text-2xl font-bold text-[#111827]">Pipeline</h1>
        <p className="text-sm text-fs-muted">
          Your recruiting activity, organized by Jerry
        </p>
      </div>

      <div className="mt-8 space-y-10">
        {Object.entries(MOCK_OPPORTUNITIES).map(([section, opportunities]) => (
          <div key={section}>
            <h2 className="mb-4 text-lg font-semibold text-fs-muted">
              {section}
            </h2>
            <div className="space-y-4">
              {opportunities.map((opp) => (
                <OpportunityCard key={opp.id} opportunity={opp} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
