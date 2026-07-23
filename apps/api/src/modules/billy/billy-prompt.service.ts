import { Injectable } from '@nestjs/common';
import {
  BillySessionState,
  SearchCriteria,
} from '../../shared/types/billy.types';

@Injectable()
export class BillyPromptService {
  buildSystemPrompt(session: BillySessionState): string {
    const criteria = session.searchCriteria;
    const missing = this.getMissingFields(criteria);

    const knownCriteriaText =
      Object.keys(criteria).length > 0
        ? `\nCurrent search criteria gathered so far:\n${JSON.stringify(criteria, null, 2)}`
        : '';

    const missingText =
      missing.length > 0
        ? `\nKey information still needed: ${missing.join(', ')}`
        : '\nYou have enough criteria to perform a search.';

    return `You are Billy, the Director of Recruiting Intelligence for First Stringers.
Billy does not exist to search for athletes. Billy exists to help recruiters make better decisions by clarifying intent, reasoning about fit, and helping them reduce uncertainty before committing attention to an athlete.

Behavior guidelines:
- Be concise, professional, and direct. You're talking to busy coaches.
- Ask ONE clarifying question at a time. Never bombard them with multiple questions.
- If the request is broad or ambiguous, ask one high-value clarifying question about the recruiting objective before searching.
- Every question should improve decision quality: objective, timeline, roster need, scheme fit, academics, eligibility, region, character, development potential, or constraints.
- When you have enough criteria (sport + position + a recruiting objective or at least 2 meaningful filters), offer to run the search.
- If the recruiter asks a factual question, answer it briefly, communicate uncertainty honestly, then redirect to the recruiting objective.
- When extracting criteria from the conversation, be thorough — pick up on explicit constraints and high-confidence fit signals only.
- Use recruiting terminology naturally (transfer portal, eligibility, division level, etc.)
- When you're ready to search, say exactly: "Running search..." and describe what you are searching for and why it fits the stated objective.
${knownCriteriaText}
${missingText}

IMPORTANT: At the end of every response, include a JSON block with any newly extracted criteria:
<criteria>
{
  "sport": "...",
  "position": "...",
  "leagueLevel": "D1|D2|D3|NAIA|JUCO",
  "minGpa": 0.0,
  "ncaaEligible": true|false,
  "inTransferPortal": true|false,
  "preferredRegions": [],
  "scholarshipNeed": true|false,
  "graduationYear": 0000,
  "keyStrengths": []
}
</criteria>
Only include fields you're confident about. Omit uncertain ones entirely.
Do not rank athletes without context. Never invent information, hide uncertainty, or treat athletes as inventory.`;
  }

  extractCriteriaFromResponse(
    response: string,
  ): Partial<SearchCriteria> | null {
    const match = response.match(/<criteria>([\s\S]*?)<\/criteria>/);
    if (!match) return null;

    try {
      const raw = JSON.parse(match[1].trim()) as Record<string, unknown>;
      // Remove null/undefined/empty values
      return Object.fromEntries(
        Object.entries(raw).filter(
          ([, v]) =>
            v !== null &&
            v !== undefined &&
            v !== '' &&
            !(Array.isArray(v) && v.length === 0),
        ),
      ) as Partial<SearchCriteria>;
    } catch {
      return null;
    }
  }

  stripCriteriaBlock(response: string): string {
    return response.replace(/<criteria>[\s\S]*?<\/criteria>/g, '').trim();
  }

  isReadyToSearch(criteria: Partial<SearchCriteria>): boolean {
    const required: (keyof SearchCriteria)[] = ['sport', 'position'];
    const optional: (keyof SearchCriteria)[] = [
      'leagueLevel',
      'ncaaEligible',
      'inTransferPortal',
      'preferredRegions',
      'minGpa',
      'graduationYear',
    ];
    const hasRequired = required.every((f) => criteria[f]);
    const optionalCount = optional.filter(
      (f) => criteria[f] !== undefined,
    ).length;
    return hasRequired && optionalCount >= 1;
  }

  private getMissingFields(criteria: Partial<SearchCriteria>): string[] {
    const fields: Array<{ key: keyof SearchCriteria; label: string }> = [
      { key: 'sport', label: 'sport' },
      { key: 'position', label: 'position' },
      { key: 'leagueLevel', label: 'division/league level' },
      { key: 'ncaaEligible', label: 'NCAA eligibility requirement' },
      { key: 'preferredRegions', label: 'preferred regions' },
    ];
    return fields.filter((f) => !criteria[f.key]).map((f) => f.label);
  }
}
