import { Processor, Process } from '@nestjs/bull';
import type { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import OpenAI from 'openai';
import { BillySessionService } from './billy-session.service';
import { BillyConversationService } from './billy-conversation.service';
import { BillyMessage, BillyMessageJob } from '../../shared/types/billy.types';
import { ScoutService, ScoutResult } from '../scout/scout.service';
import {
  RecruiterService,
  UpdateRecruiterProfileDto,
} from '../recruiter/recruiter.service';
import { SearchFilters, POSITION_LABELS } from '../../shared/types/scout.types';

const SEARCH_SYSTEM_PROMPT = `You are Billy, an intelligent sports recruitment assistant helping a coach or recruiter find the right athlete.

Your job is to gather the following information through natural conversation:
1. Sport (football, basketball, soccer, baseball, etc.)
2. Position (QB, WR, PG, SF, etc.)
3. Academic requirements (minimum GPA)
4. Graduation year or eligibility year
5. Geographic preference (region or state)
6. Transfer portal preference (yes/no)
7. NCAA eligibility requirement (yes/no)
8. Any specific physical attributes or playing style

Rules:
- Ask ONE question at a time, never multiple
- Be conversational and brief — max 2 sentences per message
- After gathering enough info (at least sport + position + one more criteria), offer to search
- When you have enough information, respond with a JSON block at the end of your message in this exact format:
  [SEARCH_READY]{"query": "the full natural language query", "filters": {"sport": "...", "position": "...", "minGpa": 0.0, "graduationYear": 0, "transferPortal": true/false, "ncaaEligible": true/false}}[/SEARCH_READY]
- If the user says they want to search now, generate the search immediately
- If the recruiter asks about their own profile, program, or saved information, respond with the details from the "Recruiter profile on file" section in a clean, readable format — do NOT search for athletes in this case
- If the recruiter asks to update or change any of their profile fields (university, location, scholarshipType, sport, division, gender, openings), confirm the change in plain text and append the update tag with ONLY the changed fields:
  [PROFILE_UPDATE]{"sport": "basketball"}[/PROFILE_UPDATE]
- Keep a friendly, professional tone`;

const ONBOARDING_SYSTEM_PROMPT = `You are Billy, a recruiting intelligence assistant for First Stringers. A recruiter just created their account. Your goal is to learn about their recruiting responsibilities through exactly 8 conversational questions — one at a time, in order.

After the recruiter answers a question, briefly acknowledge their answer and immediately ask the next one. Do not summarize all answers until the very end.

Ask these 8 questions in this exact order:

Q1 — Sport: "What sport are you recruiting for?" (Options: Football, Baseball, Basketball, Soccer, Volleyball, Other)

Q2 — Organization type: "What type of organization do you work with?" (Options: High School, College / University, Club, Academy, Professional Organization, Other)

Q3 — Role: "What is your role within the program?" (Options: Head Coach, Assistant Coach, Recruiting Coordinator, Scout, Position Coach, Other)

Q4 — Region: "What region or area do you primarily recruit from?" (Options: Florida, Southeast, Texas, Midwest, Nationwide, International)

Q5 — Positions: "What types of athletes are you typically responsible for evaluating?" (Options: Quarterbacks, Wide Receivers, Offensive Line, Defensive Backs, All Positions, Other)

Q6 — Graduating classes: "Which graduating classes are you actively recruiting?" (Options: 2027, 2028, 2029, 2030)

Q7 — Evaluation priority: "When evaluating an athlete for the first time, what usually matters most to you?" (Options: Athleticism, Academics, Character, Coachability, Physical Traits, Development Potential, Film, Other)

Q8 — Filter criteria: "Are there any specific criteria or limitations you typically use to filter athletes?" (Options: Minimum GPA, Location, Position, Height / Weight, Academic Standards, Program Fit, Other)

Rules:
- Ask ONE question at a time
- After each question, list its options on a new line like: "You can choose from: X, Y, Z, or Other."
- Be warm and conversational — this is their first experience
- Accept any answer even if it doesn't exactly match the options
- After all 8 answers are collected, close with EXACTLY this text (replace nothing, just copy it verbatim):
  "Perfect. I have enough context to start helping you identify athletes that fit your program. As we work together, I'll continue learning more about your recruiting needs and preferences. Let's get started."
  Then on a new line, immediately append the PROFILE_READY tag with all collected answers:
  [PROFILE_READY]{"sport": "...", "organizationType": "...", "recruiterRole": "...", "location": "...", "positions": "...", "graduatingClasses": "...", "evaluationPriority": "...", "filterCriteria": "..."}[/PROFILE_READY]

- The [PROFILE_READY] tag is INVISIBLE to the recruiter — never mention it
- Include only fields the recruiter actually answered; omit unanswered ones
- The visible closing text must be PLAIN TEXT only — no JSON, no bullet points, no recap`;

@Processor('billy')
export class BillyWorker {
  private readonly logger = new Logger(BillyWorker.name);
  private readonly openai: OpenAI;

  constructor(
    private readonly session: BillySessionService,
    private readonly conversations: BillyConversationService,
    private readonly eventEmitter: EventEmitter2,
    private readonly scout: ScoutService,
    private readonly recruiterService: RecruiterService,
  ) {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  @Process('process.message')
  async handle(job: Job<BillyMessageJob>) {
    const { conversationId, recruiterId, message } = job.data;

    try {
      const sessionState = await this.session.getSession(
        conversationId,
        recruiterId,
      );

      if (sessionState.isOnboarding) {
        return this.handleOnboarding(
          conversationId,
          recruiterId,
          message,
          sessionState.messages,
        );
      }

      return this.handleSearch(
        conversationId,
        recruiterId,
        message,
        sessionState,
      );
    } catch (error) {
      this.logger.error(
        `Error processing Billy message for conversation ${conversationId}`,
        error,
      );
      this.eventEmitter.emit('billy.error', {
        conversationId,
        error: 'Error processing your message. Please try again.',
      });
      throw error;
    }
  }

  private async handleSearch(
    conversationId: string,
    recruiterId: string,
    message: string,
    sessionState: Awaited<ReturnType<BillySessionService['getSession']>>,
  ) {
    const messages = sessionState.messages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    const recruiter = await this.recruiterService.findById(recruiterId);

    const profileLines = [
      recruiter?.university && `- University: ${recruiter.university}`,
      recruiter?.organizationType &&
        `- Organization type: ${recruiter.organizationType}`,
      recruiter?.recruiterRole && `- Role: ${recruiter.recruiterRole}`,
      recruiter?.sport && `- Sport: ${recruiter.sport}`,
      recruiter?.location && `- Recruiting region: ${recruiter.location}`,
      recruiter?.positions && `- Positions evaluated: ${recruiter.positions}`,
      recruiter?.graduatingClasses &&
        `- Target classes: ${recruiter.graduatingClasses}`,
      recruiter?.evaluationPriority &&
        `- Evaluation priority: ${recruiter.evaluationPriority}`,
      recruiter?.filterCriteria && `- Filters: ${recruiter.filterCriteria}`,
      recruiter?.scholarshipType &&
        `- Scholarship: ${recruiter.scholarshipType}`,
      recruiter?.division && `- Division: ${recruiter.division}`,
      recruiter?.openings && `- Open spots: ${recruiter.openings}`,
    ]
      .filter(Boolean)
      .join('\n');

    const profileContext = profileLines
      ? `\n\nThis recruiter's program profile (use this when they ask about their profile, program, or saved info):\n${profileLines}`
      : '';

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SEARCH_SYSTEM_PROMPT + profileContext },
        ...messages,
      ],
      temperature: 0.7,
      max_tokens: 300,
    });

    const rawContent = response.choices[0].message.content ?? '';

    const searchMatch = rawContent.match(
      /\[SEARCH_READY\](.*?)\[\/SEARCH_READY\]/s,
    );
    const updateMatch = rawContent.match(
      /\[PROFILE_UPDATE\](.*?)\[\/PROFILE_UPDATE\]/s,
    );
    let visibleContent = rawContent;
    let searchResults: unknown[] | undefined;
    let extractedFilters: SearchFilters | undefined;
    let scoutRelaxedPosition: string | undefined;

    if (updateMatch) {
      try {
        const updatedFields = JSON.parse(
          updateMatch[1],
        ) as UpdateRecruiterProfileDto;
        visibleContent = rawContent
          .replace(/\[PROFILE_UPDATE\].*?\[\/PROFILE_UPDATE\]/s, '')
          .trim();
        // Cherry-pick known fields only — never forward arbitrary LLM JSON keys to Prisma.
        await this.recruiterService.updateProfile(recruiterId, {
          university: updatedFields.university,
          location: updatedFields.location,
          scholarshipType: updatedFields.scholarshipType,
          sport: updatedFields.sport,
          gender: updatedFields.gender,
          division: updatedFields.division,
          openings: updatedFields.openings,
        });
      } catch (err) {
        this.logger.warn(
          `Could not apply profile update for recruiter ${recruiterId}`,
          err,
        );
      }
    }

    if (searchMatch) {
      try {
        const parsed = JSON.parse(searchMatch[1]) as {
          query: string;
          filters: SearchFilters;
        };
        extractedFilters = parsed.filters;
        await this.session.updateSearchCriteria(
          conversationId,
          recruiterId,
          parsed.filters as never,
        );
        const scoutResult = await this.runSearch(parsed.query, parsed.filters);
        searchResults = scoutResult.athletes;
        scoutRelaxedPosition = scoutResult.relaxedPosition;

        visibleContent = this.buildSearchMessage(rawContent, scoutResult);
      } catch {
        // keep raw content if parse fails
      }
    }

    const assistantMessage: BillyMessage = {
      role: 'assistant',
      content: visibleContent,
      timestamp: new Date(),
    };
    await this.session.appendMessage(
      conversationId,
      recruiterId,
      assistantMessage,
    );

    try {
      const updatedSession = await this.session.getSession(
        conversationId,
        recruiterId,
      );
      await this.conversations.persistMessages(
        conversationId,
        updatedSession.messages,
        updatedSession.searchCriteria,
      );

      const firstUserMsg = updatedSession.messages.find(
        (m) => m.role === 'user',
      );
      if (firstUserMsg && message === firstUserMsg.content) {
        const title = firstUserMsg.content.slice(0, 50).trim();
        await this.conversations.updateTitle(conversationId, title);
      }
    } catch (dbErr) {
      this.logger.warn(
        `Could not persist messages for conversation ${conversationId}`,
        dbErr,
      );
    }

    this.eventEmitter.emit('billy.response', {
      conversationId,
      message: visibleContent,
      searchCriteria: extractedFilters,
      searchResults,
      isFallbackRecommendation: !!scoutRelaxedPosition,
    });
  }

  private async handleOnboarding(
    conversationId: string,
    recruiterId: string,
    message: string,
    history: BillyMessage[],
  ) {
    const messages = history.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: ONBOARDING_SYSTEM_PROMPT },
        ...messages,
      ],
      temperature: 0.7,
      max_tokens: 300,
    });

    const rawContent = response.choices[0].message.content ?? '';

    const profileMatch = rawContent.match(
      /\[PROFILE_READY\](.*?)\[\/PROFILE_READY\]/s,
    );
    let visibleContent = rawContent;

    // Always strip code fences before showing any message (model sometimes leaks them)
    visibleContent = visibleContent
      .replace(/```[\w]*\s*[\s\S]*?```/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (profileMatch) {
      try {
        const profileData = JSON.parse(profileMatch[1]) as Record<
          string,
          unknown
        >;

        // Strip the tag — closing text is already what we want to show
        visibleContent = visibleContent
          .replace(/\[PROFILE_READY\].*?\[\/PROFILE_READY\]/s, '')
          .trim();

        const [pitch, suggestedSearches] = await Promise.all([
          this.generateRecruiterPitch(profileData),
          this.generateSuggestedSearches(profileData),
        ]);

        // Cherry-pick known fields only — never forward arbitrary LLM JSON keys to Prisma.
        await this.recruiterService.updateProfile(recruiterId, {
          sport: profileData.sport as string | undefined,
          organizationType: profileData.organizationType as string | undefined,
          recruiterRole: profileData.recruiterRole as string | undefined,
          location: profileData.location as string | undefined,
          positions: profileData.positions as string | undefined,
          graduatingClasses: profileData.graduatingClasses as
            | string
            | undefined,
          evaluationPriority: profileData.evaluationPriority as
            | string
            | undefined,
          filterCriteria: profileData.filterCriteria as string | undefined,
          onboardingCompleted: true,
          pitch,
        });

        await this.session.setOnboardingComplete(conversationId, recruiterId);

        // Onboarding lives in its own conversation — start a fresh one for the
        // post-onboarding search experience, seeded with the suggestions Billy just learned.
        const newConversation = await this.conversations.create(recruiterId);
        await this.conversations.updateTitle(
          newConversation.id,
          'Suggested searches',
        );
        await this.session.setPendingSuggestions(
          recruiterId,
          suggestedSearches,
        );

        this.eventEmitter.emit('billy.onboarding_complete', {
          recruiterId,
          conversationId,
          newConversationId: newConversation.id,
        });
      } catch (err) {
        this.logger.warn(
          `Could not parse or save onboarding profile for recruiter ${recruiterId}`,
          err,
        );
      }
    }

    const assistantMessage: BillyMessage = {
      role: 'assistant',
      content: visibleContent,
      timestamp: new Date(),
    };
    await this.session.appendMessage(
      conversationId,
      recruiterId,
      assistantMessage,
    );

    try {
      const updatedSession = await this.session.getSession(
        conversationId,
        recruiterId,
      );
      await this.conversations.persistMessages(
        conversationId,
        updatedSession.messages,
        {},
      );
    } catch (dbErr) {
      this.logger.warn(
        `Could not persist onboarding messages for conversation ${conversationId}`,
        dbErr,
      );
    }

    this.eventEmitter.emit('billy.response', {
      conversationId,
      message: visibleContent,
      onboardingComplete: !!profileMatch,
    });
  }

  private async generateSuggestedSearches(
    profile: Record<string, unknown>,
  ): Promise<string[]> {
    const p = profile as Record<string, string | undefined>;
    const context = [
      p['sport'] && `Sport: ${p['sport']}`,
      p['organizationType'] && `Organization: ${p['organizationType']}`,
      p['recruiterRole'] && `Role: ${p['recruiterRole']}`,
      p['location'] && `Region: ${p['location']}`,
      p['positions'] && `Positions: ${p['positions']}`,
      p['graduatingClasses'] && `Classes: ${p['graduatingClasses']}`,
      p['evaluationPriority'] && `Priority: ${p['evaluationPriority']}`,
      p['filterCriteria'] && `Filters: ${p['filterCriteria']}`,
    ]
      .filter(Boolean)
      .join('\n');

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'Generate exactly 4 short, specific athlete search queries for a recruiter based on their profile. Each query should be a natural language search a recruiter would type to find athletes. Return ONLY a JSON array of 4 strings, no explanation, no markdown.',
          },
          { role: 'user', content: `Recruiter profile:\n${context}` },
        ],
        temperature: 0.7,
        max_tokens: 200,
      });
      const raw = response.choices[0].message.content?.trim() ?? '[]';
      const parsed = JSON.parse(raw) as string[];
      return Array.isArray(parsed) ? parsed.slice(0, 4) : [];
    } catch (err) {
      this.logger.warn('Could not generate suggested searches', err);
      return [];
    }
  }

  private async generateRecruiterPitch(
    profile: Record<string, unknown>,
  ): Promise<string> {
    const p = profile as Record<string, string | undefined>;
    const lines = [
      p['university'] && `University: ${p['university']}`,
      p['location'] && `Region: ${p['location']}`,
      p['scholarshipType'] && `Scholarship: ${p['scholarshipType']}`,
      p['sport'] && `Sport: ${p['sport']}`,
      p['organizationType'] && `Organization: ${p['organizationType']}`,
      p['division'] && `Division: ${p['division']}`,
    ]
      .filter(Boolean)
      .join('\n');

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'Write a 2–3 sentence introduction for a college sports recruiter that will be shown to an athlete receiving a connection request. Be specific, warm, and professional. Highlight what makes the program attractive to a prospective athlete. No quotes, no bullet points — flowing text only.',
          },
          {
            role: 'user',
            content: `Program details:\n${lines}`,
          },
        ],
        temperature: 0.7,
        max_tokens: 150,
      });
      return response.choices[0].message.content?.trim() ?? '';
    } catch (err) {
      this.logger.warn('Could not generate recruiter pitch', err);
      return '';
    }
  }

  private async runSearch(
    query: string,
    filters: SearchFilters,
  ): Promise<ScoutResult> {
    try {
      this.logger.log(
        `Running search "${query}" with filters: ${JSON.stringify(filters)}`,
      );
      const result = await this.scout.search(query, filters, 5);
      this.logger.log(`Scout found ${result.athletes.length} athletes`);
      return result;
    } catch (error) {
      this.logger.error('Scout search failed', error);
      return { query, filters, totalFound: 0, latencyMs: 0, athletes: [] };
    }
  }

  // Billy still has something useful to say even when nothing matches exactly —
  // fall back to a related recommendation instead of going quiet.
  private buildSearchMessage(
    rawContent: string,
    scoutResult: ScoutResult,
  ): string {
    if (scoutResult.athletes.length === 0) {
      return "Right now I couldn't find an athlete with those descriptions. Try broadening your criteria — a different region, GPA range, or graduating class — and I'll take another look.";
    }

    if (scoutResult.relaxedPosition) {
      const sportLabels = scoutResult.filters.sport
        ? POSITION_LABELS[scoutResult.filters.sport.toLowerCase()]
        : undefined;
      const requestedLabel =
        sportLabels?.[scoutResult.relaxedPosition.toUpperCase()] ??
        scoutResult.relaxedPosition;
      const foundPositions = Array.from(
        new Set(scoutResult.athletes.map((a) => a.position).filter(Boolean)),
      );
      const foundLabel =
        foundPositions.length === 1
          ? (sportLabels?.[foundPositions[0].toUpperCase()] ??
            foundPositions[0])
          : 'a few other positions worth a look';

      return `Right now I couldn't find an athlete with those descriptions — no available ${requestedLabel} match right now — but I can introduce you to ${foundLabel} who share a similar profile and could still be a great fit for your program.`;
    }

    return (
      rawContent.replace(/\[SEARCH_READY\].*?\[\/SEARCH_READY\]/s, '').trim() ||
      'Great! I have everything I need. Launching search...'
    );
  }
}
