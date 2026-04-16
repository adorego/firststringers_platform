import type { DossierSection } from "@/types";

/** Full dossier sections for Carlos Méndez (uuid-1) — 82% complete */
export const mockFullDossier: DossierSection[] = [
  {
    id: "identity",
    title: "Identity",
    icon: "User",
    completedFields: 7,
    totalFields: 7,
    fields: [
      { key: "name", label: "Full name", value: "Carlos Méndez", source: "user" },
      { key: "dob", label: "Date of birth", value: "March 14, 2007", source: "user" },
      { key: "hometown", label: "Hometown", value: "Chicago, IL", source: "user" },
      { key: "sport", label: "Sport", value: "Football", source: "user" },
      { key: "position", label: "Position", value: "Quarterback", source: "jerry" },
      { key: "height", label: "Height", value: "6'2\"", source: "jerry" },
      { key: "weight", label: "Weight", value: "195 lbs", source: "jerry" },
    ],
  },
  {
    id: "performance",
    title: "Performance",
    icon: "BarChart2",
    completedFields: 5,
    totalFields: 7,
    fields: [
      { key: "leagueLevel", label: "League level", value: "D1", source: "user" },
      { key: "touchdowns", label: "Touchdowns", value: 28, source: "jerry" },
      { key: "passingYards", label: "Passing yards", value: 2400, source: "jerry" },
      { key: "completionRate", label: "Completion rate (%)", value: 64, source: "jerry" },
      { key: "interceptions", label: "Interceptions", value: 6, source: "jerry" },
      { key: "rushingYards", label: "Rushing yards", value: null, source: "user" },
      { key: "highlights", label: "Highlight reel URL", value: null, source: "user" },
    ],
  },
  {
    id: "academic",
    title: "Academic",
    icon: "GraduationCap",
    completedFields: 4,
    totalFields: 5,
    fields: [
      { key: "gpa", label: "GPA", value: 3.7, source: "user" },
      { key: "sat", label: "SAT Score", value: 1280, source: "user" },
      { key: "highSchool", label: "High School", value: "Lincoln High School", source: "jerry" },
      { key: "intendedMajor", label: "Intended major", value: "Business", source: "user" },
      { key: "act", label: "ACT Score", value: null, source: "user" },
    ],
  },
  {
    id: "availability",
    title: "Availability",
    icon: "Calendar",
    completedFields: 3,
    totalFields: 4,
    fields: [
      { key: "transferPortal", label: "Transfer portal", value: "Yes", source: "user" },
      { key: "preferredRegions", label: "Preferred regions", value: "Midwest, Northeast", source: "jerry" },
      { key: "gradYear", label: "Graduation year", value: 2025, source: "user" },
      { key: "eligibleSeasons", label: "Eligible seasons remaining", value: null, source: "user" },
    ],
  },
];

