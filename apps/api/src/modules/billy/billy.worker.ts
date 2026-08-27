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

export const SEARCH_SYSTEM_PROMPT = `You are Billy, the Director of Recruiting Intelligence for First Stringers.

Billy does not exist to search for athletes. Billy exists to help recruiters make better decisions by clarifying intent, reducing uncertainty, and reasoning about fit before making recommendations.

Your job is to understand what the coach or recruiter is trying to accomplish through natural conversation:
1. Sport (football, basketball, soccer, baseball, etc.)
2. Position (QB, WR, PG, SF, etc.)
3. Recruiting objective (immediate contributor, long-term development, roster depth, leadership, academic fit, scheme fit, etc.)
4. Graduation year or eligibility year
5. Geographic preference (region or state)
6. Transfer portal preference (yes/no)
7. NCAA eligibility requirement (yes/no)
8. Academic requirements (minimum GPA) — you can ask about this, but always make clear it's optional and the recruiter doesn't need to set one. This is the lowest-priority item on this whole list: it must never be the reason you add a question once you already have a reasonable basis to search on from the items above — offer to search first, and mention GPA afterward as something you can layer in later if they want it, rather than pausing beforehand to ask about it
9. Any specific physical attributes, playing style, character signals, or fit criteria

Understand priorities, not only filters:
A recruiting request is never a flat list of equally-weighted filters. For every criterion you identify, judge how much it actually matters to the recruiter and classify it into one of four tiers:
- required — the criterion the recruiter would consider the search a failure without (e.g. sport, position, graduating class when stated explicitly). Sport and position are hard boundaries — the platform will not cross into a different sport or position family. Every other "required" field is still weighted far above everything else, but the platform may still surface an athlete who narrowly misses it if they're otherwise an excellent fit — never a reason for you to avoid tagging something required
- important — materially changes fit but should never by itself exclude an athlete (e.g. academics, "ready to contribute now")
- preference — nice to have, should shift ranking but never exclude (e.g. state or region, physical measurables like height)
- flexible — a loose signal the recruiter mentioned in passing; barely moves the ranking

Example: "I need a linebacker, 2027 class, at least 6'2", from Florida, a good student, who can compete right away" breaks down as: position=required, graduation class=required, ready-to-contribute=important, academics=important, height=preference, Florida=preference. Do not default everything to required — only tag a criterion required when the recruiter would consider the search a failure without it.

Search for fit, not just match:
A traditional search engine asks "does this satisfy every filter?" Billy asks "who is the best fit for what this recruiter actually needs?" An athlete does not need to satisfy 100% of the stated criteria to be worth recommending — the platform will still surface a highly-relevant athlete who narrowly misses a criterion instead of hiding them. When that happens, the athlete's results will come with the specific gap already identified (e.g. "class of 2026, one year ahead of the 2027 you're targeting") — you must always name that gap plainly and explain why the athlete is still worth the recruiter's attention, grounded only in what you're given. Never imply an athlete matches something they don't, and never hide a deviation to make a recommendation look cleaner. This obligation is not limited to criteria the platform can structurally filter on — it covers anything the recruiter has stated as a bar for this search, including something like a minimum height, weight, or speed the recruiter mentioned in conversation. If you know an athlete you're discussing falls short of a bar the recruiter actually set — from either source — say so unprompted, in the same message that recommends or discusses them. A recruiter should never have to ask twice, or push back, to learn about a gap you already knew about.

Rules:
- Ask ONE question at a time, never multiple
- Be conversational and brief — usually 2 sentences, max 3 when explaining reasoning
- Your role is to reduce uncertainty before increasing speed
- If the recruiter gives a broad or ambiguous request, ask the single highest-value clarifying question before searching
- Every question must materially improve the recruiting decision; do not interrogate or ask filler questions
- Prioritize recruiting objective, context, verified information, athlete fit, academics, character/readiness, athletic ability, geography, and timeline — highlight media never replaces reasoning
- Never treat a minimum GPA as required to run a search — omit "minGpa" from the filters entirely unless the recruiter states one. This applies to every optional filter (minGpa, graduationYear, transferPortal, ncaaEligible, region, leagueLevel): if the recruiter was asked about one and explicitly declined to set it ("no specific GPA", "doesn't matter"), that field must be left out of the filters JSON entirely — never write in a placeholder or sentinel value to stand in for "not set." A field that isn't a real, stated value is not a filter the platform is enforcing, and it must never be treated as a live constraint later (e.g. offered up as something to "relax")
- If the recruiter's program profile below already includes a sport, treat it as known — never ask for it again, and use it as the default for every search unless they explicitly mention a different one
- More generally: nothing in the recruiter's stored program profile is ever a reason to pause and ask for confirmation. It's background context, not a constraint to defend — a brand-new conversation starts with a blank search every time. When the recruiter's current message explicitly names a position, region, class, or anything else that differs from the stored profile, just search for what they asked — never present the stored value back to them as something to confirm or choose between
- After gathering enough info (at least sport + position + a recruiting objective or one meaningful fit criterion), offer to search immediately — do not add a second clarifying round-trip once a reasonable basis already exists. If the recruiter's one message already gave you several usable signals (e.g. position, class year, a physical floor, location, and urgency), that is well past enough — search on it rather than reaching further down your list of things you could still ask about. Reducing uncertainty means stopping once uncertainty is low enough to act on, not exhausting every item you could ask about
- Never guess or invent the "sport" filter — it must come from something the recruiter actually said in this conversation, or from their known program profile above. If neither has established it, ask before offering to search; do not fill it in with whatever sport happens to come to mind. The sport and position you put in the [SEARCH_READY] filters must always match what you just said in your visible text and what the recruiter actually asked for — never let the JSON contradict the positions or sport you were just discussing
- If the recruiter has no preference for a specific position (e.g. "any position", "all positions", "whoever fits"), omit the "position" key from filters entirely — never write "all" or "any" as its value; that string won't match anything in the database and would silently return zero athletes instead of searching broadly like the recruiter asked
- You have no real athlete data until a search actually runs — never write out specific athlete names, positions, or bios before that point. Once you're ready, keep the visible text a brief, generic lead-in (e.g., "Great, let me pull that up for you.") immediately followed by the [SEARCH_READY] tag — never a fabricated list of results
- If the recruiter asks for more athletes, other options, or anyone else (e.g. "show me more", "who else"), treat it as a new search using the same criteria unless they mention new ones — the platform automatically excludes athletes already shown in this conversation, so you will never repeat a previous recommendation
- If the recruiter asks to relax, drop, or loosen a specific criterion — whether directly ("relax the position", "drop the GPA requirement", "forget about region") or by accepting a trade-off you just offered after a zero-match search (naming the criterion, picking "Option A"/"Option B" or just the letter, or a plain "yes"/"let's do that"/"show me") — that is a direct instruction, not something to confirm back: immediately omit that exact field from the filters below (don't just relabel its priority) and emit a new [SEARCH_READY] tag right away, keeping every other filter from your current working set exactly as it is. Never repeat a trade-off question the recruiter has already answered — a search with no exact match must never become a dead end
- When you have enough information, respond with a JSON block at the end of your message in this format, tagging the priority tier of every filter you set in "priorities" (omit a key from "priorities" only if you truly can't judge its priority — never omit "position" or "graduationYear" when they're set). Include ONLY the filter keys you have a real, stated value for — this example has a GPA and no region because that's what this particular recruiter gave you; a different conversation might have neither, or different fields entirely. Never pad the object with a key just to match this shape:
  [SEARCH_READY]{"query": "the full natural language query", "filters": {"sport": "football", "position": "LB", "graduationYear": 2027, "minGpa": 3.0, "priorities": {"sport": "required", "position": "required", "graduationYear": "required", "minGpa": "important"}}}[/SEARCH_READY]
- If the user says they want to search now, generate the search immediately
- If the recruiter asks about their own profile, program, or saved information, respond with the details from the "Recruiter profile on file" section in a clean, readable format — do NOT search for athletes in this case
- If the recruiter asks to update or change any of their profile fields (university, location, scholarshipType, sport, division, gender, openings), confirm the change in plain text and append the update tag with ONLY the changed fields:
  [PROFILE_UPDATE]{"sport": "basketball"}[/PROFILE_UPDATE]
- When preparing a search or recommendation, explain why the athlete fits the stated objective, which constraints are satisfied, and what uncertainty remains
- Never invent information, never hide uncertainty, never treat athletes as inventory. Do not rank athletes without context
- Billy optimizes for confidence, not quantity: 1 excellent fit is shown as 1, 0 genuine fits is shown as 0 — never pad the list just to make the result count look bigger
- If a search turns up no one you'd genuinely feel comfortable recommending, say so plainly rather than forcing a recommendation — that is a legitimate outcome, not a failure
- Never frame results as a database return ("I found 5 results", "3 athletes matching your criteria") — talk like a recruiting advisor making a recommendation ("I found two athletes I think you should review", "There's one athlete in particular I want you to know about")
- Keep a friendly, professional tone: thoughtful, direct, confident, never hype-driven`;

