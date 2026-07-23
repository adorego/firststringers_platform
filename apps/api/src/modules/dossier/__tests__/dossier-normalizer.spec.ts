import {
  calculateDossierCompleteness,
  normalizeDossierData,
} from '../dossier-normalizer';

describe('dossier normalizer', () => {
  it('normalizes legacy flat dossier fields into the nested dossier shape', () => {
    const normalized = normalizeDossierData({
      identity: {
        sport: 'football',
        position: 'QB',
      },
      graduationYear: 2025,
      nationality: 'US',
      gpa: 3.7,
      satScore: 1240,
      intendedMajor: 'Business Administration',
      ncaaEligible: true,
      heightCm: 188,
      weightKg: 95,
      leagueLevel: 'Varsity',
      keyStrengths: ['pocket presence', 'leadership'],
      stats: {
        passing_yards: 3240,
        touchdowns: 28,
      },
      highlightUrls: ['https://hudl.com/video/123'],
      preferredRegions: ['Midwest', 'South'],
      scholarshipNeed: true,
      inTransferPortal: false,
    });

    expect(normalized.identity).toEqual({
      sport: 'football',
      position: 'QB',
      graduationYear: 2025,
      nationality: 'US',
    });
    expect(normalized.performance).toEqual({
      leagueLevel: 'Varsity',
      strengths: ['pocket presence', 'leadership'],
      stats: {
        passingYards: 3240,
        touchdowns: 28,
      },
      physicalProfile: {
        height: '188 cm',
        weight: '95 kg',
      },
      highlightUrls: ['https://hudl.com/video/123'],
    });
    expect(normalized.academic).toEqual({
      gpa: 3.7,
      satAct: 1240,
      intendedMajor: 'Business Administration',
      ncaaEligibility: true,
    });
    expect(normalized.availability).toEqual({
      preferredRegions: ['Midwest', 'South'],
      scholarshipNeed: true,
      transferPortal: false,
    });
    expect(normalized.media).toEqual({
      highlightUrls: ['https://hudl.com/video/123'],
    });

    expect((normalized as Record<string, unknown>).gpa).toBeUndefined();
    expect((normalized as Record<string, unknown>).stats).toBeUndefined();
    expect(
      (normalized as Record<string, unknown>).preferredRegions,
    ).toBeUndefined();
    expect(calculateDossierCompleteness(normalized)).toBeGreaterThan(0.35);
  });

  it('keeps newer nested values when legacy fields are also present', () => {
    const normalized = normalizeDossierData({
      gpa: 3.1,
      heightCm: 180,
      stats: {
        passing_yards: 1200,
      },
      academic: {
        gpa: 3.9,
      },
      performance: {
        physicalProfile: {
          height: "6'2",
        },
        stats: {
          completionRate: 64,
        },
      },
    });

    expect(normalized.academic?.gpa).toBe(3.9);
    expect(normalized.performance?.physicalProfile?.height).toBe("6'2");
    expect(normalized.performance?.stats).toEqual({ completionRate: 64 });
  });
});