/** Marcus Johnson (uuid-2) — 55% complete */
export const mockPartialDossier: DossierSection[] = [
  {
    id: "identity",
    title: "Identity",
    icon: "User",
    completedFields: 5,
    totalFields: 7,
    fields: [
      { key: "name", label: "Full name", value: "Marcus Johnson", source: "user" },
      { key: "dob", label: "Date of birth", value: "June 15, 2008", source: "user" },
      { key: "hometown", label: "Hometown", value: "Austin, TX", source: "user" },
      { key: "sport", label: "Sport", value: "Basketball", source: "user" },
      { key: "position", label: "Position", value: "Point Guard", source: "jerry" },
      { key: "height", label: "Height", value: null, source: "user" },
      { key: "weight", label: "Weight", value: null, source: "user" },
    ],
  },
  {
    id: "performance",
    title: "Performance",
    icon: "BarChart2",
    completedFields: 3,
    totalFields: 6,
    fields: [
      { key: "leagueLevel", label: "League level", value: "Varsity", source: "user" },
      { key: "ppg", label: "Points per game", value: 18.2, source: "jerry" },
      { key: "apg", label: "Assists per game", value: 7.1, source: "jerry" },
      { key: "spg", label: "Steals per game", value: null, source: "user" },
      { key: "fpct", label: "Field goal %", value: null, source: "user" },
      { key: "highlights", label: "Highlight reel URL", value: null, source: "user" },
    ],
  },
  {
    id: "academic",
    title: "Academic",
    icon: "GraduationCap",
    completedFields: 2,
    totalFields: 5,
    fields: [
      { key: "gpa", label: "GPA", value: 3.8, source: "user" },
      { key: "highSchool", label: "High School", value: "Westlake High School", source: "jerry" },
      { key: "sat", label: "SAT Score", value: null, source: "user" },
      { key: "act", label: "ACT Score", value: null, source: "user" },
      { key: "intendedMajor", label: "Intended major", value: null, source: "user" },
    ],
  },
  {
    id: "availability",
    title: "Availability",
    icon: "Calendar",
    completedFields: 1,
    totalFields: 4,
    fields: [
      { key: "preferredRegions", label: "Preferred regions", value: "Southwest, Southeast", source: "user" },
      { key: "transferPortal", label: "Transfer portal", value: null, source: "user" },
      { key: "gradYear", label: "Graduation year", value: null, source: "user" },
      { key: "eligibleSeasons", label: "Eligible seasons remaining", value: null, source: "user" },
    ],
  },
];

/** Ana López (uuid-3) — 25% complete */
export const mockEmptyDossier: DossierSection[] = [
  {
    id: "identity",
    title: "Identity",
    icon: "User",
    completedFields: 3,
    totalFields: 7,
    fields: [
      { key: "name", label: "Full name", value: "Ana López", source: "user" },
      { key: "sport", label: "Sport", value: "Soccer", source: "user" },
      { key: "position", label: "Position", value: "Midfielder", source: "user" },
      { key: "dob", label: "Date of birth", value: null, source: "user" },
      { key: "hometown", label: "Hometown", value: null, source: "user" },
      { key: "height", label: "Height", value: null, source: "user" },
      { key: "weight", label: "Weight", value: null, source: "user" },
    ],
  },
  {
    id: "performance",
    title: "Performance",
    icon: "BarChart2",
    completedFields: 2,
    totalFields: 6,
    fields: [
      { key: "goals", label: "Goals per season", value: 12, source: "jerry" },
      { key: "assists", label: "Assists per season", value: 18, source: "jerry" },
      { key: "leagueLevel", label: "League level", value: null, source: "user" },
      { key: "passAccuracy", label: "Pass accuracy %", value: null, source: "user" },
      { key: "minutesPlayed", label: "Minutes per game", value: null, source: "user" },
      { key: "highlights", label: "Highlight reel URL", value: null, source: "user" },
    ],
  },
  {
    id: "academic",
    title: "Academic",
    icon: "GraduationCap",
    completedFields: 1,
    totalFields: 5,
    fields: [
      { key: "gpa", label: "GPA", value: 3.9, source: "user" },
      { key: "highSchool", label: "High School", value: null, source: "user" },
      { key: "sat", label: "SAT Score", value: null, source: "user" },
      { key: "act", label: "ACT Score", value: null, source: "user" },
      { key: "intendedMajor", label: "Intended major", value: null, source: "user" },
    ],
  },
  {
    id: "availability",
    title: "Availability",
    icon: "Calendar",
    completedFields: 0,
    totalFields: 4,
    fields: [
      { key: "preferredRegions", label: "Preferred regions", value: null, source: "user" },
      { key: "transferPortal", label: "Transfer portal", value: null, source: "user" },
      { key: "gradYear", label: "Graduation year", value: null, source: "user" },
      { key: "eligibleSeasons", label: "Eligible seasons remaining", value: null, source: "user" },
    ],
  },
];

/** Map athlete id → dossier sections */
export const dossiersByAthleteId: Record<string, DossierSection[]> = {
  "uuid-1": mockFullDossier,
  "uuid-2": mockPartialDossier,
  "uuid-3": mockEmptyDossier,
};