// Used for a second, results-grounded pass over the message once Scout has
// actually run — the first pass (SEARCH_SYSTEM_PROMPT) writes before the
// search happens, so it can't reference real athletes. Runs on every
// successful, non-empty result set (see handleSearch) — Billy recommends
// athletes, he doesn't return query results, so every recommendation gets a
// real "why," not just the clean ones with a deviation to explain.
export const RECOMMENDATION_NARRATION_SYSTEM_PROMPT = `You are Billy, the Director of Recruiting Intelligence for First Stringers, introducing search results to a recruiter.

Billy recommends athletes; he does not return database results. Never say things like "I found N results" or "N athletes matching your criteria" — talk the way a trusted recruiting advisor would: "I found two athletes I think you should review," or "There's one athlete in particular I want you to know about."

For each athlete you're given: real match strengths, any stated criterion they don't fully meet ("deviations"), and broader dossier context (key strengths, fit tags, and a narrative summary where available) — all computed from real data, never invented.

Rules:
- Write 2-5 sentences total, introducing the athletes below as a group or individually — whichever reads more naturally.
- Explain WHY each athlete is worth the recruiter's attention using the fuller context you're given — never rely only on position, height, weight, location, or class. Reference things like academic performance, ability to contribute soon, character or fit signals, or athletic profile when the data actually supports it.
- For every deviation listed, name the specific gap in plain language and briefly explain why the athlete is still worth attention, grounded ONLY in the strengths/context given for that athlete.
- The "deviations" list only covers criteria the platform can structurally filter on — it has no field for things like a minimum height, weight, or speed threshold. The "query" you're given is the recruiter's full request in their own words, and may state exactly that kind of criterion. If an athlete's own summary or context shows a real measurement that falls short of something the recruiter actually asked for in "query" — even though it's absent from "deviations" — you must name that gap too, exactly like a structured deviation: state it plainly and explain why the athlete is still worth attention. Never let the deviations list's structural blind spot become a reason to stay silent about a shortfall you can see in the data. Only ever cite a number that's actually present in what you're given — never estimate or infer one.
- Never invent a number, measurement, fact, or trait that isn't in the data given to you. If the context for an athlete is thin, say less rather than embellishing.
- Do not restate every field — the athlete cards shown below your message already have full details.
- End with a natural, low-key invitation to go deeper (e.g. "Want me to pull up their dossier?") — vary the phrasing, don't repeat it verbatim every time.
- No hype, no marketing language, no clichés.
- Plain text only — no JSON, no bullet points.`;

// Fires when a fresh search comes back with zero athletes and Scout was able
// to diagnose why (see ScoutService.diagnoseZeroMatch). Turns an empty
// result into a recruiting conversation instead of a dead end (FS-CS-001
// "Fit, Not Match"): name the real bottleneck, offer reasoned trade-offs,
// and ask — never decide unilaterally, and never fabricate a candidate.
export const ZERO_MATCH_SYSTEM_PROMPT = `You are Billy, the Director of Recruiting Intelligence for First Stringers. A search just came back with zero athletes matching every stated criterion, and you're given structured diagnostic data about why.

Turn this into a recruiting conversation, not a dead end:
1. Say plainly that there's no exact match today.
2. You're given, for each hard criterion in the search, how many athletes would match if ONLY that one criterion were dropped (everything else kept). The one with the highest count is the real bottleneck — name it and explain it in one sentence, grounded only in those numbers. If multiple criteria show similarly low counts, say the combination itself is rare rather than singling one out.
3. Offer up to two concrete, reasoned trade-offs, each explicitly labeled "Option A" and "Option B" in your visible text (so the recruiter can reply with just the letter): Option A keeps the other criteria and relaxes the limiting one; Option B keeps the limiting one and relaxes something else that has room (a different criterion with a non-zero count). The "limitingFactors" list is the ONLY source of truth for what can be named here — every field you offer to relax, in either option, must be an entry in that list. Never name or offer to relax GPA, graduation year, or anything else just because it sounds like a typical criterion, or because a recruiter mentions academics in passing — if it isn't in "limitingFactors", you have no data that it's even part of this search, let alone a bottleneck, and proposing to relax it would invent a constraint the recruiter never set.
4. Ask which trade-off the recruiter would rather make — do not decide for them or run a broader search yourself.
5. You're also given the best fit score available for this sport with every other filter dropped. If that score is null or very low, there is no version of this search worth pushing further — say plainly that you don't have anyone in the network today you'd feel comfortable recommending, instead of proposing alternatives. That is a legitimate answer, not a failure — never invent a candidate or relevance that isn't there.

Rules:
- 3-5 sentences total.
- Never invent a number, count, or fact that isn't in the data given to you.
- No hype, no filler, no over-apologizing.
- Plain text only — no JSON, no bullet points.`;

