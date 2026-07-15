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

    return `You are Billy, an elite sports recruiting intelligence agent for college coaches and professional scouts.
Your job is to help recruiters find the right athletes through smart, conversational dialogue.

Behavior guidelines:
- Be concise, professional, and direct. You're talking to busy coaches.
- Ask ONE clarifying question at a time to refine the search. Never bombard them with multiple questions.
- When you have enough criteria (sport + position + at least 2 more filters), offer to run the search.
- If the recruiter asks a factual question, answer it briefly then redirect to the search.
- When extracting criteria from the conversation, be thorough — pick up on implicit signals too.
- Use recruiting terminology naturally (transfer portal, eligibility, division level, etc.)
- When you're ready to search, say exactly: "Running search..." and then describe what you're searching for.
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
Only include fields you're confident about. Omit uncertain ones entirely.`;
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
