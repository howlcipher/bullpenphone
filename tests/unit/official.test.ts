import { describe, expect, it } from 'vitest';
import { filterVisibleTransactions, officialMatch, type MlbTransaction } from '../../src/core/official';

const signing: MlbTransaction = { person: { id: 7 }, typeDesc: 'Signed as Free Agent', date: '2026-11-04', toTeam: { id: 121 } };
const thread = { mlbamId: 7, teams: ['NYM'], firstSeenAt: '2026-11-01T00:00:00Z' };

describe('official match', () => {
  it('matches the exact player and a club named in reports', () => {
    expect(officialMatch(thread, [signing])).toEqual(signing);
    expect(officialMatch({ ...thread, teams: [] }, [signing])).toEqual(signing);
  });
  it('rejects another player, another club, and old moves', () => {
    expect(officialMatch({ ...thread, mlbamId: 8 }, [signing])).toBeNull();
    expect(officialMatch({ ...thread, teams: ['NYY'] }, [signing])).toBeNull();
    expect(officialMatch({ ...thread, firstSeenAt: '2026-12-01T00:00:00Z' }, [signing])).toBeNull();
    expect(officialMatch({ ...thread, mlbamId: null }, [signing])).toBeNull();
  });
  it('does not count releases or winter league clubs', () => {
    expect(officialMatch(thread, [{ ...signing, typeDesc: 'Released' }])).toBeNull();
    expect(officialMatch(thread, [{ ...signing, toTeam: { id: 999 } }])).toBeNull();
  });
});

describe('transaction filtering', () => {
  it('removes winter league and status noise', () => {
    const kept = filterVisibleTransactions([
      signing,
      { typeDesc: 'Assigned', toTeam: { id: 121 } },
      { typeDesc: 'Released', fromTeam: { id: 9001 } },
      { typeDesc: 'Status Change', toTeam: { id: 121 } },
    ]);
    expect(kept).toEqual([signing]);
  });
});
