import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import athletesSeedData from './athletes_seed.json';

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
    // Only set on create — re-running the seed (e.g. every staging deploy)
    // must not reset onboarding progress a real login already completed.
    update: { verificationStatus: 'verified' },
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
      // Left false intentionally — the first login should walk through
      // Billy's onboarding chat rather than skip straight to search.
      onboardingCompleted: false,
      verificationStatus: 'verified',
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

  // ── Coaches adicionales (uno por deporte) ───────────────────────────────────
  const additionalRecruiters = [
    {
      email: 'coach.reyes@university.edu',
      name: 'Coach Ana Reyes',
      university: 'Coastal State University',
      location: 'Miami, FL',
      scholarshipType: 'partial',
      sport: 'baseball',
      gender: 'male',
      division: 'D1',
      openings: 4,
      organizationType: 'College / University',
      recruiterRole: 'Head Coach',
      positions: 'Pitchers, Catchers',
      graduatingClasses: '2026, 2027',
      evaluationPriority: 'Athleticism',
      filterCriteria: 'Minimum GPA, Position',
      pitch: 'Coach Reyes runs a competitive D1 Baseball program at Coastal State University in Miami, FL, with four open roster spots and a strong track record of developing pitchers and catchers for pro ball.',
    },
    {
      email: 'coach.obrien@university.edu',
      name: "Coach Liam O'Brien",
      university: 'Pacific Coast University',
      location: 'San Diego, CA',
      scholarshipType: 'full',
      sport: 'soccer',
      gender: 'female',
      division: 'D1',
      openings: 2,
      organizationType: 'College / University',
      recruiterRole: 'Assistant Coach',
      positions: 'Forwards, Midfielders',
      graduatingClasses: '2027, 2028',
      evaluationPriority: 'Development Potential',
      filterCriteria: 'Location',
      pitch: "Coach O'Brien coaches D1 Women's Soccer at Pacific Coast University in San Diego, CA, offering full scholarships and a proven development pipeline for forwards and midfielders.",
    },
    {
      email: 'coach.patel@university.edu',
      name: 'Coach Priya Patel',
      university: 'Lakeshore University',
      location: 'Chicago, IL',
      scholarshipType: 'full',
      sport: 'volleyball',
      gender: 'female',
      division: 'D2',
      openings: 3,
      organizationType: 'College / University',
      recruiterRole: 'Head Coach',
      positions: 'Outside Hitters, Setters',
      graduatingClasses: '2026, 2027, 2028',
      evaluationPriority: 'Coachability',
      filterCriteria: 'Height / Weight',
      pitch: "Coach Patel leads D2 Volleyball at Lakeshore University in Chicago, IL, with three open spots this cycle for outside hitters and setters who thrive in a high-coachability culture.",
    },
    {
      email: 'coach.turner@university.edu',
      name: 'Coach Malik Turner',
      university: 'Northgate University',
      location: 'Charlotte, NC',
      scholarshipType: 'full',
      sport: 'basketball',
      gender: 'male',
      division: 'D1',
      openings: 2,
      organizationType: 'College / University',
      recruiterRole: 'Recruiting Coordinator',
      positions: 'Guards, Forwards',
      graduatingClasses: '2025, 2026',
      evaluationPriority: 'Film',
      filterCriteria: 'Minimum GPA',
      pitch: 'Coach Turner recruits for D1 Basketball at Northgate University in Charlotte, NC, with two full-scholarship spots open for guards and forwards who grade out well on film.',
    },
    {
      email: 'coach.stone@university.edu',
      name: 'Coach Emily Stone',
      university: 'Ridgeview University',
      location: 'Columbus, OH',
      scholarshipType: 'partial',
      sport: 'football',
      gender: 'male',
      division: 'D2',
      openings: 5,
      organizationType: 'College / University',
      recruiterRole: 'Position Coach',
      positions: 'Offensive Line, Defensive Backs',
      graduatingClasses: '2026, 2027',
      evaluationPriority: 'Physical Traits',
      filterCriteria: 'Position, Location',
      pitch: 'Coach Stone develops offensive linemen and defensive backs for D2 Football at Ridgeview University in Columbus, OH, with five open roster spots this cycle.',
    },
  ];

  for (const r of additionalRecruiters) {
    const recruiter = await prisma.recruiter.upsert({
      where: { email: r.email },
      // Only set on create — re-running the seed (e.g. every staging deploy)
      // must not reset onboarding progress a real login already completed.
      update: { verificationStatus: 'verified' },
      create: {
        organizationId: org.id,
        email: r.email,
        name: r.name,
        university: r.university,
        location: r.location,
        scholarshipType: r.scholarshipType,
        sport: r.sport,
        gender: r.gender,
        division: r.division,
        openings: r.openings,
        organizationType: r.organizationType,
        recruiterRole: r.recruiterRole,
        positions: r.positions,
        graduatingClasses: r.graduatingClasses,
        evaluationPriority: r.evaluationPriority,
        filterCriteria: r.filterCriteria,
        // Left false intentionally — the first login should walk through
        // Billy's onboarding chat rather than skip straight to search.
        onboardingCompleted: false,
        verificationStatus: 'verified',
        pitch: r.pitch,
      },
    });

    await prisma.user.upsert({
      where: { email: r.email },
      update: { recruiterId: recruiter.id },
      create: {
        email: r.email,
        password: recruiterPassword,
        role: 'RECRUITER',
        recruiterId: recruiter.id,
      },
    });

    console.log(`  ✓ Recruiter: ${r.email} / recruiter123 (${r.sport})`);
  }

  // ── Atletas ───────────────────────────────────────────────────────────────
  const athletePassword = await bcrypt.hash('athlete123', 12);

  interface AthleteSeedJson {
    fullName: string;
    email: string;
    sport: string;
    position: string;
    leagueLevel: string;
    heightCm: number;
    weightKg: number;
    nationality: string;
    graduationYear: number;
    ncaaEligible: boolean;
    inTransferPortal: boolean;
    preferredRegions: string[];
    scholarshipNeed: boolean;
    gpa: number;
    satScore: number;
    intendedMajor: string;
    trajectory: string;
    highlightUrls: string[];
    keyStrengths: string[];
    fitTags: string[];
    narrativeScore: number;
    completenessScore: number;
    stats: Record<string, number>;
  }

  const athletes = (athletesSeedData as AthleteSeedJson[]).map((a) => {
    const { fullName, email, sport, position, narrativeScore, completenessScore, trajectory, ...rest } = a;
    const trajectoryUpper = trajectory.toUpperCase();
    const trajectoryLabel =
      trajectoryUpper === 'IMPROVING'
        ? 'a rapidly improving'
        : trajectoryUpper === 'DECLINING'
          ? 'a declining'
          : 'a consistent';

    return {
      email,
      name: fullName,
      sport,
      position,
      dossier: {
        completeness: completenessScore,
        narrative: `${rest.leagueLevel} ${position} in ${sport} with ${trajectoryLabel} trajectory. Key strengths: ${rest.keyStrengths.slice(0, 3).join(', ')}.`,
        advocacyScore: narrativeScore,
        data: { ...rest, trajectory: trajectoryUpper },
      },
    };
  });

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
  console.log('  Recruiters: coach@university.edu / recruiter123 (+5 more, same password)');
  console.log('  Athletes:   [email] / athlete123');
  console.log(
    `\n✅ Seed complete — ${athletes.length} athletes + ${1 + additionalRecruiters.length} recruiters`,
  );
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