import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ── Organización base ─────────────────────────────────────────────────────
  const org = await prisma.organization.upsert({
    where: { id: 'seed-org-001' },
    update: {},
    create: { id: 'seed-org-001', name: 'First Stringers' },
  });
  console.log(`  ✓ Organization: ${org.name}`);

  // ── Recruiter ─────────────────────────────────────────────────────────────
  const recruiterPassword = await bcrypt.hash('recruiter123', 12);

  const recruiterRecord = await prisma.recruiter.upsert({
    where: { email: 'coach@university.edu' },
    update: {},
    create: {
      id: 'e0b6c0c8-2b27-4521-9b26-46ace16b4983',
      organizationId: org.id,
      email: 'coach@university.edu',
      name: 'Coach Rivera',
      university: 'State University',
      location: 'Austin, TX',
      scholarshipType: 'full',
      sport: 'football',
      gender: 'male',
      division: 'D1',
      openings: 3,
      onboardingCompleted: true,
      pitch: 'Coach Rivera leads a competitive D1 Football program at State University in Austin, TX — one of the most vibrant college towns in the country. We offer full scholarships and have three open roster spots this cycle, making this a rare opportunity to join a program with strong winning culture and genuine investment in player development.',
    },
  });

  await prisma.user.upsert({
    where: { email: 'coach@university.edu' },
    update: { recruiterId: recruiterRecord.id },
    create: {
      email: 'coach@university.edu',
      password: recruiterPassword,
      role: 'RECRUITER',
      recruiterId: recruiterRecord.id,
    },
  });
  console.log(`  ✓ Recruiter: coach@university.edu / recruiter123`);

  // ── Atletas ───────────────────────────────────────────────────────────────
  const athletePassword = await bcrypt.hash('athlete123', 12);

  const athletes = [
    {
      email: 'marcus.johnson@athlete.fscout.ai',
      name: 'Marcus Johnson',
      sport: 'football',
      position: 'QB',
      dossier: {
        completeness: 0.95,
        narrative: 'Elite dual-threat QB with 3 years of D1 experience.',
        advocacyScore: 0.91,
        data: {
          leagueLevel: 'D1', heightCm: 188, weightKg: 95,
          graduationYear: 2025, ncaaEligible: true, inTransferPortal: true,
          preferredRegions: ['Midwest', 'South'], scholarshipNeed: true,
          gpa: 3.7, intendedMajor: 'Business Administration',
          trajectory: 'IMPROVING',
          keyStrengths: ['dual-threat', 'pocket presence', 'leadership', 'arm strength'],
          fitTags: ['QB', 'dual-threat', 'D1', 'Midwest', 'transfer'],
          stats: { passing_yards: 3240, touchdowns: 28, interceptions: 6, completion_rate: 0.67, rushing_yards: 540 },
          recruiterPitch: 'Marcus Johnson is a D1 QB with 3.7 GPA. Elite dual-threat with 28 TDs and improving trajectory.',
        },
      },
    },
    {
      email: 'jordan.williams@athlete.fscout.ai',
      name: 'Jordan Williams',
      sport: 'football',
      position: 'WR',
      dossier: {
        completeness: 0.88,
        narrative: 'Explosive WR with elite route running and YAC ability.',
        advocacyScore: 0.85,
        data: {
          leagueLevel: 'D1', heightCm: 185, weightKg: 88,
          graduationYear: 2025, ncaaEligible: true, inTransferPortal: false,
          preferredRegions: ['Northeast', 'Midwest'], scholarshipNeed: false,
          gpa: 3.5, intendedMajor: 'Communications',
          trajectory: 'IMPROVING',
          keyStrengths: ['route running', 'hands', 'speed', 'YAC'],
          fitTags: ['WR', 'speed', 'D1', 'Northeast'],
          stats: { receptions: 72, receiving_yards: 1140, touchdowns: 11, yards_per_reception: 15.8 },
          recruiterPitch: 'Jordan Williams is a D1 WR with elite route running and 1140 receiving yards.',
        },
      },
    },
    {
      email: 'darius.thompson@athlete.fscout.ai',
      name: 'Darius Thompson',
      sport: 'football',
      position: 'QB',
      dossier: {
        completeness: 0.82,
        narrative: 'Strong-armed D2 QB looking to step up to D1.',
        advocacyScore: 0.78,
        data: {
          leagueLevel: 'D2', heightCm: 190, weightKg: 98,
          graduationYear: 2026, ncaaEligible: true, inTransferPortal: true,
          preferredRegions: ['South', 'Midwest', 'West'], scholarshipNeed: true,
          gpa: 3.2, intendedMajor: 'Kinesiology',
          trajectory: 'STABLE',
          keyStrengths: ['arm strength', 'mobility', 'red zone efficiency'],
          fitTags: ['QB', 'D2', 'transfer', 'South'],
          stats: { passing_yards: 2800, touchdowns: 22, interceptions: 8, completion_rate: 0.62, rushing_yards: 320 },
          recruiterPitch: 'Darius Thompson is a D2 QB in the transfer portal with strong arm and 22 TDs.',
        },
      },
    },
    {
      email: 'tyrell.jackson@athlete.fscout.ai',
      name: 'Tyrell Jackson',
      sport: 'football',
      position: 'RB',
      dossier: {
        completeness: 0.92,
        narrative: 'Complete back with elite vision and receiving ability.',
        advocacyScore: 0.89,
        data: {
          leagueLevel: 'D1', heightCm: 180, weightKg: 92,
          graduationYear: 2025, ncaaEligible: true, inTransferPortal: true,
          preferredRegions: ['South', 'Southeast'], scholarshipNeed: false,
          gpa: 3.8, intendedMajor: 'Sports Management',
          trajectory: 'IMPROVING',
          keyStrengths: ['vision', 'burst', 'pass blocking', 'hands'],
          fitTags: ['RB', 'D1', 'South', 'transfer', 'high-GPA'],
          stats: { rushing_yards: 1420, touchdowns: 14, yards_per_carry: 5.8, receptions: 34, receiving_yards: 280 },
          recruiterPitch: 'Tyrell Jackson is a D1 RB with 3.8 GPA and 1420 rushing yards. Elite hands out of the backfield.',
        },
      },
    },
    {
      email: 'cameron.rodriguez@athlete.fscout.ai',
      name: 'Cameron Rodriguez',
      sport: 'football',
      position: 'QB',
      dossier: {
        completeness: 0.90,
        narrative: 'High-IQ dual-threat QB who thrives under pressure.',
        advocacyScore: 0.88,
        data: {
          leagueLevel: 'D1', heightCm: 186, weightKg: 93,
          graduationYear: 2025, ncaaEligible: true, inTransferPortal: false,
          preferredRegions: ['West', 'Southwest'], scholarshipNeed: true,
          gpa: 3.6, intendedMajor: 'Psychology',
          trajectory: 'IMPROVING',
          keyStrengths: ['dual-threat', 'football IQ', 'clutch performance', 'leadership'],
          fitTags: ['QB', 'dual-threat', 'D1', 'West'],
          stats: { passing_yards: 2980, touchdowns: 25, interceptions: 5, completion_rate: 0.69, rushing_yards: 620 },
          recruiterPitch: 'Cameron Rodriguez is a D1 QB with 3.6 GPA. Elite football IQ and clutch performer.',
        },
      },
    },
    {
      email: 'devon.marshall@athlete.fscout.ai',
      name: 'Devon Marshall',
      sport: 'basketball',
      position: 'PG',
      dossier: {
        completeness: 0.96,
        narrative: 'Elite playmaker with one of the highest GPAs in the portal.',
        advocacyScore: 0.93,
        data: {
          leagueLevel: 'D1', heightCm: 183, weightKg: 79,
          graduationYear: 2025, ncaaEligible: true, inTransferPortal: true,
          preferredRegions: ['Northeast', 'Midwest'], scholarshipNeed: false,
          gpa: 3.9, intendedMajor: 'Computer Science',
          trajectory: 'IMPROVING',
          keyStrengths: ['court vision', 'playmaking', 'three-point shooting', 'defense'],
          fitTags: ['PG', 'basketball', 'D1', 'high-GPA', 'transfer'],
          stats: { points_per_game: 18.4, assists_per_game: 7.2, rebounds_per_game: 4.1, three_point_pct: 0.41 },
          recruiterPitch: 'Devon Marshall is a D1 PG with 3.9 GPA averaging 18.4 PPG and 7.2 APG.',
        },
      },
    },
    {
      email: 'isaiah.carter@athlete.fscout.ai',
      name: 'Isaiah Carter',
      sport: 'basketball',
      position: 'SF',
      dossier: {
        completeness: 0.85,
        narrative: 'Athletic wing with elite defensive instincts.',
        advocacyScore: 0.82,
        data: {
          leagueLevel: 'D1', heightCm: 201, weightKg: 102,
          graduationYear: 2026, ncaaEligible: true, inTransferPortal: false,
          preferredRegions: ['South', 'Southeast', 'Midwest'], scholarshipNeed: true,
          gpa: 3.3, intendedMajor: 'Exercise Science',
          trajectory: 'IMPROVING',
          keyStrengths: ['athleticism', 'versatility', 'rebounding', 'shot blocking'],
          fitTags: ['SF', 'basketball', 'D1', 'South'],
          stats: { points_per_game: 15.2, rebounds_per_game: 8.4, blocks_per_game: 1.9, fg_percentage: 0.52 },
          recruiterPitch: 'Isaiah Carter is a D1 SF with elite athleticism and 1.9 blocks per game.',
        },
      },
    },
    {
      email: 'trevor.adams@athlete.fscout.ai',
      name: 'Trevor Adams',
      sport: 'football',
      position: 'OL',
      dossier: {
        completeness: 0.83,
        narrative: 'Experienced OL with elite pass protection skills.',
        advocacyScore: 0.80,
        data: {
          leagueLevel: 'D1', heightCm: 196, weightKg: 140,
          graduationYear: 2025, ncaaEligible: true, inTransferPortal: true,
          preferredRegions: ['South', 'Midwest'], scholarshipNeed: false,
          gpa: 3.4, intendedMajor: 'Business',
          trajectory: 'STABLE',
          keyStrengths: ['pass protection', 'run blocking', 'footwork', 'strength'],
          fitTags: ['OL', 'D1', 'South', 'transfer'],
          stats: { pancake_blocks: 42, pressures_allowed: 8, sacks_allowed: 2 },
          recruiterPitch: 'Trevor Adams is a D1 OL with only 2 sacks allowed all season.',
        },
      },
    },
    {
      email: 'jaylen.brooks@athlete.fscout.ai',
      name: 'Jaylen Brooks',
      sport: 'football',
      position: 'CB',
      dossier: {
        completeness: 0.80,
        narrative: 'Press corner with elite ball-hawking instincts.',
        advocacyScore: 0.77,
        data: {
          leagueLevel: 'D1', heightCm: 182, weightKg: 84,
          graduationYear: 2025, ncaaEligible: true, inTransferPortal: true,
          preferredRegions: ['Northeast', 'Mid-Atlantic'], scholarshipNeed: true,
          gpa: 3.1, intendedMajor: 'Criminal Justice',
          trajectory: 'IMPROVING',
          keyStrengths: ['man coverage', 'ball hawk', 'press technique', 'speed'],
          fitTags: ['CB', 'D1', 'Northeast', 'defense'],
          stats: { interceptions: 5, pass_breakups: 14, tackles: 38, forced_fumbles: 2 },
          recruiterPitch: 'Jaylen Brooks is a D1 CB with 5 INTs and elite press coverage.',
        },
      },
    },
    {
      email: 'marcus.webb@athlete.fscout.ai',
      name: 'Marcus Webb',
      sport: 'football',
      position: 'QB',
      dossier: {
        completeness: 0.86,
        narrative: 'Surgical pocket passer with elite accuracy numbers.',
        advocacyScore: 0.83,
        data: {
          leagueLevel: 'D2', heightCm: 184, weightKg: 91,
          graduationYear: 2026, ncaaEligible: true, inTransferPortal: true,
          preferredRegions: ['Midwest', 'Great Plains'], scholarshipNeed: true,
          gpa: 3.5, intendedMajor: 'Education',
          trajectory: 'IMPROVING',
          keyStrengths: ['accuracy', 'pocket presence', 'decision making', 'leadership'],
          fitTags: ['QB', 'D2', 'Midwest', 'accuracy'],
          stats: { passing_yards: 3100, touchdowns: 26, interceptions: 4, completion_rate: 0.71, rushing_yards: 180 },
          recruiterPitch: 'Marcus Webb is a D2 QB with 71% completion rate. Ready to step up to D1.',
        },
      },
    },
  ];

  for (const { email, name, sport, position, dossier } of athletes) {
    // Crear usuario con contraseña hasheada
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        password: athletePassword,
        role: 'ATHLETE',
      },
    });

    // Crear atleta
    const athlete = await prisma.athlete.upsert({
      where: { email },
      update: {},
      create: {
        organizationId: org.id,
        email,
        name,
        sport,
        position,
      },
    });

    // Vincular user → athlete
    await prisma.user.update({
      where: { id: user.id },
      data: { athleteId: athlete.id },
    });

    // Crear dossier
    await prisma.dossier.upsert({
      where: { athleteId: athlete.id },
      update: {
        data: dossier.data,
        completeness: dossier.completeness,
      },
      create: {
        athleteId: athlete.id,
        data: dossier.data,
        completeness: dossier.completeness,
        narrative: dossier.narrative,
        advocacyScore: dossier.advocacyScore,
      },
    });

    console.log(`  ✓ ${name} (${position} · ${sport})`);
  }

  console.log('\n📋 Credentials:');
  console.log('  Recruiter: coach@university.edu / recruiter123');
  console.log('  Athletes:  [email] / athlete123');
  console.log(`\n✅ Seed complete — ${athletes.length} athletes + 1 recruiter`);
  // Generar pitches iniciales para todos los atletas
  console.log('\n🤖 Generating Jerry pitches...');
  const allAthletes = await prisma.athlete.findMany({ include: { dossier: true } });

  for (const athlete of allAthletes) {
    if (!athlete.dossier) continue;
    const d = (athlete.dossier.data as any) ?? {};

    const pitch = `I'm Jerry, representing ${athlete.name} — a ${d.leagueLevel ?? ''} ${athlete.position ?? ''} with a ${d.gpa ?? ''}  GPA and ${d.trajectory === 'IMPROVING' ? 'rapidly improving' : 'consistent'} trajectory. ${athlete.dossier.narrative ?? ''} Key strengths include ${(d.keyStrengths ?? []).slice(0, 3).join(', ')}. ${d.inTransferPortal ? 'Currently available in the transfer portal — ' : ''}Act now before other programs do.`;

    await prisma.jerrySession.upsert({
      where: { athleteId: athlete.id },
      update: { currentPitch: pitch, pitchVersion: { increment: 1 }, lastPitchAt: new Date() },
      create: { athleteId: athlete.id, status: 'active', currentPitch: pitch, pitchVersion: 1, lastPitchAt: new Date(), messages: [] },
    });

    console.log(`  ✓ Pitch ready for ${athlete.name}`);
  }
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });