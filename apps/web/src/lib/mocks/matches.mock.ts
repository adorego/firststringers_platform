import type { MatchResult } from "@/types";
import { mockAthletes } from "./athlete.mock";

export const mockMatchResults: MatchResult[] = [
  {
    athlete: mockAthletes[0], // Carlos Méndez
    fitScore: 92,
    breakdown: [
      { category: "Athletic Stats", score: 95 },
      { category: "Academic", score: 88 },
      { category: "Region Fit", score: 90 },
      { category: "Position Need", score: 96 },
    ],
    aiSummary:
      "Quarterback dual-threat con números elite de pase y GPA competitivo. Encaja perfectamente con programas D1 de conferencia media que buscan un QB titular inmediato. Su experiencia en transfer portal lo hace disponible para la próxima temporada.",
    isNew: true,
  },
  {
    athlete: mockAthletes[1], // Marcus Johnson
    fitScore: 87,
    breakdown: [
      { category: "Athletic Stats", score: 90 },
      { category: "Academic", score: 92 },
      { category: "Region Fit", score: 80 },
      { category: "Position Need", score: 85 },
    ],
    aiSummary:
      "Point guard dinámico con excelente visión de cancha. Su ratio de asistencias/pérdidas (3.2:1) es excepcional. Perfil académico fuerte para programas que priorizan el rendimiento escolar. Class of 2027 — ideal para recruiting temprano.",
    isNew: true,
  },
  {
    athlete: mockAthletes[2], // Ana López
    fitScore: 74,
    breakdown: [
      { category: "Athletic Stats", score: 78 },
      { category: "Academic", score: 95 },
      { category: "Region Fit", score: 60 },
      { category: "Position Need", score: 65 },
    ],
    aiSummary:
      "Mediocampista creativa con perfil académico sobresaliente. Destaca en asistencias y visión de juego. Dossier incompleto (25%) — necesita más datos de rendimiento físico para mejorar matching.",
    isNew: false,
  },
  {
    athlete: {
      id: "uuid-4",
      email: "james.wright@example.com",
      name: "James Wright",
      role: "athlete",
      sport: "Football",
      position: "Wide Receiver",
      graduationYear: 2025,
      gpa: 3.2,
      region: "Southeast",
      dossier: {
        completeness: 0.71,
        data: {
          identity: {
            sport: "Football",
            position: "Wide Receiver",
            graduationYear: 2025,
            height: "6'0\"",
            weight: "180 lbs",
            hometown: "Atlanta, GA",
          },
          performance: {
            stats: { receptions: 58, receivingYards: 920, touchdowns: 11 },
            leagueLevel: "D1",
          },
          academic: {
            gpa: 3.2,
            intendedMajor: "Communications",
            highSchool: "Grady High School",
          },
          availability: {
            transferPortal: false,
            preferredRegions: ["Southeast", "Midwest"],
          },
        },
        narrative:
          "Wide receiver con velocidad y manos seguras. Rendimiento consistente en tercera temporada como titular. Necesita mejorar route running para el siguiente nivel.",
      },
    },
    fitScore: 68,
    breakdown: [
      { category: "Athletic Stats", score: 72 },
      { category: "Academic", score: 65 },
      { category: "Region Fit", score: 75 },
      { category: "Position Need", score: 60 },
    ],
    aiSummary:
      "Wide receiver consistente con buenas estadísticas de recepción. GPA aceptable pero no destacado. Buen fit regional para programas del Southeast que necesitan profundidad en WR.",
    isNew: false,
  },
  {
    athlete: {
      id: "uuid-5",
      email: "sofia.ramirez@example.com",
      name: "Sofía Ramírez",
      role: "athlete",
      sport: "Basketball",
      position: "Shooting Guard",
      graduationYear: 2026,
      gpa: 3.6,
      region: "West Coast",
      dossier: {
        completeness: 0.63,
        data: {
          identity: {
            sport: "Basketball",
            position: "Shooting Guard",
            graduationYear: 2026,
            height: "5'8\"",
            weight: "145 lbs",
            hometown: "Los Angeles, CA",
          },
          performance: {
            stats: { pointsPerGame: 15.4, threePointPct: 38, freeThrowPct: 85 },
            leagueLevel: "Varsity",
          },
          academic: {
            gpa: 3.6,
            sat: 1220,
            intendedMajor: "Psychology",
            highSchool: "Mater Dei High School",
          },
          availability: {
            transferPortal: false,
            preferredRegions: ["West Coast", "Southwest"],
          },
        },
        narrative:
          "Shooting guard con tiro confiable desde la línea de tres. Excelente en tiros libres lo que indica mecánica sólida. Buena opción para programas que necesitan spacing y shooting.",
      },
    },
    fitScore: 61,
    breakdown: [
      { category: "Athletic Stats", score: 70 },
      { category: "Academic", score: 75 },
      { category: "Region Fit", score: 50 },
      { category: "Position Need", score: 48 },
    ],
    aiSummary:
      "Shooting guard con tiro confiable (38% desde tres). Buen perfil académico. Fit regional limitado si el programa busca fuera del West Coast. Sería mejor match para programas D2/D3 con énfasis académico.",
    isNew: true,
  },
];
