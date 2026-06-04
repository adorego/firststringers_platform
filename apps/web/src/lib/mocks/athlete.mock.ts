import type { Athlete } from "@/types";

export const mockAthletes: Athlete[] = [
  {
    id: "uuid-1",
    email: "carlos.mendez@example.com",
    name: "Carlos Méndez",
    role: "athlete",
    sport: "Football",
    position: "Quarterback",
    graduationYear: 2025,
    gpa: 3.7,
    region: "Midwest",
    avatarUrl: undefined,
    dossier: {
      completeness: 0.82,
      data: {
        identity: {
          sport: "Football",
          position: "QB",
          graduationYear: 2025,
          height: "6'2\"",
          weight: "195 lbs",
          hometown: "Chicago, IL",
          dateOfBirth: "2007-03-14",
        },
        performance: {
          stats: { touchdowns: 28, passingYards: 2400, completionRate: 64, interceptions: 6 },
          leagueLevel: "D1",
          highlights: ["https://example.com/highlights/carlos-senior-reel"],
        },
        academic: {
          gpa: 3.7,
          sat: 1280,
          intendedMajor: "Business",
          highSchool: "Lincoln High School",
        },
        availability: {
          transferPortal: true,
          preferredRegions: ["Midwest", "Northeast"],
          eligibleSeasons: 4,
        },
      },
      narrative:
        "Carlos es un QB dual-threat con visión de juego excepcional. Destaca en lecturas de defensa y capacidad de improvisación bajo presión. Su liderazgo en el campo ha sido reconocido con el premio de MVP de conferencia dos años seguidos. Mantiene un GPA de 3.7 con intención de estudiar Business.",
    },
  },
  {
    id: "uuid-2",
    email: "marcus.johnson@example.com",
    name: "Marcus Johnson",
    role: "athlete",
    sport: "Basketball",
    position: "Point Guard",
    graduationYear: 2027,
    gpa: 3.8,
    region: "Southwest",
    avatarUrl: undefined,
    dossier: {
      completeness: 0.55,
      data: {
        identity: {
          sport: "Basketball",
          position: "Point Guard",
          graduationYear: 2027,
          height: "6'1\"",
          weight: "175 lbs",
          hometown: "Austin, TX",
          dateOfBirth: "2008-06-15",
        },
        performance: {
          stats: { pointsPerGame: 18.2, assistsPerGame: 7.1, stealPerGame: 2.3 },
          leagueLevel: "Varsity",
        },
        academic: {
          gpa: 3.8,
          intendedMajor: "Computer Science",
          highSchool: "Westlake High School",
        },
        availability: {
          transferPortal: false,
          preferredRegions: ["Southwest", "Southeast"],
        },
      },
      narrative:
        "Marcus es un point guard dinámico con visión de cancha excepcional y cualidades de liderazgo. Su ratio de asistencias a pérdidas (3.2:1) está muy por encima del promedio nacional para su grupo de edad. Tendencia reciente muestra mejora consistente en eficiencia de tiro.",
    },
  },
  {
    id: "uuid-3",
    email: "ana.lopez@example.com",
    name: "Ana López",
    role: "athlete",
    sport: "Soccer",
    position: "Midfielder",
    graduationYear: 2026,
    gpa: 3.9,
    region: "Southwest",
    avatarUrl: undefined,
    dossier: {
      completeness: 0.25,
      data: {
        identity: {
          sport: "Soccer",
          position: "Midfielder",
          graduationYear: 2026,
          hometown: "San Diego, CA",
        },
        performance: {
          stats: { goalsPerSeason: 12, assistsPerSeason: 18 },
          leagueLevel: "Club",
        },
        academic: {
          gpa: 3.9,
          highSchool: "Del Norte High School",
        },
        availability: {
          transferPortal: false,
          preferredRegions: ["West Coast"],
        },
      },
      narrative:
        "Ana es una mediocampista creativa con excelente control del balón. Su perfil académico es sobresaliente. Necesita completar secciones de rendimiento físico y disponibilidad para mejorar visibilidad con reclutadores.",
    },
  },
];

// Quick access by id
export function getAthleteById(id: string): Athlete | undefined {
  return mockAthletes.find((a) => a.id === id);
}
