import { Card, ProgressBar, Badge } from "@/components/ui";

const sections = [
  {
    title: "Personal Info",
    completed: 4,
    total: 6,
    fields: [
      { label: "Full name", value: "Marcus Johnson" },
      { label: "Date of birth", value: "June 15, 2008" },
      { label: "Height", value: "6'1\"" },
      { label: "Weight", value: "175 lbs" },
      { label: "Phone", value: null },
      { label: "Address", value: null },
    ],
  },
  {
    title: "Academic",
    completed: 2,
    total: 4,
    fields: [
      { label: "GPA", value: "3.8" },
      { label: "High School", value: "Lincoln High School" },
      { label: "SAT Score", value: null },
      { label: "Graduation Year", value: null },
    ],
  },
  {
    title: "Athletic Stats",
    completed: 3,
    total: 5,
    fields: [
      { label: "Sport", value: "Basketball" },
      { label: "Position", value: "Point Guard" },
      { label: "Points per game", value: "18.2" },
      { label: "Assists per game", value: null },
      { label: "Completion rate", value: null },
    ],
  },
];

const total = sections.reduce((a, s) => a + s.completed, 0);
const totalFields = sections.reduce((a, s) => a + s.total, 0);
const pct = Math.round((total / totalFields) * 100);

export default function DossierPage() {
  return (
    <div className="px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#111827]">Your Dossier</h1>
        <p className="mt-1 text-sm text-fs-muted">
          {pct}% complete &middot; {total}/{totalFields} fields
        </p>
        <ProgressBar value={pct} className="mt-3 max-w-md" />
      </div>

      <div className="space-y-6">
        {sections.map((section) => (
          <Card key={section.title}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-[#111827]">
                {section.title}
              </h2>
              <Badge variant={section.completed === section.total ? "active" : "pending"}>
                {section.completed}/{section.total}
              </Badge>
            </div>
            <div className="space-y-3">
              {section.fields.map((field) => (
                <div
                  key={field.label}
                  className="flex items-center justify-between border-b border-fs-border-gray pb-3 last:border-0"
                >
                  <span className="text-sm text-fs-muted">{field.label}</span>
                  {field.value ? (
                    <span className="text-sm font-medium text-[#111827]">
                      {field.value}
                    </span>
                  ) : (
                    <span className="text-xs text-fs-muted">
                      Complete with Jerry
                    </span>
                  )}
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
