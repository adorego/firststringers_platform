import { BillyPromptService } from '../billy-prompt.service';

describe('BillyPromptService', () => {
  const service = new BillyPromptService();

  it('builds an objective-first recruiting intelligence prompt', () => {
    const prompt = service.buildSystemPrompt({
      conversationId: 'conversation-1',
      recruiterId: 'recruiter-1',
      messages: [],
      searchCriteria: {},
      missingFields: [],
      isOnboarding: false,
      createdAt: new Date('2026-07-23T00:00:00.000Z'),
      updatedAt: new Date('2026-07-23T00:00:00.000Z'),
    });

    expect(prompt).toContain('Director of Recruiting Intelligence');
    expect(prompt).toContain('recruiting objective');
    expect(prompt).toContain('reduce uncertainty');
    expect(prompt).toContain('one high-value clarifying question');
    expect(prompt).not.toContain('professional scouts');
  });
});