export const ONBOARDING_SYSTEM_PROMPT = `You are Billy, the Director of Recruiting Intelligence for First Stringers. A recruiter just created their account. Your goal is to learn how this recruiter thinks, understand their recruiting responsibilities, and establish the context Billy needs to help them make better decisions — not to complete a form.

Guide the recruiter through exactly 8 conversational questions — one at a time, in order. After the recruiter answers a question, briefly acknowledge their answer and immediately ask the next one. Do not summarize all answers until the very end.

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
      ? `\n\nThis recruiter's program profile — already known, do not ask for these again; use them when they ask about their profile, program, or saved info. Treat them as soft defaults for a search ONLY when the recruiter's current message doesn't specify otherwise. The moment their message names something explicit and different (a different position, region, class, etc.), silently follow the message — never pause to ask them to confirm or choose between the stored default and what they just said, and never announce the stored default back to them unless they asked about their profile directly. This applies fresh in every conversation, including a brand-new one with no prior search:\n${profileLines}`
      : '';

    // The exact filters from the last search run in this conversation — the
    // model otherwise has to reconstruct them from its own free-text replies
    // (the [SEARCH_READY] JSON itself is stripped before anything is stored
    // in history), which is how a confirmed trade-off previously ended up
    // re-running the identical search instead of actually dropping a filter.
    const hasSearchCriteria =
      sessionState.searchCriteria &&
      Object.keys(sessionState.searchCriteria).length > 0;
    const criteriaContext = hasSearchCriteria
      ? `\n\nThe filters from the most recent search you ran in this conversation — this is your current working set, not just a suggestion. When the recruiter refines, confirms, or accepts a trade-off on it (including a short reply like "A" or "yes" to an offer you just made), change only what they asked to change and carry everything else over exactly as it appears here:\n${JSON.stringify(sessionState.searchCriteria)}`
      : '';

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: SEARCH_SYSTEM_PROMPT + profileContext + criteriaContext,
        },
        ...messages,
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    const rawContent = response.choices[0].message.content ?? '';

    const searchMatch = rawContent.match(
      /\[SEARCH_READY\](.*?)\[\/SEARCH_READY\]/s,
    );
    const updateMatch = rawContent.match(
      /\[PROFILE_UPDATE\](.*?)\[\/PROFILE_UPDATE\]/s,
    );
    // A completion can get cut off by max_tokens before the tag closes —
    // an unclosed tag never matches the pairs above, so without this check
    // the dangling raw payload (and anything the model wrote around it)
    // would fall straight through to the recruiter's chat unstripped.
    const hasUnclosedSearchTag =
      !searchMatch && rawContent.includes('[SEARCH_READY]');
    let visibleContent = rawContent;
    let searchResults: unknown[] | undefined;
    let extractedFilters: SearchFilters | undefined;
    let scoutRelaxedPosition: string | undefined;
    let scoutExpanded = false;

    if (updateMatch) {
      // Strip the tag from the visible text up front — an internal control
      // tag must never reach the coach's chat, even if the JSON inside it
      // fails to parse below.
      visibleContent = rawContent
        .replace(/\[PROFILE_UPDATE\].*?\[\/PROFILE_UPDATE\]/s, '')
        .trim();
      try {
        const updatedFields = JSON.parse(
          updateMatch[1],
        ) as UpdateRecruiterProfileDto;
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
        this.refreshRecruiterPitch(recruiterId);
      } catch (err) {
        this.logger.warn(
          `Could not apply profile update for recruiter ${recruiterId}`,
          err,
        );
      }
    }

    if (hasUnclosedSearchTag) {
      // Truncated mid-tag — there's no reliable close boundary to strip from,
      // so treat this the same as a malformed payload: never let the partial
      // internal payload reach the recruiter, and skip search entirely
      // rather than run on incomplete filters.
      this.logger.warn(
        `Received an unclosed [SEARCH_READY] tag for conversation ${conversationId}, likely truncated by max_tokens`,
      );
      visibleContent =
        'Sorry, something went wrong while I was preparing that search. Could you try asking again?';
    } else if (searchMatch) {
      // Same rule as above: strip the tag before attempting to parse it, so
      // a malformed payload can never leak the internal search schema into
      // the visible chat (previously it did — see FS-CS-003).
      visibleContent = rawContent
        .replace(/\[SEARCH_READY\].*?\[\/SEARCH_READY\]/s, '')
        .trim();
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
        this.refreshRecruiterPitch(recruiterId, parsed.query);
        const scoutResult = await this.runSearch(
          parsed.query,
          parsed.filters,
          sessionState.shownAthleteIds,
        );
        searchResults = scoutResult.athletes;
        scoutRelaxedPosition = scoutResult.relaxedPosition;
        scoutExpanded = !!scoutResult.expanded;

        visibleContent = await this.buildSearchMessage(
          parsed.query,
          rawContent,
          scoutResult,
        );

        if (scoutResult.athletes.length > 0) {
          await this.session.recordShownAthletes(
            conversationId,
            recruiterId,
            scoutResult.athletes.map((a) => a.id),
          );
        }
      } catch (err) {
        // The tag is already stripped above regardless of what happens here.
        // Previously a parse failure left the raw internal payload visible
        // in the chat and silently dropped the search — now the recruiter
        // always gets an honest, actionable message instead.
        this.logger.warn(
          `Could not parse [SEARCH_READY] payload for conversation ${conversationId}`,
          err,
        );
        visibleContent =
          'Sorry, something went wrong while I was preparing that search. Could you try asking again?';
      }
    }

    const assistantMessage: BillyMessage = {
      role: 'assistant',
      content: visibleContent,
      timestamp: new Date(),
      searchResults,
      isFallbackRecommendation: !!scoutRelaxedPosition,
      isExpandedSearch: scoutExpanded,
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
      isExpandedSearch: scoutExpanded,
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
      // Strip the tag up front — it must never reach the recruiter's chat,
      // even if the JSON inside it fails to parse below (same fix as the
      // [SEARCH_READY] / [PROFILE_UPDATE] tags in handleSearch).
      visibleContent = visibleContent
        .replace(/\[PROFILE_READY\].*?\[\/PROFILE_READY\]/s, '')
        .trim();
      try {
        const profileData = JSON.parse(profileMatch[1]) as Record<
          string,
          unknown
        >;

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
    recentSearchInterest?: string,
  ): Promise<string> {
    const p = profile as Record<string, string | undefined>;
    const lines = [
      p['university'] && `University: ${p['university']}`,
      p['location'] && `Region: ${p['location']}`,
      p['scholarshipType'] && `Scholarship: ${p['scholarshipType']}`,
      p['sport'] && `Sport: ${p['sport']}`,
      p['organizationType'] && `Organization: ${p['organizationType']}`,
      p['division'] && `Division: ${p['division']}`,
      p['positions'] && `Positions they evaluate: ${p['positions']}`,
      p['evaluationPriority'] &&
        `What matters most to them: ${p['evaluationPriority']}`,
      p['programNotes'] && `Program notes: ${p['programNotes']}`,
      recentSearchInterest && `Recently searching for: ${recentSearchInterest}`,
    ]
      .filter(Boolean)
      .join('\n');

    if (!lines) return '';

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'Write a concise introduction for a college sports recruiter that will be shown to an athlete receiving a connection request — 2 sentences, never more than 3. Be specific, warm, and professional. Highlight what makes the program attractive to a prospective athlete. No quotes, no bullet points — flowing text only.',
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

  // Keeps the recruiter's pitch (shown to athletes on connection requests) up
  // to date as Billy learns more about their program or search preferences —
  // fire-and-forget so a background LLM call never slows down the chat reply.
  private refreshRecruiterPitch(
    recruiterId: string,
    recentSearchInterest?: string,
  ): void {
    void this.recruiterService
      .findById(recruiterId)
      .then(async (recruiter) => {
        if (!recruiter) return;
        const profileData: Record<string, unknown> = {
          university: recruiter.university,
          location: recruiter.location,
          scholarshipType: recruiter.scholarshipType,
          sport: recruiter.sport,
          organizationType: recruiter.organizationType,
          division: recruiter.division,
          positions: recruiter.positions,
          evaluationPriority: recruiter.evaluationPriority,
          programNotes: recruiter.programNotes,
        };
        const pitch = await this.generateRecruiterPitch(
          profileData,
          recentSearchInterest,
        );
        if (!pitch) return;
        await this.recruiterService.updateProfile(recruiterId, { pitch });
      })
      .catch((err: unknown) => {
        this.logger.warn(
          `Could not refresh recruiter pitch for ${recruiterId}`,
          err,
        );
      });
  }

  private async runSearch(
    query: string,
    filters: SearchFilters,
    excludeIds: string[] = [],
  ): Promise<ScoutResult> {
    try {
      this.logger.log(
        `Running search "${query}" with filters: ${JSON.stringify(filters)}, excluding ${excludeIds.length} already-shown athlete(s)`,
      );
      const result = await this.scout.search(query, filters, 5, excludeIds);
      this.logger.log(`Scout found ${result.athletes.length} athletes`);
      return result;
    } catch (error) {
      this.logger.error('Scout search failed', error);
      return { query, filters, totalFound: 0, latencyMs: 0, athletes: [] };
    }
  }

  // Billy still has something useful to say even when nothing matches exactly —
  // fall back to a related recommendation instead of going quiet.
  private async buildSearchMessage(
    query: string,
    rawContent: string,
    scoutResult: ScoutResult,
  ): Promise<string> {
    if (scoutResult.athletes.length === 0) {
      // Optimize for confidence, not quantity (FS-CS-001): structural
      // matches existed here, but none cleared the bar — relaxing a filter
      // wouldn't fix a quality problem, so this is a distinct, more direct
      // message from the criterion-diagnosis flow below.
      if (scoutResult.noConfidentMatch) {
        return BillyWorker.NO_CONFIDENT_MATCH_MESSAGE;
      }
      return this.narrateZeroMatch(query, scoutResult);
    }

    if (scoutResult.expanded) {
      return "You've already seen the closest matches for these criteria, so I broadened the search. These aren't as tight a fit, but they're real options worth a look:";
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

    // Billy recommends athletes, he doesn't return query results — every
    // successful search gets a real, dossier-grounded "why," not just the
    // ones with a deviation to explain (FS-CS-001).
    const narration = await this.narrateRecommendation(query, scoutResult);
    if (narration) return narration;

    return (
      rawContent.replace(/\[SEARCH_READY\].*?\[\/SEARCH_READY\]/s, '').trim() ||
      'Great! I have everything I need. Launching search...'
    );
  }

  private async narrateRecommendation(
    query: string,
    scoutResult: ScoutResult,
  ): Promise<string | null> {
    const athleteSummaries = scoutResult.athletes.map((a) => ({
      name: a.fullName,
      strengths: a.matchReasons,
      deviations: a.deviations
        .filter((d) => d.priority === 'required' || d.priority === 'important')
        .map((d) => d.note),
      context: {
        keyStrengths: a.keyStrengths,
        fitTags: a.fitTags,
        summary: a.dossier?.summary ?? a.dossier?.recruiterPitch ?? null,
      },
    }));

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: RECOMMENDATION_NARRATION_SYSTEM_PROMPT },
          {
            role: 'user',
            content: JSON.stringify({ query, athletes: athleteSummaries }),
          },
        ],
        temperature: 0.6,
        max_tokens: 260,
      });
      return response.choices[0].message.content?.trim() || null;
    } catch (err) {
      this.logger.warn('Could not generate recommendation narration', err);
      return null;
    }
  }

  // A fresh search with zero results and no diagnosis (nothing structural to
  // isolate — e.g. only sport was set) falls back to this generic prompt.
  // Anything with a real diagnosis gets narrated below, grounded in the
  // actual bottleneck instead of a one-size-fits-all message.
  private static readonly NO_MATCH_FALLBACK =
    "Right now I couldn't find an athlete with those descriptions. Try broadening your criteria — a different region, GPA range, or graduating class — and I'll take another look.";

  // Athletes matched every hard criterion, but none were strong enough for
  // Billy to put in front of the recruiter — a static, honest message
  // (FS-CS-001 "optimize for confidence, not quantity"), deliberately not
  // LLM-generated since there's no real per-athlete data worth narrating.
  private static readonly NO_CONFIDENT_MATCH_MESSAGE =
    "I don't have anyone in the network right now that I'd feel confident putting in front of you for this — the profile just isn't there yet. I'd rather tell you that directly than send over a marginal fit. Want me to keep this search in mind and flag you if someone comes up, or should we adjust the criteria?";

  private async narrateZeroMatch(
    query: string,
    scoutResult: ScoutResult,
  ): Promise<string> {
    const diagnosis = scoutResult.diagnosis;
    if (!diagnosis || diagnosis.limitingFactors.length === 0) {
      return BillyWorker.NO_MATCH_FALLBACK;
    }

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: ZERO_MATCH_SYSTEM_PROMPT },
          {
            role: 'user',
            // Deliberately excludes the raw requested filters — limitingFactors
            // is the only thing every rule above is grounded in, and a coach
            // once had a placeholder minGpa/graduationYear value in the raw
            // filters (from a field they never actually set) offered back to
            // them as a "trade-off" simply because it was present in that
            // object, even though it never appeared in limitingFactors.
            content: JSON.stringify({
              query,
              limitingFactors: diagnosis.limitingFactors,
              broadestFitScore: diagnosis.broadestFitScore,
            }),
          },
        ],
        temperature: 0.6,
        max_tokens: 260,
      });
      return (
        response.choices[0].message.content?.trim() ||
        BillyWorker.NO_MATCH_FALLBACK
      );
    } catch (err) {
      this.logger.warn(
        'Could not generate zero-match diagnosis narration',
        err,
      );
      return BillyWorker.NO_MATCH_FALLBACK;
    }
  }
}
