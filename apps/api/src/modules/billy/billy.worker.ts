import { Processor, Process } from '@nestjs/bull';
import type { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import OpenAI from 'openai';
import { BillySessionService } from './billy-session.service';
import { BillyConversationService } from './billy-conversation.service';
import { BillyMessage, BillyMessageJob } from '../../shared/types/billy.types';
import { ScoutService } from '../scout/scout.service';
import {
  RecruiterService,
  UpdateRecruiterProfileDto,
} from '../recruiter/recruiter.service';
import { SearchFilters } from '../../shared/types/scout.types';

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

const ONBOARDING_SYSTEM_PROMPT = `You are Billy, a recruiting intelligence assistant for First Stringers. A recruiter just created their account and you need to learn about their program to help them find the right athletes and introduce those athletes properly.

Collect the following information through natural, friendly conversation — one question at a time:
1. University or institution they represent (MOST IMPORTANT)
2. Location / city and state (MOST IMPORTANT)
3. Scholarship available: full scholarship, partial scholarship, or financial aid only (MOST IMPORTANT)
4. Primary sport they recruit for (optional — they can skip)
5. Gender of athletes they recruit: male, female, or both (optional)
6. Division level: D1, D2, D3, NAIA, JUCO (optional — they can skip)
7. Number of open spots/vacancies they have (optional)

Rules:
- Ask ONE question at a time, conversationally
- Max 2 sentences per message
- Be warm and encouraging — this is their first experience with the platform
- If they say they don't know or want to skip any optional question, gracefully move on
- Never be pushy about the optional ones (sport, gender, division, openings)
- After collecting at least university, location, and scholarship type, wrap up
- When you have enough to proceed, your ENTIRE response must look EXACTLY like this example (replace with real values):

  You're all set! Welcome to First Stringers — let's find you some great athletes.
  [PROFILE_READY]{"university": "State University", "location": "Austin, TX", "scholarshipType": "full"}[/PROFILE_READY]

- The visible part (before [PROFILE_READY]) must be 1-2 warm sentences of PLAIN TEXT only — no JSON, no code fences, no backticks, no "profile summary", no data recap of any kind.
- The [PROFILE_READY] tag contains ONLY the JSON object and nothing else. It is invisible to the recruiter.
- Only include fields the recruiter actually provided — omit nulls
- Keep a warm, professional tone`;

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
      recruiter?.location && `- Location: ${recruiter.location}`,
      recruiter?.scholarshipType &&
        `- Scholarship: ${recruiter.scholarshipType}`,
      recruiter?.sport && `- Sport: ${recruiter.sport}`,
      recruiter?.division && `- Division: ${recruiter.division}`,
      recruiter?.gender && `- Athletes: ${recruiter.gender}`,
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
        visibleContent =
          rawContent
            .replace(/\[SEARCH_READY\].*?\[\/SEARCH_READY\]/s, '')
            .trim() || 'Great! I have everything I need. Launching search...';

        extractedFilters = parsed.filters;
        await this.session.updateSearchCriteria(
          conversationId,
          recruiterId,
          parsed.filters as never,
        );
        searchResults = await this.runSearch(parsed.query, parsed.filters);
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
        const profileData = JSON.parse(
          profileMatch[1],
        ) as UpdateRecruiterProfileDto;
        const summaryLines: string[] = [];
        if (profileData.university)
          summaryLines.push(`🏫 University: ${profileData.university}`);
        if (profileData.location)
          summaryLines.push(`📍 Location: ${profileData.location}`);
        if (profileData.scholarshipType)
          summaryLines.push(`🎓 Scholarship: ${profileData.scholarshipType}`);
        if (profileData.sport)
          summaryLines.push(`🏆 Sport: ${profileData.sport}`);
        if (profileData.division)
          summaryLines.push(`📊 Division: ${profileData.division}`);
        if (profileData.gender)
          summaryLines.push(`👥 Athletes: ${profileData.gender}`);
        if (profileData.openings)
          summaryLines.push(`🔢 Open spots: ${profileData.openings}`);
        visibleContent = `You're all set! Here's your program profile:\n\n${summaryLines.join('\n')}\n\nWelcome to First Stringers — let's find your next great athlete.`;

        const pitch = await this.generateRecruiterPitch(profileData);

        // Cherry-pick known fields only — never forward arbitrary LLM JSON keys to Prisma.
        await this.recruiterService.updateProfile(recruiterId, {
          university: profileData.university,
          location: profileData.location,
          scholarshipType: profileData.scholarshipType,
          sport: profileData.sport,
          gender: profileData.gender,
          division: profileData.division,
          openings: profileData.openings,
          onboardingCompleted: true,
          pitch,
        });

        // Flip the session out of onboarding mode
        await this.session.setOnboardingComplete(conversationId, recruiterId);

        this.eventEmitter.emit('billy.onboarding_complete', {
          recruiterId,
          conversationId,
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

  private async generateRecruiterPitch(
    profile: UpdateRecruiterProfileDto,
  ): Promise<string> {
    const lines = [
      profile.university && `University: ${profile.university}`,
      profile.location && `Location: ${profile.location}`,
      profile.scholarshipType && `Scholarship: ${profile.scholarshipType}`,
      profile.sport && `Sport: ${profile.sport}`,
      profile.division && `Division: ${profile.division}`,
      profile.openings && `Open spots: ${profile.openings}`,
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
  ): Promise<unknown[]> {
    try {
      this.logger.log(
        `Running search "${query}" with filters: ${JSON.stringify(filters)}`,
      );
      const result = await this.scout.search(query, filters, 5);
      this.logger.log(`Scout found ${result.athletes.length} athletes`);
      return result.athletes;
    } catch (error) {
      this.logger.error('Scout search failed', error);
      return [];
    }
  }
}
